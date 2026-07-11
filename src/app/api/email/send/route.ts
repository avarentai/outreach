import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";

import { SMTP_SESSION_COOKIE, getServerSmtpConfig, getSmtpSession } from "@/lib/email/smtp-vault";
import { textToHtml } from "@/lib/email";
import { trackedHtml } from "@/lib/email/tracking";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

const schema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1).max(998),
  text: z.string().trim().min(1).max(100_000),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  campaignId: z.string().optional(),
  followUpId: z.string().optional(),
  threadId: z.string().optional(),
  messageId: z.string().optional(),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const config = getSmtpSession(cookieStore.get(SMTP_SESSION_COOKIE)?.value) ?? getServerSmtpConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Connect a Zoho account in Settings before sending email." },
      { status: 409 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Recipient, subject, and message are required." }, { status: 400 });
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.email, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  try {
    const trackedMessageId = parsed.data.contactId && parsed.data.companyId ? parsed.data.messageId ?? `msg_${nanoid(12)}` : undefined;
    const info = await transport.sendMail({
      from: `${config.fromName} <${config.email}>`,
      to: parsed.data.to,
      subject: parsed.data.subject,
      text: parsed.data.text,
      html: trackedMessageId ? trackedHtml(parsed.data.text, trackedMessageId) : textToHtml(parsed.data.text),
      replyTo: config.email,
    });
    if (parsed.data.contactId && parsed.data.companyId) {
      await recordSentMessage({
        providerMessageId: info.messageId,
        messageId: trackedMessageId!,
        fromEmail: config.email,
        to: parsed.data.to,
        subject: parsed.data.subject,
        text: parsed.data.text,
        contactId: parsed.data.contactId,
        companyId: parsed.data.companyId,
        campaignId: parsed.data.campaignId,
        followUpId: parsed.data.followUpId,
        threadId: parsed.data.threadId,
      });
    }
    return NextResponse.json({ ok: true, messageId: info.messageId, fromEmail: config.email });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Zoho rejected the message.";
    return NextResponse.json({ error: `Email was not sent. ${detail}` }, { status: 502 });
  } finally {
    transport.close();
  }
}

async function recordSentMessage(input: {
  providerMessageId: string;
  messageId: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  contactId: string;
  companyId: string;
  campaignId?: string;
  followUpId?: string;
  threadId?: string;
}) {
  const userClient = await createServerSupabase();
  const admin = createAdminSupabase();
  if (!userClient || !admin) return;
  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return;
  const { data: membership } = await admin.from("memberships").select("workspace_id").eq("user_id", authData.user.id).limit(1).maybeSingle();
  if (!membership) return;

  let threadId: string | undefined = input.threadId;
  if (!threadId) {
    let threadQuery = admin.from("threads").select("id").eq("workspace_id", membership.workspace_id).eq("contact_id", input.contactId);
    if (input.campaignId) threadQuery = threadQuery.eq("campaign_id", input.campaignId);
    const latest = await threadQuery.order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    threadId = latest.data?.id;
  }
  const now = new Date().toISOString();
  if (!threadId) {
    threadId = `th_${nanoid(12)}`;
    const created = await admin.from("threads").insert({
      id: threadId,
      workspace_id: membership.workspace_id,
      contact_id: input.contactId,
      company_id: input.companyId,
      campaign_id: input.campaignId ?? null,
      subject: input.subject.replace(/^(re|fw|fwd):\s*/i, ""),
      owner_id: authData.user.id,
      state: "open",
      sentiment: "unclassified",
      meeting_booked: false,
      last_message_at: now,
      unread: false,
    });
    if (created.error) return;
  }
  const account = await admin.from("sending_accounts").select("id").eq("workspace_id", membership.workspace_id).eq("from_email", input.fromEmail).limit(1).maybeSingle();
  await admin.from("email_messages").insert({
    id: input.messageId,
    workspace_id: membership.workspace_id,
    thread_id: threadId,
    contact_id: input.contactId,
    company_id: input.companyId,
    campaign_id: input.campaignId ?? null,
    sending_account_id: account.data?.id ?? null,
    direction: "outbound",
    status: "sent",
    subject: input.subject,
    body: input.text,
    from_email: input.fromEmail,
    to_email: input.to,
    provider_message_id: input.providerMessageId,
    sent_at: now,
    word_count: input.text.split(/\s+/).filter(Boolean).length,
  });
  await admin.from("threads").update({ last_message_at: now }).eq("id", threadId);
  if (input.followUpId) await admin.from("follow_ups").update({ status: "sent" }).eq("id", input.followUpId).eq("workspace_id", membership.workspace_id);
  await admin.from("activities").insert({
    workspace_id: membership.workspace_id,
    type: "email_sent",
    actor_id: authData.user.id,
    contact_id: input.contactId,
    company_id: input.companyId,
    campaign_id: input.campaignId ?? null,
    summary: `Email sent to ${input.to}`,
  });
}
