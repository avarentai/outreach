/* =========================================================================
 * GET /api/leads/act   (tap-to-approve handler for the morning lead digest)
 *
 * Links come from /api/leads/digest:
 *   ?d=add&c=<payload>&s=<sig>     → verify HMAC (WORKER_SECRET), create the
 *                                     company as a prospect (deduped by domain)
 *   ?d=addall&c=<payload>&s=<sig>  → same, for the whole batch
 *   ?d=skip&n=<name>               → no-op confirmation
 * Auth = the HMAC signature; the link lives only in the operator's private inbox.
 * Renders a small HTML page (clicked from an email). Writes via the admin client.
 * NO AI.
 * ========================================================================= */

import { createHmac } from "crypto";

import { createAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

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

async function addCompany(
  sb: Admin,
  name: string,
  website: string,
  extra: { industry?: string; why?: string; title?: string },
): Promise<"added" | "exists" | "error"> {
  const { data: ws } = await sb.from("workspaces").select("id").limit(1).maybeSingle();
  const workspaceId = ws?.id;
  if (!workspaceId) return "error";
  const domain = domainOf(name, website);
  const { data: existing } = await sb
    .from("companies")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("domain", domain)
    .limit(1)
    .maybeSingle();
  if (existing) return "exists";
  const notes = [
    extra.why ? `Why: ${extra.why}` : "",
    extra.title ? `Target contact: ${extra.title}` : "",
    "Added from the morning lead digest.",
  ]
    .filter(Boolean)
    .join("\n");
  const { error } = await sb.from("companies").insert({
    workspace_id: workspaceId,
    name,
    domain,
    website: website || null,
    industry: extra.industry || null,
    notes,
    status: "prospect",
  });
  return error ? "error" : "added";
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

  if (d === "add") {
    const p = payload as { n?: string; w?: string; i?: string; y?: string; t?: string };
    if (!p.n) return page("•", "Invalid link", "Missing company.");
    const r = await addCompany(sb, p.n, p.w ?? "", { industry: p.i, why: p.y, title: p.t });
    if (r === "added") return page("✅", "Added", `${p.n} is now a prospect in your Avarent pipeline.`);
    if (r === "exists") return page("✅", "Already in pipeline", `${p.n} was already there — no duplicate created.`);
    return page("•", "Couldn't add", "Something went wrong. Try again, or add it in the app.");
  }

  if (d === "addall") {
    const arr = payload as Array<{ n?: string; w?: string; t?: string }>;
    if (!Array.isArray(arr)) return page("•", "Invalid link", "Bad batch.");
    let added = 0;
    let exists = 0;
    for (const c of arr) {
      if (!c?.n) continue;
      const r = await addCompany(sb, c.n, c.w ?? "", { title: c.t });
      if (r === "added") added++;
      else if (r === "exists") exists++;
    }
    return page("✅", "Added all", `Added ${added} to your pipeline${exists ? `, ${exists} already there` : ""}.`);
  }

  return page("•", "Invalid link", "Unknown action.");
}
