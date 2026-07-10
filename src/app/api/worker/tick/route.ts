/* =========================================================================
 * POST /api/worker/tick   (protected by x-worker-secret)
 * Background worker — drains the email_queue. Deterministic scheduling was
 * done at enqueue time; this route performs transport, retries, and status
 * updates. Trigger on a schedule (Vercel Cron / any cron / GitHub Action).
 *
 * In DEMO mode (no Supabase service key) it returns a no-op so local cron
 * setups don't error. Real sends require RESEND_API_KEY or SMTP_* + live DB.
 * ========================================================================= */

import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getAdapter } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ATTEMPTS = 4;
const BACKOFF_MINUTES = [1, 5, 30, 120];
const BATCH = 25;

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

async function handler(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  const bearer = req.headers.get("authorization");
  const expectedBearer = `Bearer ${process.env.CRON_SECRET ?? process.env.WORKER_SECRET}`;
  const authorized =
    (!!process.env.WORKER_SECRET && secret === process.env.WORKER_SECRET) ||
    (!!(process.env.CRON_SECRET ?? process.env.WORKER_SECRET) && bearer === expectedBearer);
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createAdminSupabase();
  if (!sb) {
    return NextResponse.json({
      mode: "demo",
      processed: 0,
      note: "No Supabase service key configured — worker idle. Set SUPABASE_SERVICE_ROLE_KEY + a sending provider to enable real sends.",
    });
  }

  const nowIso = new Date().toISOString();

  // 1. Claim a batch of due, unlocked queue rows.
  const { data: due, error } = await sb
    .from("email_queue")
    .select("id, message_id, attempts")
    .is("locked_at", null)
    .lte("send_after", nowIso)
    .order("send_after", { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ processed: 0 });

  const ids = due.map((d) => d.id);
  await sb.from("email_queue").update({ locked_at: nowIso }).in("id", ids);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const dailyCount = new Map<string, number>();

  for (const row of due) {
    const { data: msg } = await sb
      .from("email_messages")
      .select("*")
      .eq("id", row.message_id)
      .single();
    if (!msg) {
      await sb.from("email_queue").delete().eq("id", row.id);
      continue;
    }

    // Stop-on-reply: skip if the thread already got a reply.
    const { data: thread } = await sb
      .from("threads")
      .select("id, sentiment, meeting_booked")
      .eq("id", msg.thread_id)
      .single();
    if (thread && (thread.sentiment !== "unclassified" || thread.meeting_booked)) {
      await sb.from("email_queue").delete().eq("id", row.id);
      await sb.from("email_messages").update({ status: "failed", bounce_reason: "stopped: reply received" }).eq("id", msg.id);
      skipped++;
      continue;
    }

    // Load sending account + enforce daily limit.
    const { data: account } = await sb
      .from("sending_accounts")
      .select("*")
      .eq("id", msg.sending_account_id)
      .single();
    if (!account || !account.active) {
      await rescheduleOrFail(sb, row, msg, "sending account unavailable");
      failed++;
      continue;
    }
    const usedToday = dailyCount.get(account.id) ?? (await sentTodayCount(sb, account.id));
    if (usedToday >= account.daily_limit) {
      // push to tomorrow's window
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      await sb.from("email_queue").update({ locked_at: null, send_after: tomorrow.toISOString() }).eq("id", row.id);
      skipped++;
      continue;
    }

    const adapter = getAdapter({
      provider: account.provider,
      smtp: account.smtp_host
        ? { host: account.smtp_host, port: account.smtp_port, user: account.smtp_user, pass: account.smtp_pass }
        : undefined,
    });
    if (!adapter) {
      await rescheduleOrFail(sb, row, msg, "no transport configured");
      failed++;
      continue;
    }

    const res = await adapter.send({
      from: `${account.from_name} <${account.from_email}>`,
      to: msg.to_email,
      subject: msg.subject,
      text: msg.body,
      replyTo: account.from_email,
      headers: { "X-Avarent-Message-Id": msg.id },
    });

    if (res.ok) {
      await sb
        .from("email_messages")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: res.providerMessageId, attempts: (msg.attempts ?? 0) + 1 })
        .eq("id", msg.id);
      await sb.from("email_queue").delete().eq("id", row.id);
      await sb.from("activities").insert({
        workspace_id: msg.workspace_id,
        type: "email_sent",
        contact_id: msg.contact_id,
        company_id: msg.company_id,
        campaign_id: msg.campaign_id,
        summary: `Email sent to ${msg.to_email}`,
      });
      dailyCount.set(account.id, usedToday + 1);
      sent++;
    } else {
      await rescheduleOrFail(sb, row, msg, res.error ?? "send failed");
      failed++;
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed, skipped });
}

async function sentTodayCount(sb: NonNullable<ReturnType<typeof createAdminSupabase>>, accountId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await sb
    .from("email_messages")
    .select("id", { count: "exact", head: true })
    .eq("sending_account_id", accountId)
    .gte("sent_at", start.toISOString());
  return count ?? 0;
}

async function rescheduleOrFail(
  sb: NonNullable<ReturnType<typeof createAdminSupabase>>,
  row: { id: string; attempts: number },
  msg: { id: string },
  reason: string,
) {
  const attempts = (row.attempts ?? 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await sb.from("email_queue").delete().eq("id", row.id);
    await sb.from("email_messages").update({ status: "failed", bounce_reason: reason }).eq("id", msg.id);
    return;
  }
  const wait = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
  const next = new Date(Date.now() + wait * 60000).toISOString();
  await sb.from("email_queue").update({ locked_at: null, attempts, send_after: next, last_error: reason }).eq("id", row.id);
}
