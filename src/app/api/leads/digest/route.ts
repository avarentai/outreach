/* =========================================================================
 * POST /api/leads/digest   (relay a prospect list to the operator's inbox)
 *
 * Auth: WORKER_SECRET (x-worker-secret or Bearer). Emails the provided { body,
 * subject? } to ALERT_EMAIL via Resend. Used by the morning lead-discovery
 * routine, which composes the list (via web search) and posts it here. Fixed
 * recipient (ALERT_EMAIL) — cannot be used to mail third parties. No outbound
 * campaign mail, NO AI in this route.
 * ========================================================================= */

import { NextResponse } from "next/server";

import { getAdapter } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET ?? process.env.WORKER_SECRET;
  if (!expected) return false;
  return (
    req.headers.get("x-worker-secret") === expected ||
    req.headers.get("authorization") === `Bearer ${expected}`
  );
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const to = process.env.ALERT_EMAIL;
  if (!to) {
    return NextResponse.json({ error: "ALERT_EMAIL not configured" }, { status: 503 });
  }

  let body = "";
  let subject = "";
  try {
    const json = (await req.json()) as { body?: string; subject?: string };
    body = String(json.body ?? "");
    subject = String(json.subject ?? "");
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const finalSubject = subject.trim() || "Avarent — today's prospects to review";
  const from = process.env.ALERT_FROM ?? "Avarent Ops <noreply@avarent.app>";
  const adapter = getAdapter({ provider: "resend" });
  if (!adapter) {
    return NextResponse.json({ error: "no email transport (set RESEND_API_KEY)" }, { status: 503 });
  }

  const res = await adapter.send({ from, to, subject: finalSubject, text: body });
  return NextResponse.json({
    sent: res.ok,
    to,
    providerMessageId: res.providerMessageId,
    error: res.ok ? undefined : res.error,
  });
}
