/* =========================================================================
 * GET /api/status   (read-only health snapshot for the nightly Claude routine)
 *
 * Auth: AGENT_SECRET via `x-agent-secret` header or `Authorization: Bearer`,
 * OR an authenticated Supabase session (so it's viewable in-app). Distinct from
 * WORKER_SECRET so the routine's key can READ health but can never trigger sends.
 *
 * Aggregates the outbound system's state with the service-role admin client
 * (bypasses RLS, global across the workspace). PURE READS — no writes, no
 * sends, NO AI. Safe no-op in demo mode (no service key). The routine reads
 * `health` + `flags` for a verdict, or the raw numbers to reason further.
 * ========================================================================= */

import { NextResponse } from "next/server";

import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

function agentAuthorized(req: Request): boolean {
  const secret = process.env.AGENT_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("x-agent-secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}`
  );
}

async function authorized(req: Request): Promise<boolean> {
  if (agentAuthorized(req)) return true;
  const client = await createServerSupabase();
  if (!client) return false;
  const { data } = await client.auth.getUser();
  return !!data.user;
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}

async function handler(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createAdminSupabase();
  if (!sb) {
    return NextResponse.json({
      mode: "demo",
      note: "No Supabase service key configured — /api/status reports live mode only.",
    });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dayStartIso = (() => {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const h24 = new Date(now - 24 * 3600_000).toISOString();
  const d7 = new Date(now - 7 * 24 * 3600_000).toISOString();

  // Count queries (head:true → no rows transferred, just the count).
  const [
    qPending,
    qDue,
    qLocked,
    qRetry,
    mToday,
    m24,
    m7,
    mFail24,
    mBounced7,
    mOpen7,
    mClick7,
    mInbound24,
    tPositiveOpen,
    tNegativeOpen,
    tUnread,
    tMeetings,
    cActive,
    cPaused,
  ] = await Promise.all([
    sb.from("email_queue").select("*", { count: "exact", head: true }),
    sb.from("email_queue").select("*", { count: "exact", head: true }).lte("send_after", nowIso).is("locked_at", null),
    sb.from("email_queue").select("*", { count: "exact", head: true }).not("locked_at", "is", null),
    sb.from("email_queue").select("*", { count: "exact", head: true }).gt("attempts", 0),
    sb.from("email_messages").select("*", { count: "exact", head: true }).gte("sent_at", dayStartIso),
    sb.from("email_messages").select("*", { count: "exact", head: true }).gte("sent_at", h24),
    sb.from("email_messages").select("*", { count: "exact", head: true }).gte("sent_at", d7),
    sb.from("email_messages").select("*", { count: "exact", head: true }).in("status", ["failed", "bounced"]).gte("created_at", h24),
    sb.from("email_messages").select("*", { count: "exact", head: true }).eq("status", "bounced").gte("created_at", d7),
    sb.from("email_messages").select("*", { count: "exact", head: true }).not("opened_at", "is", null).gte("opened_at", d7),
    sb.from("email_messages").select("*", { count: "exact", head: true }).not("clicked_at", "is", null).gte("clicked_at", d7),
    sb.from("email_messages").select("*", { count: "exact", head: true }).eq("direction", "inbound").gte("created_at", h24),
    sb.from("threads").select("*", { count: "exact", head: true }).eq("sentiment", "positive").eq("state", "open"),
    sb.from("threads").select("*", { count: "exact", head: true }).eq("sentiment", "negative").eq("state", "open"),
    sb.from("threads").select("*", { count: "exact", head: true }).eq("unread", true),
    sb.from("threads").select("*", { count: "exact", head: true }).eq("meeting_booked", true),
    sb.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
    sb.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "paused"),
  ]);

  // Small detail fetches.
  const [oldestDueRes, lastSendRes, campaignListRes, accountRowsRes] = await Promise.all([
    sb.from("email_queue").select("send_after").lte("send_after", nowIso).is("locked_at", null).order("send_after", { ascending: true }).limit(1).maybeSingle(),
    sb.from("email_messages").select("sent_at").not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("campaigns").select("id, name, status").in("status", ["active", "paused"]).order("started_at", { ascending: false }).limit(15),
    sb.from("sending_accounts").select("id, label, from_email, active, daily_limit, warmup_enabled, reputation_score, dmarc").limit(20),
  ]);

  // Per-account daily usage.
  const accountRows = accountRowsRes.data ?? [];
  const accounts = await Promise.all(
    accountRows.map(async (a) => {
      const { count } = await sb
        .from("email_messages")
        .select("*", { count: "exact", head: true })
        .eq("sending_account_id", a.id)
        .gte("sent_at", dayStartIso);
      const sentToday = count ?? 0;
      return {
        label: a.label,
        fromEmail: a.from_email,
        active: a.active,
        dailyLimit: a.daily_limit,
        sentToday,
        pctUsed: a.daily_limit ? Math.round((sentToday / a.daily_limit) * 100) : 0,
        warmup: a.warmup_enabled,
        reputation: a.reputation_score,
        dmarcSet: !!a.dmarc,
      };
    }),
  );

  const num = (r: { count: number | null }) => r.count ?? 0;
  const sent7 = num(m7);
  const bounced7 = num(mBounced7);
  const denom = sent7 + bounced7;
  const bounceRatePct = denom > 0 ? Math.round((bounced7 / denom) * 1000) / 10 : 0;
  const oldestDueAgeMin = oldestDueRes.data?.send_after
    ? Math.max(0, Math.round((now - new Date(oldestDueRes.data.send_after).getTime()) / 60000))
    : 0;
  const positiveOpen = num(tPositiveOpen);
  const failed24 = num(mFail24);

  // Deterministic health verdict + human-readable flags for the routine.
  const order = { green: 0, yellow: 1, red: 2 } as const;
  let health: "green" | "yellow" | "red" = "green";
  const bump = (lvl: "yellow" | "red") => {
    if (order[lvl] > order[health]) health = lvl;
  };
  const flags: string[] = [];

  if (denom >= 20 && bounceRatePct >= 5) {
    flags.push(`Bounce rate ${bounceRatePct}% over 7d (${bounced7}/${denom}) — pause sending and investigate the list.`);
    bump("red");
  } else if (denom >= 20 && bounceRatePct >= 2) {
    flags.push(`Bounce rate ${bounceRatePct}% over 7d — watch closely.`);
    bump("yellow");
  }
  if (oldestDueAgeMin >= 360) {
    flags.push(`Oldest due email has waited ${oldestDueAgeMin} min — the worker cron may be stuck.`);
    bump("red");
  } else if (oldestDueAgeMin >= 120) {
    flags.push(`Oldest due email has waited ${oldestDueAgeMin} min — queue draining slowly.`);
    bump("yellow");
  }
  if (positiveOpen > 0) {
    flags.push(`${positiveOpen} positive repl${positiveOpen === 1 ? "y is" : "ies are"} open and awaiting a response.`);
    bump("yellow");
  }
  if (failed24 > 0) {
    flags.push(`${failed24} message(s) failed or bounced in the last 24h.`);
    bump("yellow");
  }
  for (const a of accounts) {
    if (a.active && !a.dmarcSet) {
      flags.push(`Sending account ${a.fromEmail} has no DMARC record set.`);
      bump("yellow");
    }
  }
  if (flags.length === 0) flags.push("All systems nominal.");

  return NextResponse.json({
    generatedAt: nowIso,
    mode: "live",
    health,
    flags,
    queue: {
      pending: num(qPending),
      dueNow: num(qDue),
      locked: num(qLocked),
      retrying: num(qRetry),
      oldestDueAgeMin,
    },
    sends: {
      today: num(mToday),
      last24h: num(m24),
      last7d: sent7,
      failedLast24h: failed24,
    },
    deliverability: {
      bounced7d: bounced7,
      bounceRatePct,
      opens7d: num(mOpen7),
      clicks7d: num(mClick7),
      accounts,
    },
    replies: {
      inboundLast24h: num(mInbound24),
      positiveOpen,
      negativeOpen: num(tNegativeOpen),
      unread: num(tUnread),
      meetingsBooked: num(tMeetings),
    },
    campaigns: {
      active: num(cActive),
      paused: num(cPaused),
      list: campaignListRes.data ?? [],
    },
    worker: {
      lastSendAt: lastSendRes.data?.sent_at ?? null,
      dbReachable: true,
    },
    thresholds: {
      bounceRateYellowPct: 2,
      bounceRateRedPct: 5,
      queueAgeYellowMin: 120,
      queueAgeRedMin: 360,
    },
  });
}
