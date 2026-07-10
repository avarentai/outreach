/* =========================================================================
 * Template merge engine — deterministic. NO AI.
 * Resolves {{variables}} and /snippets against a contact/company context.
 * ========================================================================= */

import type { Contact, Company, Snippet, User } from "../types";
import { wordCount } from "../utils";

export interface MergeContext {
  contact: Pick<Contact, "firstName" | "lastName" | "email" | "jobTitle">;
  company: Pick<Company, "name" | "industry" | "website" | "domain">;
  sender?: Pick<User, "name">;
}

export interface MergeResult {
  text: string;
  missing: string[]; // variables that had no value (fell back to safe default)
  words: number;
}

const FALLBACKS: Record<string, string> = {
  first_name: "there",
  last_name: "",
  company: "your company",
  industry: "your industry",
  website: "your website",
  job_title: "your role",
  sender_name: "",
};

function valueFor(key: string, ctx: MergeContext): string | undefined {
  switch (key) {
    case "first_name":
      return ctx.contact.firstName;
    case "last_name":
      return ctx.contact.lastName;
    case "company":
      return ctx.company.name;
    case "industry":
      return ctx.company.industry;
    case "website":
      return ctx.company.website || ctx.company.domain;
    case "job_title":
      return ctx.contact.jobTitle;
    case "sender_name":
      return ctx.sender?.name;
    default:
      return undefined;
  }
}

/** Expand /snippet triggers into their content (applied before variable merge). */
export function expandSnippets(text: string, snippets: Snippet[]): string {
  if (!snippets.length) return text;
  // Longest triggers first to avoid partial shadowing (/case-study vs /case).
  const ordered = [...snippets].sort((a, b) => b.trigger.length - a.trigger.length);
  let out = text;
  for (const s of ordered) {
    // Word-boundary-ish replace; snippet triggers start with "/".
    out = out.split(s.trigger).join(s.content);
  }
  return out;
}

/** Merge {{variables}} deterministically, tracking which ones were missing. */
export function mergeVariables(text: string, ctx: MergeContext): MergeResult {
  const missing: string[] = [];
  const merged = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const v = valueFor(key, ctx);
    if (v === undefined || v === "") {
      if (!(key in FALLBACKS)) return `{{${key}}}`; // unknown token left visible
      if (!FALLBACKS[key]) return "";
      missing.push(key);
      return FALLBACKS[key];
    }
    return v;
  });
  return { text: merged, missing: [...new Set(missing)], words: wordCount(merged) };
}

/** Full render: snippets first, then variables. */
export function renderTemplate(
  raw: string,
  ctx: MergeContext,
  snippets: Snippet[] = [],
): MergeResult {
  return mergeVariables(expandSnippets(raw, snippets), ctx);
}

/** List the {{variables}} referenced by a template body/subject. */
export function extractVariables(text: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-z_]+)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) found.add(m[1].toLowerCase());
  return [...found];
}
