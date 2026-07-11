/* =========================================================================
 * POST /api/crawl  { domain: string }
 * Deterministic server-side crawler — NO AI. Fetches a bounded set of pages
 * on the target host and runs the pure parsers in lib/engines/crawler.ts.
 * ========================================================================= */

import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  normalizeDomain,
  discoverLinks,
  classifyUrl,
  extractEmails,
  extractSocialLinks,
  detectTech,
  extractTitle,
  dedupeCrawlFindings,
} from "@/lib/engines/crawler";
import type { CrawlPage, CrawlResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PAGES = 12;
const FETCH_TIMEOUT_MS = 6000;
const PRIORITY = /(contact|about|team|career|job|leadership|people)/i;

function isPrivateAddress(address: string) {
  if (address.includes(":")) {
    const value = address.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value) || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.");
  }
  const parts = address.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
}

async function assertPublicHost(hostname: string) {
  if (hostname === "localhost" || isIP(hostname)) throw new Error("Private network targets are not allowed.");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private network targets are not allowed.");
  }
}

async function fetchText(url: string, domain: string): Promise<{ html: string; status: number; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = new URL(url);
    let res: Response | undefined;
    for (let redirects = 0; redirects <= 4; redirects++) {
      if (current.hostname !== domain && !current.hostname.endsWith(`.${domain}`)) throw new Error("Cross-domain redirects are not allowed.");
      await assertPublicHost(current.hostname);
      res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "user-agent": "AvarentCrawler/1.0 (+deterministic; no-AI)" },
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const location = res.headers.get("location");
      if (!location) break;
      current = new URL(location, current);
    }
    if (!res) throw new Error("Fetch failed.");
    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return { html, status: res.status, headers };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let domain = "";
  try {
    const body = await req.json();
    domain = normalizeDomain(String(body.domain ?? ""));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const base = `https://${domain}`;
  const startedAt = new Date().toISOString();
  const visited = new Set<string>();
  const pages: CrawlPage[] = [];
  const allTech = new Map<string, { name: string; category: string; confidence: number }>();
  const socials = new Map<string, string>();

  const queue: string[] = [base];

  try {
    // Seed: crawl homepage first, then prioritize discovered high-value links.
    while (queue.length && pages.length < MAX_PAGES) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      let fetched;
      try {
        fetched = await fetchText(url, domain);
      } catch {
        pages.push({ url, type: classifyUrl(url), emails: [], status: 0 });
        continue;
      }
      const { html, status, headers } = fetched;
      const title = extractTitle(html);
      const emails = extractEmails(html);
      pages.push({ url, title, type: classifyUrl(url, title), emails, status });

      for (const { platform, url: sUrl } of extractSocialLinks(html)) {
        if (!socials.has(platform)) socials.set(platform, sUrl);
      }
      for (const t of detectTech(html, headers)) {
        if (!allTech.has(t.name)) allTech.set(t.name, t);
      }

      // discover more same-host links, prioritizing valuable pages
      const links = discoverLinks(html, url, domain).filter((l) => !visited.has(l));
      const priority = links.filter((l) => PRIORITY.test(l));
      const rest = links.filter((l) => !PRIORITY.test(l));
      for (const l of [...priority, ...rest]) {
        if (queue.length + pages.length < MAX_PAGES * 2 && !queue.includes(l)) queue.push(l);
      }
    }

    const { emails } = dedupeCrawlFindings(pages);
    const result: CrawlResult = {
      id: `crawl_${domain}`,
      companyId: "",
      domain,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "done",
      pagesCrawled: pages.length,
      pages,
      emailsFound: emails,
      socialLinks: [...socials.entries()].map(([platform, url]) => ({ platform, url })),
      techStack: [...allTech.values()],
    };
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        id: `crawl_${domain}`,
        domain,
        status: "error",
        error: (e as Error).message,
        pages,
        pagesCrawled: pages.length,
        emailsFound: [],
        socialLinks: [],
        techStack: [],
        startedAt,
      } satisfies Partial<CrawlResult>,
      { status: 200 },
    );
  }
}
