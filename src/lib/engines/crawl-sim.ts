/* =========================================================================
 * Deterministic crawl simulator — DEMO mode only. NO AI, NO network.
 * Produces plausible, stable crawl results from a domain so the crawler UI
 * is fully interactive offline. In LIVE mode the server route in
 * app/api/crawl actually fetches and uses the real parsers in crawler.ts.
 * ========================================================================= */

import type { CrawlResult, CrawlPage, TechDetection } from "../types";
import { seededRandom, hashSeed } from "./scheduler";
import { normalizeDomain } from "./crawler";

const TECH_POOL: TechDetection[] = [
  { name: "WordPress", category: "CMS", confidence: 0.92 },
  { name: "Cloudflare", category: "Infra", confidence: 0.88 },
  { name: "Google Analytics", category: "Analytics", confidence: 0.9 },
  { name: "HubSpot", category: "Marketing", confidence: 0.8 },
  { name: "Salesforce", category: "CRM", confidence: 0.75 },
  { name: "Intercom", category: "Support", confidence: 0.7 },
  { name: "Segment", category: "Analytics", confidence: 0.65 },
  { name: "Next.js", category: "Framework", confidence: 0.85 },
];

const PAGE_TEMPLATES: { path: string; type: CrawlPage["type"]; title: string }[] = [
  { path: "/", type: "home", title: "Home" },
  { path: "/about", type: "about", title: "About Us" },
  { path: "/contact", type: "contact", title: "Contact" },
  { path: "/careers", type: "careers", title: "Careers" },
  { path: "/team", type: "team", title: "Our Team" },
  { path: "/products", type: "product", title: "Products & Services" },
  { path: "/rates", type: "other", title: "Rates" },
  { path: "/locations", type: "other", title: "Locations" },
  { path: "/blog", type: "other", title: "Blog" },
];

export function simulateCrawl(domainInput: string): CrawlResult {
  const domain = normalizeDomain(domainInput);
  const rng = seededRandom(hashSeed(domain));
  const pick = <T>(a: T[]) => a[Math.floor(rng() * a.length)];

  const pageCount = 4 + Math.floor(rng() * 5);
  const chosen = PAGE_TEMPLATES.slice(0, pageCount);
  const emails = new Set<string>();

  const pages: CrawlPage[] = chosen.map((p) => {
    const pageEmails: string[] = [];
    if (p.type === "contact") {
      pageEmails.push(`info@${domain}`, `contact@${domain}`);
      if (rng() > 0.5) pageEmails.push(`support@${domain}`);
    }
    if (p.type === "team" && rng() > 0.4) {
      const names = ["j.miller", "s.carter", "d.hughes"];
      pageEmails.push(`${pick(names)}@${domain}`);
    }
    if (p.type === "careers" && rng() > 0.6) pageEmails.push(`careers@${domain}`);
    pageEmails.forEach((e) => emails.add(e));
    return {
      url: `https://${domain}${p.path}`,
      title: p.title,
      type: p.type,
      emails: pageEmails,
      status: 200,
    };
  });

  const techCount = 2 + Math.floor(rng() * 4);
  const techStack = [...TECH_POOL].sort(() => rng() - 0.5).slice(0, techCount);

  const socialLinks = [
    { platform: "linkedin", url: `https://linkedin.com/company/${domain.split(".")[0]}` },
  ];
  if (rng() > 0.4) socialLinks.push({ platform: "twitter", url: `https://x.com/${domain.split(".")[0]}` });
  if (rng() > 0.6) socialLinks.push({ platform: "facebook", url: `https://facebook.com/${domain.split(".")[0]}` });

  const now = new Date().toISOString();
  return {
    id: `crawl_${domain}`,
    companyId: "",
    domain,
    startedAt: now,
    finishedAt: now,
    status: "done",
    pagesCrawled: pages.length,
    pages,
    emailsFound: [...emails],
    socialLinks,
    techStack,
  };
}
