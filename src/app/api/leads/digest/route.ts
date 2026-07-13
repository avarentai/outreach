/* =========================================================================
 * POST /api/leads/digest   (email the morning prospect list to the operator)
 *
 * Auth: WORKER_SECRET (x-worker-secret or Bearer). Fixed recipient ALERT_EMAIL.
 *
 * STRUCTURED mode — { companies: [{name, website?, industry?, why?, title?, contact?}],
 *   subject?, intro?, footer? } → emails a numbered list where each item has signed
 *   Add / Skip links. The token is an HMAC over WORKER_SECRET (stateless — no DB),
 *   so /api/leads/act can trust the click. Used by the lead-discovery routine.
 * PLAIN mode — { body, subject? } → emails body as-is.
 *
 * Emails the operator only; sends no outbound campaign mail. NO AI.
 * ========================================================================= */

import { createHmac } from "crypto";

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

function sign(c: string): string {
  return createHmac("sha256", process.env.WORKER_SECRET ?? "x").update(c).digest("base64url");
}

/** Signed query fragment "c=<payload>&s=<sig>" for an approve link. */
function token(obj: unknown): string {
  const c = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `c=${c}&s=${sign(c)}`;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Pull a clean email + optional person name out of the routine's free-text
 * `contact` (e.g. "Jane Smith <jane@acme.com>", "compliance@acme.com", or a
 * "find on LinkedIn" hint with no email). Fed into the signed Add link so
 * /api/leads/act can create a sendable contact without re-parsing.
 */
function parseContact(raw?: string): { email: string; first: string; last: string } {
  const s = (raw ?? "").trim();
  if (!s) return { email: "", first: "", last: "" };
  const email = s.match(EMAIL_RE)?.[0]?.toLowerCase() ?? "";
  let namePart = s.replace(EMAIL_RE, " ").replace(/[<>|,;—–-]+/g, " ").trim();
  // Drop hint phrases ("reach via LinkedIn", URLs) so they don't become names.
  if (/linkedin|https?:|www\.|\/|contact\s*page|\bfind\b|\bvia\b/i.test(namePart)) namePart = "";
  const parts = namePart.split(/\s+/).filter(Boolean).slice(0, 3);
  return { email, first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

interface CompanyInput {
  name?: string;
  website?: string;
  industry?: string;
  why?: string;
  title?: string;
  contact?: string;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const to = process.env.ALERT_EMAIL;
  if (!to) {
    return NextResponse.json({ error: "ALERT_EMAIL not configured" }, { status: 503 });
  }

  let payload: { companies?: CompanyInput[]; subject?: string; intro?: string; footer?: string; body?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const from = process.env.ALERT_FROM ?? "Avarent Ops <noreply@avarent.app>";
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const adapter = getAdapter({ provider: "resend" });
  if (!adapter) {
    return NextResponse.json({ error: "no email transport (set RESEND_API_KEY)" }, { status: 503 });
  }

  const companies = Array.isArray(payload.companies)
    ? payload.companies.filter((c): c is CompanyInput => !!c && !!c.name)
    : [];

  // PLAIN mode.
  if (companies.length === 0) {
    const body = String(payload.body ?? "");
    if (!body.trim()) {
      return NextResponse.json({ error: "companies or body required" }, { status: 400 });
    }
    const res = await adapter.send({
      from,
      to,
      subject: (payload.subject ?? "").trim() || "Avarent — prospects",
      text: body,
    });
    return NextResponse.json({ sent: res.ok, mode: "plain", to, error: res.ok ? undefined : res.error });
  }

  // STRUCTURED mode — numbered list with signed Add/Skip links.
  const lines: string[] = [];
  lines.push((payload.intro ?? "").trim() || `Avarent — ${companies.length} prospects to review`);
  lines.push("");
  lines.push('Tap "Add" on the ones you want — each becomes a prospect in your pipeline.');
  const allToken = token(
    companies.map((c) => {
      const pc = parseContact(c.contact);
      return { n: c.name, w: c.website ?? "", t: c.title ?? "", e: pc.email, f: pc.first, l: pc.last };
    }),
  );
  lines.push(`➕ Add ALL: ${base}/api/leads/act?d=addall&${allToken}`);
  lines.push("");

  companies.forEach((c, i) => {
    const pc = parseContact(c.contact);
    lines.push(`${i + 1}. ${c.name}${c.website ? "  |  " + c.website : ""}`);
    if (c.why) lines.push(`   Why: ${c.why}`);
    if (c.title) lines.push(`   Who: ${c.title}`);
    if (pc.email) lines.push(`   Email: ${pc.email}`);
    const t = token({ n: c.name, w: c.website ?? "", i: c.industry ?? "", y: c.why ?? "", t: c.title ?? "", e: pc.email, f: pc.first, l: pc.last });
    lines.push(`   ✅ Add:  ${base}/api/leads/act?d=add&${t}`);
    lines.push(`   ✕ Skip: ${base}/api/leads/act?d=skip&n=${encodeURIComponent(c.name ?? "")}`);
    lines.push("");
  });

  if ((payload.footer ?? "").trim()) {
    lines.push((payload.footer ?? "").trim());
  }

  const res = await adapter.send({
    from,
    to,
    subject: (payload.subject ?? "").trim() || `Avarent — ${companies.length} prospects to review`,
    text: lines.join("\n"),
  });
  return NextResponse.json({
    sent: res.ok,
    mode: "structured",
    count: companies.length,
    to,
    error: res.ok ? undefined : res.error,
  });
}
