/* =========================================================================
 * Opportunity scoring engine — deterministic, rule-based. NO AI.
 * Users configure weighted rules; scores are fully explainable.
 * ========================================================================= */

import type {
  Contact,
  Company,
  ScoringConfig,
  ScoringRule,
  ScoreComponent,
} from "../types";
import { clamp } from "../utils";

export interface ScoringInput {
  contact: Contact;
  company: Company;
  engagementCount: number; // prior replies/opens for this contact
}

function fieldValue(field: ScoringRule["field"], input: ScoringInput): string | number | boolean {
  const { contact, company, engagementCount } = input;
  switch (field) {
    case "industry":
      return company.industry ?? "";
    case "employeeEstimate":
      return parseEmployeeMidpoint(company.enrichment.employeeEstimate);
    case "aiAdoption":
      return (company.enrichment.techStack ?? []).some((t) =>
        /(openai|anthropic|langchain|vector|ml|ai)/i.test(t.name + t.category),
      );
    case "lendingRelevance":
      return /(bank|credit union|lend|mortgage|loan|fintech|auto)/i.test(
        (company.industry ?? "") + " " + company.name,
      );
    case "previousEngagement":
      return engagementCount;
    case "emailValidity":
      return contact.emailValidity;
    case "hasLinkedin":
      return Boolean(contact.linkedinUrl);
    case "techStack":
      return (company.enrichment.techStack ?? []).map((t) => t.name).join(",");
    default:
      return "";
  }
}

function parseEmployeeMidpoint(range?: string): number {
  if (!range) return 0;
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return 0;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

function ruleMatches(rule: ScoringRule, input: ScoringInput): boolean {
  const actual = fieldValue(rule.field, input);
  const target = rule.value;
  switch (rule.operator) {
    case "equals":
      return String(actual).toLowerCase() === target.toLowerCase();
    case "in":
      return target
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(String(actual).toLowerCase());
    case "gte":
      return Number(actual) >= Number(target);
    case "lte":
      return Number(actual) <= Number(target);
    case "exists":
      return Boolean(actual) && actual !== "" && actual !== 0;
    case "contains":
      return String(actual).toLowerCase().includes(target.toLowerCase());
    default:
      return false;
  }
}

export interface ScoreResult {
  score: number; // 0..100 normalized
  raw: number; // sum of points before normalization
  components: ScoreComponent[];
}

/** Compute an explainable opportunity score for a contact. */
export function scoreContact(input: ScoringInput, config: ScoringConfig): ScoreResult {
  const components: ScoreComponent[] = [];
  let raw = 0;
  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    if (ruleMatches(rule, input)) {
      raw += rule.points;
      components.push({
        rule: rule.label,
        points: rule.points,
        reason: describeRule(rule),
      });
    }
  }
  const score = clamp(Math.round((raw / (config.maxScore || 100)) * 100), 0, 100);
  return { score, raw, components };
}

function describeRule(rule: ScoringRule): string {
  const verb: Record<ScoringRule["operator"], string> = {
    equals: "is",
    in: "is one of",
    gte: "≥",
    lte: "≤",
    exists: "is present",
    contains: "contains",
  };
  if (rule.operator === "exists") return `${humanField(rule.field)} ${verb[rule.operator]}`;
  return `${humanField(rule.field)} ${verb[rule.operator]} ${rule.value}`;
}

function humanField(field: ScoringRule["field"]): string {
  return (
    {
      industry: "Industry",
      employeeEstimate: "Company size",
      aiAdoption: "AI adoption signal",
      lendingRelevance: "Lending relevance",
      previousEngagement: "Prior engagement",
      emailValidity: "Email validity",
      hasLinkedin: "LinkedIn profile",
      techStack: "Tech stack",
    } as const
  )[field];
}

/** Sensible default scoring config tuned for Avarent's lending/fintech ICP. */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  maxScore: 100,
  rules: [
    {
      id: "r_lending",
      label: "Lending / financial vertical",
      field: "lendingRelevance",
      operator: "exists",
      value: "true",
      points: 30,
      enabled: true,
    },
    {
      id: "r_industry_cu",
      label: "Credit union or community bank",
      field: "industry",
      operator: "in",
      value: "Credit Union,Community Bank,Regional Bank",
      points: 20,
      enabled: true,
    },
    {
      id: "r_size",
      label: "Company size ≥ 50",
      field: "employeeEstimate",
      operator: "gte",
      value: "50",
      points: 15,
      enabled: true,
    },
    {
      id: "r_ai",
      label: "AI adoption indicators",
      field: "aiAdoption",
      operator: "exists",
      value: "true",
      points: 15,
      enabled: true,
    },
    {
      id: "r_email",
      label: "Valid email",
      field: "emailValidity",
      operator: "equals",
      value: "valid",
      points: 10,
      enabled: true,
    },
    {
      id: "r_engaged",
      label: "Previously engaged",
      field: "previousEngagement",
      operator: "gte",
      value: "1",
      points: 15,
      enabled: true,
    },
    {
      id: "r_linkedin",
      label: "Has LinkedIn profile",
      field: "hasLinkedin",
      operator: "exists",
      value: "true",
      points: 5,
      enabled: true,
    },
  ],
};
