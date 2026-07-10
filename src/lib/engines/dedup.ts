/* =========================================================================
 * Deduplication + email validity — deterministic. NO AI.
 * ========================================================================= */

import type { Contact, Company, EmailValidity } from "../types";
import { normalizeDomain } from "./crawler";

/* --------------------------- email normalization -------------------------- */

export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const [local, domain] = e.split("@");
  if (!domain) return e;
  // Gmail dot/label collapsing for dedup only (not for sending).
  if (/^(gmail|googlemail)\.com$/.test(domain)) {
    const bare = local.split("+")[0].replace(/\./g, "");
    return `${bare}@gmail.com`;
  }
  return `${local.split("+")[0]}@${domain}`;
}

const EMAIL_SYNTAX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "trashmail.com",
  "yopmail.com",
]);
const ROLE_LOCALPARTS = new Set([
  "info",
  "sales",
  "support",
  "admin",
  "contact",
  "hello",
  "team",
  "noreply",
  "no-reply",
]);

/** Deterministic email validity heuristic (syntax + domain + role/disposable). */
export function validateEmail(email: string): EmailValidity {
  const e = email.trim().toLowerCase();
  if (!EMAIL_SYNTAX.test(e)) return "invalid";
  const [local, domain] = e.split("@");
  if (DISPOSABLE.has(domain)) return "invalid";
  if (ROLE_LOCALPARTS.has(local)) return "risky";
  // consecutive dots / trailing dot in local part
  if (/\.\./.test(local) || local.startsWith(".") || local.endsWith(".")) return "risky";
  if (domain.split(".").pop()!.length < 2) return "invalid";
  return "valid";
}

/* ------------------------------ duplicate keys ---------------------------- */

export function contactKey(email: string): string {
  return normalizeEmail(email);
}

export function companyKey(domainOrWebsite: string): string {
  return normalizeDomain(domainOrWebsite);
}

export interface DuplicateReport<T> {
  unique: T[];
  duplicates: { record: T; matchesKey: string }[];
}

/** Split a batch of contacts into unique vs duplicate (by normalized email). */
export function dedupeContacts<T extends { email: string }>(
  incoming: T[],
  existing: Pick<Contact, "email">[] = [],
): DuplicateReport<T> {
  const seen = new Set(existing.map((c) => contactKey(c.email)));
  const unique: T[] = [];
  const duplicates: { record: T; matchesKey: string }[] = [];
  for (const rec of incoming) {
    const key = contactKey(rec.email);
    if (seen.has(key)) {
      duplicates.push({ record: rec, matchesKey: key });
    } else {
      seen.add(key);
      unique.push(rec);
    }
  }
  return { unique, duplicates };
}

/** Find an existing company by domain (dedupe by normalized domain). */
export function findCompanyByDomain(
  domain: string,
  companies: Pick<Company, "id" | "domain">[],
): string | undefined {
  const key = companyKey(domain);
  return companies.find((c) => companyKey(c.domain) === key)?.id;
}

/** Levenshtein distance — fuzzy near-duplicate company-name detection. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[m];
}

export function similarNames(a: string, b: string, threshold = 0.85): boolean {
  const na = a.toLowerCase().replace(/\b(inc|llc|corp|ltd|co)\b\.?/g, "").trim();
  const nb = b.toLowerCase().replace(/\b(inc|llc|corp|ltd|co)\b\.?/g, "").trim();
  if (!na || !nb) return false;
  const dist = levenshtein(na, nb);
  const sim = 1 - dist / Math.max(na.length, nb.length);
  return sim >= threshold;
}
