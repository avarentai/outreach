/* =========================================================================
 * GET /api/leads/act   (tap-to-approve handler for the morning lead digest)
 *
 * Links come from /api/leads/digest:
 *   ?d=add&c=<payload>&s=<sig>     → verify HMAC (WORKER_SECRET), create the
 *                                     company as a prospect (deduped by domain)
 *                                     AND — when the payload carries an email —
 *                                     create a contact and enroll it in a DRAFT
 *                                     campaign, ready for one-tap Activate.
 *   ?d=addall&c=<payload>&s=<sig>  → same, for the whole batch
 *   ?d=skip&n=<name>               → no-op confirmation
 * Auth = the HMAC signature; the link lives only in the operator's private inbox.
 * Renders a small HTML page (clicked from an email). Writes via the admin client.
 *
 * Nothing is ever sent here: contacts land in a DRAFT campaign carrying a
 * starter first-touch template the operator reviews and must Activate in the
 * app. Enrollment is reversible; activation stays the human gate. NO AI.
 * ========================================================================= */

import { createHmac, randomUUID } from "crypto";

import { createAdminSupabase } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 30;

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** The dedicated draft campaign auto-enrolled prospects land in. */
const STARTER_CAMPAIGN_NAME = "Inbound — auto-enrolled prospects";

/* ------------------------------------------------------------------ */
/* Starter outreach copy — a DRAFT the operator reviews & edits in the */
/* app before ever activating. Uses the deterministic {{merge}} vars   */
/* (see lib/engines/merge.ts). Nothing sends until Activate.           */
/* ------------------------------------------------------------------ */

const STARTER_SUBJECT = "Adverse-action reasons under CFPB Circular 2026-03";
const STARTER_BODY = `Hi {{first_name}},

CFPB Circular 2026-03 is explicit: lenders using AI/ML underwriting have to give applicants specific, accurate adverse-action reasons — there is no "advanced technology" exception.

Avarent generates regulation-cited adverse-action notices (ECOA/Reg B, FCRA) straight from your model's outputs, and runs fair-lending and explainability checks so the reasons you send are both compliant and faithful to the model.

If {{company}} is underwriting with ML, would a short look be worthwhile? Happy to walk through how teams are handling the Circular.

{{sender_name}}
Avarent

Reply "no thanks" and I won't follow up.`;

function sign(c: string): string {
  return createHmac("sha256", process.env.WORKER_SECRET ?? "x").update(c).digest("base64url");
}

function verify(c: string | null, s: string | null): unknown | null {
  if (!c || !s) return null;
  if (sign(c) !== s) return null;
  try {
    return JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function domainOf(name: string, website: string): string {
  const w = website.trim();
  if (w) {
    return w.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
  }
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function page(emoji: string, title: string, msg: string): Response {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
    `<body style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#0b1020;color:#e7ecf5;display:flex;min-height:100vh;align-items:center;justify-content:center">` +
    `<div style="max-width:440px;padding:36px;text-align:center">` +
    `<div style="font-size:44px;line-height:1">${emoji}</div>` +
    `<h1 style="font-size:20px;margin:14px 0 8px">${esc(title)}</h1>` +
    `<p style="color:#9aa7bd;line-height:1.55;margin:0 0 20px">${esc(msg)}</p>` +
    `<a href="https://avarent-outbound.vercel.app" style="color:#6ea8fe;text-decoration:none">Open Avarent →</a>` +
    `</div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function firstWorkspaceId(sb: Admin): Promise<string | null> {
  const { data } = await sb.from("workspaces").select("id").limit(1).maybeSingle();
  return data?.id ?? null;
}

/**
 * Upsert a company as a prospect (dedupe by domain). Returns its id so a
 * contact can be attached, or null on error.
 */
async function upsertCompany(
  sb: Admin,
  workspaceId: string,
  name: string,
  website: string,
  extra: { industry?: string; why?: string; title?: string },
): Promise<{ status: "added" | "exists" | "error"; companyId: string | null }> {
  const domain = domainOf(name, website);
  const { data: existing } = await sb
    .from("companies")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("domain", domain)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return { status: "exists", companyId: existing.id };

  const notes = [
    extra.why ? `Why: ${extra.why}` : "",
    extra.title ? `Target contact: ${extra.title}` : "",
    "Added from the morning lead digest.",
  ]
    .filter(Boolean)
    .join("\n");

  const companyId = randomUUID();
  const { error } = await sb.from("companies").insert({
    id: companyId,
    workspace_id: workspaceId,
    name,
    domain,
    website: website || null,
    industry: extra.industry || null,
    notes,
    status: "prospect",
  });
  return error ? { status: "error", companyId: null } : { status: "added", companyId };
}

/**
 * Resolve the draft campaign new contacts enroll into: an explicit
 * LEADS_CAMPAIGN_ID override, else the dedicated starter campaign (created
 * lazily, with a draft first-touch template + single-email sequence).
 */
async function resolveCampaignId(sb: Admin, workspaceId: string): Promise<string | null> {
  const envId = process.env.LEADS_CAMPAIGN_ID;
  if (envId) {
    const { data } = await sb
      .from("campaigns")
      .select("id")
      .eq("id", envId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data: existing } = await sb
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", STARTER_CAMPAIGN_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Lazily scaffold: template → sequence → draft campaign. All draft/editable.
  const templateId = randomUUID();
  const { error: te } = await sb.from("templates").insert({
    id: templateId,
    workspace_id: workspaceId,
    name: "[DRAFT] First touch — review before sending",
    category: "initial",
    subject: STARTER_SUBJECT,
    body: STARTER_BODY,
  });
  if (te) return null;

  const sequenceId = randomUUID();
  const steps = [{ id: randomUUID(), type: "email", templateId }];
  const { error: se } = await sb.from("sequences").insert({
    id: sequenceId,
    workspace_id: workspaceId,
    name: "Inbound first touch",
    steps: steps as unknown as Json,
  });
  if (se) return null;

  const campaignId = randomUUID();
  const { error: ce } = await sb.from("campaigns").insert({
    id: campaignId,
    workspace_id: workspaceId,
    name: STARTER_CAMPAIGN_NAME,
    status: "draft",
    sequence_id: sequenceId,
    sending_account_ids: [],
  });
  if (ce) return null;

  return campaignId;
}

/**
 * Create a contact for the company and enroll it in the campaign. Dedupe by
 * (workspace, email): an existing contact is enrolled if it wasn't already.
 */
async function enrollContact(
  sb: Admin,
  workspaceId: string,
  companyId: string,
  campaignId: string,
  c: { email: string; first: string; last: string; title?: string },
): Promise<"enrolled" | "exists" | "error"> {
  const { data: existing } = await sb
    .from("contacts")
    .select("id, campaign_id")
    .eq("workspace_id", workspaceId)
    .eq("email", c.email)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    if (!existing.campaign_id) {
      await sb.from("contacts").update({ campaign_id: campaignId }).eq("id", existing.id);
    }
    return "exists";
  }

  const { error } = await sb.from("contacts").insert({
    workspace_id: workspaceId,
    company_id: companyId,
    first_name: c.first || "",
    last_name: c.last || "",
    email: c.email,
    job_title: c.title || null,
    campaign_id: campaignId,
  });
  return error ? "error" : "enrolled";
}

async function logLead(sb: Admin, workspaceId: string, companyId: string, summary: string) {
  await sb.from("activities").insert({
    workspace_id: workspaceId,
    type: "lead_created",
    company_id: companyId,
    summary,
  });
}

interface AddPayload {
  n?: string;
  w?: string;
  i?: string;
  y?: string;
  t?: string;
  e?: string;
  f?: string;
  l?: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";

  if (d === "skip") {
    const n = url.searchParams.get("n") ?? "this company";
    return page("✕", "Skipped", `Skipped ${n}. Nothing was added.`);
  }

  const sb = createAdminSupabase();
  if (!sb) return page("•", "Not available", "Lead actions only work in live mode.");

  const payload = verify(url.searchParams.get("c"), url.searchParams.get("s"));
  if (!payload) return page("•", "Invalid link", "This approve link couldn't be verified.");

  const workspaceId = await firstWorkspaceId(sb);
  if (!workspaceId) return page("•", "Not available", "No workspace is configured yet.");

  if (d === "add") {
    const p = payload as AddPayload;
    if (!p.n) return page("•", "Invalid link", "Missing company.");

    const { status: cstatus, companyId } = await upsertCompany(sb, workspaceId, p.n, p.w ?? "", {
      industry: p.i,
      why: p.y,
      title: p.t,
    });
    if (cstatus === "error" || !companyId) {
      return page("•", "Couldn't add", "Something went wrong. Try again, or add it in the app.");
    }

    const email = (p.e ?? "").toLowerCase();
    let enrolled = false;
    if (email && EMAIL_RE.test(email)) {
      const campaignId = await resolveCampaignId(sb, workspaceId);
      if (campaignId) {
        const r = await enrollContact(sb, workspaceId, companyId, campaignId, {
          email,
          first: p.f ?? "",
          last: p.l ?? "",
          title: p.t,
        });
        enrolled = r === "enrolled" || r === "exists";
      }
    }

    await logLead(sb, workspaceId, companyId, `${p.n} added from the morning digest${email ? ` (${email})` : ""}`);

    if (enrolled) {
      return page(
        "✅",
        "Added & queued",
        `${p.n} is a prospect and ${email} is enrolled in your draft campaign "${STARTER_CAMPAIGN_NAME}". Review the copy, then Activate in the app to send.`,
      );
    }
    if (cstatus === "exists") {
      return page("✅", "Already in pipeline", `${p.n} was already there — no duplicate created.`);
    }
    return page(
      "✅",
      "Added",
      `${p.n} is now a prospect. No email was captured, so add a contact email in the app to enroll it for sending.`,
    );
  }

  if (d === "addall") {
    const arr = payload as AddPayload[];
    if (!Array.isArray(arr)) return page("•", "Invalid link", "Bad batch.");

    let campaignId: string | null = null; // resolved once, only if needed
    let added = 0;
    let exists = 0;
    let enrolled = 0;

    for (const c of arr) {
      if (!c?.n) continue;
      const { status, companyId } = await upsertCompany(sb, workspaceId, c.n, c.w ?? "", { title: c.t });
      if (status === "added") added++;
      else if (status === "exists") exists++;
      if (!companyId) continue;

      const email = (c.e ?? "").toLowerCase();
      if (email && EMAIL_RE.test(email)) {
        if (!campaignId) campaignId = await resolveCampaignId(sb, workspaceId);
        if (campaignId) {
          const r = await enrollContact(sb, workspaceId, companyId, campaignId, {
            email,
            first: c.f ?? "",
            last: c.l ?? "",
            title: c.t,
          });
          if (r === "enrolled") enrolled++;
        }
      }
      await logLead(sb, workspaceId, companyId, `${c.n} added from the morning digest (add all)`);
    }

    const parts = [`Added ${added}`];
    if (exists) parts.push(`${exists} already there`);
    if (enrolled) parts.push(`${enrolled} enrolled in "${STARTER_CAMPAIGN_NAME}" — review the copy & Activate to send`);
    return page("✅", "Added all", `${parts.join(", ")}.`);
  }

  return page("•", "Invalid link", "Unknown action.");
}
