import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { nanoid } from "nanoid";

import { classifyReply } from "@/lib/engines/classify";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(req: Request) {
  const expected = process.env.CRON_SECRET ?? process.env.WORKER_SECRET;
  return !!expected && (
    req.headers.get("x-worker-secret") === expected ||
    req.headers.get("authorization") === `Bearer ${expected}`
  );
}

async function authorized(req: Request) {
  if (cronAuthorized(req)) return true;
  const client = await createServerSupabase();
  if (!client) return false;
  const { data } = await client.auth.getUser();
  return !!data.user;
}

export async function GET(req: Request) {
  return syncInbox(req);
}

export async function POST(req: Request) {
  return syncInbox(req);
}

async function syncInbox(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminSupabase();
  const user = process.env.IMAP_USER ?? process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS ?? process.env.SMTP_PASS;
  if (!admin || !user || !pass) {
    return NextResponse.json({ error: "IMAP is not configured." }, { status: 503 });
  }

  const imap = new ImapFlow({
    host: process.env.IMAP_HOST ?? "imap.zoho.com",
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  let imported = 0;
  let skipped = 0;
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const found = await imap.search({ since }, { uid: true });
      const uids = (found || []).slice(-100);
      if (uids.length === 0) return NextResponse.json({ imported, skipped });
      const messages = await imap.fetchAll(uids, { source: true }, { uid: true });

      for (const item of messages) {
        if (!item.source) continue;
        const parsed = await simpleParser(item.source);
        const from = parsed.from?.value[0]?.address?.toLowerCase();
        if (!from || from === user.toLowerCase()) continue;
        const providerMessageId = parsed.messageId ?? `zoho-uid-${item.uid}`;
        const subject = parsed.subject?.trim() || "Email reply";
        const body = parsed.text?.trim() || parsed.html?.toString().replace(/<[^>]+>/g, " ").trim() || "(No text content)";

        const existing = await admin.from("email_messages").select("id").eq("provider_message_id", providerMessageId).maybeSingle();
        if (existing.data) { skipped++; continue; }

        if (/mailer-daemon|postmaster/i.test(from) || /delivery (status|failure)|undeliverable|returned mail/i.test(subject)) {
          const addresses = [...body.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
            .map((match) => match[0].toLowerCase())
            .filter((address) => address !== user.toLowerCase() && address !== from);
          const bouncedAddress = addresses[0];
          if (bouncedAddress) {
            const bouncedContact = await admin.from("contacts").select("id, workspace_id, company_id").eq("email", bouncedAddress).limit(1).maybeSingle();
            if (bouncedContact.data) {
              await admin.from("contacts").update({ bounced: true }).eq("id", bouncedContact.data.id);
              const latestOutbound = await admin.from("email_messages").select("id").eq("contact_id", bouncedContact.data.id).eq("direction", "outbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
              if (latestOutbound.data) await admin.from("email_messages").update({ status: "bounced", bounce_reason: subject }).eq("id", latestOutbound.data.id);
              await admin.from("activities").insert({
                workspace_id: bouncedContact.data.workspace_id,
                type: "email_bounced",
                contact_id: bouncedContact.data.id,
                company_id: bouncedContact.data.company_id,
                summary: `Email bounced for ${bouncedAddress}`,
              });
              imported++;
              continue;
            }
          }
        }

        const contactResult = await admin.from("contacts").select("id, workspace_id, company_id").eq("email", from).limit(1).maybeSingle();
        const contact = contactResult.data;
        if (!contact) { skipped++; continue; }

        let threadId: string | undefined;
        if (parsed.inReplyTo) {
          const parent = await admin.from("email_messages").select("thread_id").eq("provider_message_id", parsed.inReplyTo).maybeSingle();
          threadId = parent.data?.thread_id;
        }
        if (!threadId) {
          const latest = await admin.from("threads").select("id").eq("contact_id", contact.id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
          threadId = latest.data?.id;
        }

        const receivedAt = parsed.date?.toISOString() ?? new Date().toISOString();
        const classification = classifyReply(body, subject);

        if (!threadId) {
          threadId = `th_${nanoid(12)}`;
          const created = await admin.from("threads").insert({
            id: threadId,
            workspace_id: contact.workspace_id,
            contact_id: contact.id,
            company_id: contact.company_id,
            subject: subject.replace(/^(re|fw|fwd):\s*/i, ""),
            state: "open",
            sentiment: classification.sentiment,
            interested: classification.sentiment === "positive",
            meeting_booked: false,
            last_message_at: receivedAt,
            unread: true,
          });
          if (created.error) { skipped++; continue; }
        }

        const messageId = `msg_${nanoid(12)}`;
        const inserted = await admin.from("email_messages").insert({
          id: messageId,
          workspace_id: contact.workspace_id,
          thread_id: threadId,
          contact_id: contact.id,
          company_id: contact.company_id,
          direction: "inbound",
          status: "received",
          subject,
          body,
          from_email: from,
          to_email: user,
          provider_message_id: providerMessageId,
          sent_at: receivedAt,
          replied_at: receivedAt,
          word_count: body.split(/\s+/).filter(Boolean).length,
        });
        if (inserted.error) { skipped++; continue; }

        await admin.from("threads").update({
          state: "open",
          sentiment: classification.sentiment,
          interested: classification.sentiment === "positive",
          last_message_at: receivedAt,
          unread: true,
        }).eq("id", threadId);
        if (classification.intent === "unsubscribe") {
          await admin.from("contacts").update({ unsubscribed: true }).eq("id", contact.id);
        }
        await admin.from("activities").insert({
          workspace_id: contact.workspace_id,
          type: classification.sentiment === "positive" ? "positive_reply" : "reply_received",
          contact_id: contact.id,
          company_id: contact.company_id,
          summary: `Reply received from ${from}`,
          meta: { intent: classification.intent, confidence: classification.confidence },
        });
        imported++;
      }
    } finally {
      lock.release();
    }
    return NextResponse.json({ imported, skipped });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "IMAP sync failed." }, { status: 502 });
  } finally {
    if (imap.usable) await imap.logout().catch(() => undefined);
  }
}
