/* =========================================================================
 * POST /api/notify   (always-on operator email — digest or alert)
 *
 * Reads the health snapshot from /api/status (using AGENT_SECRET) and emails it
 * to ALERT_EMAIL via Resend. Runs from a daily GitHub Action, independent of the
 * Claude desktop app. Auth: WORKER_SECRET (x-worker-secret or Bearer) — the same
 * key the cron already uses. `?mode=alert` emails ONLY when health != green;
 * default `?mode=digest` always emails. This notifies the OPERATOR (you), never a
 * prospect — it sends no outbound campaign mail. Safe no-op when unconfigured.
 * NO AI.
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

interface Snapshot {
  health?: string;
  flags?: string[];
  generatedAt?: string;
  sends?: { today?: number; last7d?: number };
  queue?: { pending?: number; dueNow?: number; oldestDueAgeMin?: number };
  deliverability?: {
    bounceRatePct?: number;
    opens7d?: number;
    clicks7d?: number;
    accounts?: Array<{
      fromEmail?: string;
      sentToday?: number;
      dailyLimit?: number;
      pctUsed?: number;
      warmup?: boolean;
      dmarcSet?: boolean;
    }>;
  };
  replies?: { positiveOpen?: number; inboundLast24h?: number; meetingsBooked?: number };
  campaigns?: { active?: number; paused?: number };
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

async function handler(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const to = process.env.ALERT_EMAIL;
  if (!to) {
    return NextResponse.json({ error: "ALERT_EMAIL not configured" }, { status: 503 });
  }

  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const agentSecret = process.env.AGENT_SECRET ?? "";

  // Pull the same health snapshot the Claude routine reads.
  let snap: Snapshot;
  try {
    const r = await fetch(`${base}/api/status`, {
      headers: { "x-agent-secret": agentSecret },
      cache: "no-store",
    });
    if (!r.ok) {
      snap = { health: "red", flags: [`Health endpoint returned HTTP ${r.status} — the deployment may be down.`] };
    } else {
      snap = (await r.json()) as Snapshot;
    }
  } catch (e) {
    snap = { health: "red", flags: [`Could not reach the health endpoint: ${(e as Error).message}`] };
  }

  const health = snap.health ?? "red";
  const mode = new URL(req.url).searchParams.get("mode") === "alert" ? "alert" : "digest";
  if (mode === "alert" && health === "green") {
    return NextResponse.json({ sent: false, health, reason: "alert mode: nothing to report" });
  }

  const emoji = health === "green" ? "🟢" : health === "yellow" ? "🟡" : "🔴";
  const kind = health === "green" ? "Daily digest" : "ALERT";
  const sentToday = snap.sends?.today ?? 0;
  const pending = snap.queue?.pending ?? 0;
  const subject = `[Avarent ${emoji}] ${kind} — ${sentToday} sent today, ${pending} queued`;

  const flags = snap.flags ?? [];
  const accounts = snap.deliverability?.accounts ?? [];
  const text = [
    `Avarent Outbound — ${kind} (${health.toUpperCase()})`,
    "",
    ...(flags.length ? flags.map((f) => `• ${f}`) : ["• (no flags)"]),
    "",
    `Sent today: ${sentToday}   |   Last 7d: ${snap.sends?.last7d ?? 0}`,
    `Queue: ${pending} pending, ${snap.queue?.dueNow ?? 0} due now (oldest ${snap.queue?.oldestDueAgeMin ?? 0} min)`,
    `Deliverability: ${snap.deliverability?.bounceRatePct ?? 0}% bounce (7d), ${snap.deliverability?.opens7d ?? 0} opens, ${snap.deliverability?.clicks7d ?? 0} clicks`,
    `Replies: ${snap.replies?.positiveOpen ?? 0} positive waiting, ${snap.replies?.inboundLast24h ?? 0} inbound (24h), ${snap.replies?.meetingsBooked ?? 0} meetings booked`,
    `Campaigns: ${snap.campaigns?.active ?? 0} active, ${snap.campaigns?.paused ?? 0} paused`,
    "",
    ...accounts.map(
      (a) =>
        `Sender ${a.fromEmail ?? "?"}: ${a.sentToday ?? 0}/${a.dailyLimit ?? 0} today (${a.pctUsed ?? 0}%), warmup ${a.warmup ? "on" : "off"}, DMARC ${a.dmarcSet ? "set" : "MISSING"}`,
    ),
    "",
    "Open the app: https://avarent-outbound.vercel.app",
    snap.generatedAt ? `Generated ${snap.generatedAt}` : "",
  ].join("\n");

  const from = process.env.ALERT_FROM ?? "Avarent Ops <noreply@avarent.app>";
  const adapter = getAdapter({ provider: "resend" });
  if (!adapter) {
    return NextResponse.json({ error: "no email transport (set RESEND_API_KEY)" }, { status: 503 });
  }

  const res = await adapter.send({ from, to, subject, text });
  return NextResponse.json({
    sent: res.ok,
    health,
    to,
    providerMessageId: res.providerMessageId,
    error: res.ok ? undefined : res.error,
  });
}
