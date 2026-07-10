/* =========================================================================
 * Website crawler — deterministic parsing primitives. NO AI.
 * Pure functions operate on fetched HTML; the orchestrator (server route or
 * demo simulator) supplies the HTML. Handles URL normalization, page
 * classification, email/social extraction, tech-stack signatures, dedup.
 * ========================================================================= */

import type { CrawlPage, TechDetection } from "../types";

/* --------------------------- domain / url helpers ------------------------- */

export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  return s;
}

export function toAbsoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function sameHost(url: string, host: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, "") === host.replace(/^www\./, "");
  } catch {
    return false;
  }
}

/* ------------------------------ page classify ----------------------------- */

const PAGE_SIGNATURES: { type: CrawlPage["type"]; patterns: RegExp[] }[] = [
  { type: "contact", patterns: [/contact/i, /get-in-touch/i, /reach-us/i] },
  { type: "about", patterns: [/about/i, /who-we-are/i, /our-story/i, /company/i] },
  { type: "careers", patterns: [/careers?/i, /jobs?/i, /join-us/i, /work-with-us/i, /hiring/i] },
  { type: "team", patterns: [/team/i, /leadership/i, /people/i, /our-team/i, /staff/i] },
  { type: "product", patterns: [/product/i, /solutions?/i, /platform/i, /features?/i, /pricing/i] },
];

export function classifyUrl(url: string, title?: string): CrawlPage["type"] {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep raw */
  }
  if (path === "/" || path === "") return "home";
  const hay = `${path} ${title ?? ""}`;
  for (const sig of PAGE_SIGNATURES) {
    if (sig.patterns.some((p) => p.test(hay))) return sig.type;
  }
  return "other";
}

/* ------------------------------ extraction -------------------------------- */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ROLE_PREFIXES = /^(info|sales|contact|hello|support|admin|team|careers|jobs|press|media)@/i;

/** Extract & dedupe email addresses, filtering obvious asset filenames. */
export function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const raw of html.match(EMAIL_RE) ?? []) {
    const email = raw.toLowerCase();
    // filter out things like sentry@2x.png or wixpress noise
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) continue;
    if (/@(sentry|example|wix|sentry\.io|domain)\./i.test(email)) continue;
    found.add(email);
  }
  return [...found];
}

/** Rank emails: personal-looking addresses before role addresses. */
export function rankEmails(emails: string[]): string[] {
  return [...emails].sort((a, b) => {
    const ar = ROLE_PREFIXES.test(a) ? 1 : 0;
    const br = ROLE_PREFIXES.test(b) ? 1 : 0;
    return ar - br;
  });
}

const SOCIAL_HOSTS: { platform: string; re: RegExp }[] = [
  { platform: "linkedin", re: /linkedin\.com\/(company|in)\/[^"'\s)]+/i },
  { platform: "twitter", re: /(?:twitter|x)\.com\/[^"'\s)/]+/i },
  { platform: "facebook", re: /facebook\.com\/[^"'\s)]+/i },
  { platform: "instagram", re: /instagram\.com\/[^"'\s)]+/i },
  { platform: "youtube", re: /youtube\.com\/[^"'\s)]+/i },
  { platform: "github", re: /github\.com\/[^"'\s)]+/i },
];

export function extractSocialLinks(html: string): { platform: string; url: string }[] {
  const out = new Map<string, string>();
  for (const { platform, re } of SOCIAL_HOSTS) {
    const m = html.match(re);
    if (m && !out.has(platform)) out.set(platform, "https://" + m[0].replace(/^https?:\/\//, ""));
  }
  return [...out.entries()].map(([platform, url]) => ({ platform, url }));
}

/* ------------------------------ tech signatures --------------------------- */

const TECH_SIGNATURES: { name: string; category: string; patterns: RegExp[] }[] = [
  { name: "Next.js", category: "Framework", patterns: [/_next\/static/i, /__NEXT_DATA__/] },
  { name: "React", category: "Framework", patterns: [/data-reactroot/i, /react\.production/i] },
  { name: "WordPress", category: "CMS", patterns: [/wp-content/i, /wp-includes/i] },
  { name: "Webflow", category: "CMS", patterns: [/webflow/i, /w-mod-js/i] },
  { name: "Shopify", category: "Ecommerce", patterns: [/cdn\.shopify/i, /Shopify\.theme/i] },
  { name: "HubSpot", category: "Marketing", patterns: [/hs-scripts/i, /hubspot/i] },
  { name: "Google Analytics", category: "Analytics", patterns: [/gtag\(/i, /google-analytics/i, /googletagmanager/i] },
  { name: "Segment", category: "Analytics", patterns: [/cdn\.segment\.com/i, /analytics\.js/i] },
  { name: "Intercom", category: "Support", patterns: [/intercom/i] },
  { name: "Drift", category: "Support", patterns: [/js\.driftt\.com/i, /drift\.com/i] },
  { name: "Salesforce", category: "CRM", patterns: [/salesforce/i, /pardot/i] },
  { name: "Cloudflare", category: "Infra", patterns: [/cloudflare/i, /cf-ray/i] },
  { name: "OpenAI", category: "AI", patterns: [/openai/i] },
  { name: "Stripe", category: "Payments", patterns: [/js\.stripe\.com/i, /stripe\.com\/v3/i] },
];

export function detectTech(html: string, headers: Record<string, string> = {}): TechDetection[] {
  const hay = html + " " + Object.entries(headers).map(([k, v]) => `${k}:${v}`).join(" ");
  const out: TechDetection[] = [];
  for (const sig of TECH_SIGNATURES) {
    const hits = sig.patterns.filter((p) => p.test(hay)).length;
    if (hits > 0) {
      out.push({
        name: sig.name,
        category: sig.category,
        confidence: Math.min(1, hits / sig.patterns.length + 0.2),
      });
    }
  }
  return out;
}

/* ------------------------------ link discovery ---------------------------- */

/** Pull internal, crawlable links from an HTML page (same host, http(s)). */
export function discoverLinks(html: string, baseUrl: string, host: string): string[] {
  const links = new Set<string>();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const abs = toAbsoluteUrl(m[1], baseUrl);
    if (!abs) continue;
    if (!/^https?:/i.test(abs)) continue;
    if (!sameHost(abs, host)) continue;
    // strip fragments & obvious asset links
    if (/\.(png|jpe?g|gif|svg|webp|css|js|pdf|zip|mp4|ico)$/i.test(abs)) continue;
    links.add(abs.split("#")[0]);
  }
  return [...links];
}

export function extractTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

/** Merge crawl-page results, deduping emails and social links. */
export function dedupeCrawlFindings(pages: CrawlPage[]) {
  const emails = new Set<string>();
  for (const p of pages) p.emails.forEach((e) => emails.add(e));
  return { emails: rankEmails([...emails]) };
}
