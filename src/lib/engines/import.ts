/* =========================================================================
 * Import normalization + validation — deterministic. NO AI.
 * Handles CSV/Excel column mapping, value normalization, dedup preview.
 * ========================================================================= */

import { normalizeDomain } from "./crawler";
import { validateEmail, normalizeEmail } from "./dedup";
import type { EmailValidity } from "../types";

export type ImportField =
  | "firstName"
  | "lastName"
  | "email"
  | "company"
  | "website"
  | "industry"
  | "jobTitle"
  | "linkedinUrl"
  | "phone"
  | "notes"
  | "ignore";

export const IMPORT_FIELDS: { field: ImportField; label: string }[] = [
  { field: "firstName", label: "First name" },
  { field: "lastName", label: "Last name" },
  { field: "email", label: "Email" },
  { field: "company", label: "Company" },
  { field: "website", label: "Website / Domain" },
  { field: "industry", label: "Industry" },
  { field: "jobTitle", label: "Job title" },
  { field: "linkedinUrl", label: "LinkedIn URL" },
  { field: "phone", label: "Phone" },
  { field: "notes", label: "Notes" },
  { field: "ignore", label: "Ignore column" },
];

/** Guess a mapping from a raw header to our canonical field. */
export function guessField(header: string): ImportField {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  const map: [RegExp, ImportField][] = [
    [/^(firstname|fname|first|givenname)$/, "firstName"],
    [/^(lastname|lname|last|surname|familyname)$/, "lastName"],
    [/^(email|emailaddress|workemail|mail)$/, "email"],
    [/^(company|companyname|organization|org|account)$/, "company"],
    [/^(website|url|domain|site|companyurl|web)$/, "website"],
    [/^(industry|vertical|sector)$/, "industry"],
    [/^(jobtitle|title|role|position)$/, "jobTitle"],
    [/^(linkedin|linkedinurl|liurl|profile)$/, "linkedinUrl"],
    [/^(phone|phonenumber|mobile|tel)$/, "phone"],
    [/^(notes|note|comment|comments|description)$/, "notes"],
  ];
  for (const [re, field] of map) if (re.test(h)) return field;
  // fuzzy contains
  if (h.includes("first")) return "firstName";
  if (h.includes("last")) return "lastName";
  if (h.includes("email") || h.includes("mail")) return "email";
  if (h.includes("company") || h.includes("org")) return "company";
  if (h.includes("web") || h.includes("url") || h.includes("domain")) return "website";
  if (h.includes("title") || h.includes("role")) return "jobTitle";
  if (h.includes("linkedin")) return "linkedinUrl";
  return "ignore";
}

export interface NormalizedRow {
  firstName: string;
  lastName: string;
  email: string;
  emailValidity: EmailValidity;
  company: string;
  website: string;
  domain: string;
  industry: string;
  jobTitle: string;
  linkedinUrl: string;
  phone: string;
  notes: string;
  errors: string[];
  raw: Record<string, string>;
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

/** Apply a header→field mapping to raw rows and normalize every value. */
export function normalizeRows(
  headers: string[],
  rows: string[][],
  mapping: ImportField[],
): NormalizedRow[] {
  return rows.map((cells) => {
    const raw: Record<string, string> = {};
    const bucket: Partial<Record<ImportField, string>> = {};
    headers.forEach((h, i) => {
      raw[h] = cells[i] ?? "";
      const field = mapping[i];
      if (field && field !== "ignore" && cells[i]) {
        bucket[field] = (bucket[field] ? bucket[field] + " " : "") + cells[i].trim();
      }
    });

    let firstName = bucket.firstName ?? "";
    let lastName = bucket.lastName ?? "";
    if (!firstName && !lastName && raw["name"]) {
      [firstName, lastName] = splitName(raw["name"]);
    }

    const email = bucket.email ? normalizeEmail(bucket.email) : "";
    const website = bucket.website ?? "";
    const domain = website ? normalizeDomain(website) : email ? email.split("@")[1] : "";
    const emailValidity = email ? validateEmail(email) : "unknown";

    const errors: string[] = [];
    if (!email) errors.push("Missing email");
    else if (emailValidity === "invalid") errors.push("Invalid email");
    if (!bucket.company && !domain) errors.push("Missing company/domain");

    return {
      firstName,
      lastName,
      email,
      emailValidity,
      company: bucket.company ?? (domain ? domain.split(".")[0] : ""),
      website: website || (domain ? `https://${domain}` : ""),
      domain,
      industry: bucket.industry ?? "",
      jobTitle: bucket.jobTitle ?? "",
      linkedinUrl: bucket.linkedinUrl ?? "",
      phone: bucket.phone ?? "",
      notes: bucket.notes ?? "",
      errors,
      raw,
    };
  });
}

/** Parse a raw list of websites/domains (one per line) into rows. */
export function parseWebsiteList(text: string): NormalizedRow[] {
  const lines = text
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const domain = normalizeDomain(line);
    return {
      firstName: "",
      lastName: "",
      email: "",
      emailValidity: "unknown" as EmailValidity,
      company: domain.split(".")[0],
      website: `https://${domain}`,
      domain,
      industry: "",
      jobTitle: "",
      linkedinUrl: "",
      phone: "",
      notes: "",
      errors: domain ? [] : ["Invalid domain"],
      raw: { line },
    };
  });
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
}

export function summarizeImport(rows: NormalizedRow[]): ImportSummary {
  const seen = new Set<string>();
  let duplicatesInFile = 0;
  let invalid = 0;
  for (const r of rows) {
    if (r.errors.length) invalid++;
    if (r.email) {
      if (seen.has(r.email)) duplicatesInFile++;
      seen.add(r.email);
    }
  }
  return { total: rows.length, valid: rows.length - invalid, invalid, duplicatesInFile };
}
