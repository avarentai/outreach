/* =========================================================================
 * Entity mappers — config & workspace domain <-> Supabase rows. PURE.
 * TS camelCase <-> DB snake_case. Timestamps are ISO strings on both sides.
 * jsonb columns hold the nested TS shape verbatim (never JSON.stringify).
 * ========================================================================= */

import type {
  Experiment,
  ExperimentVariant,
  SavedView,
  FilterClause,
  ScoringConfig,
  ScoringRule,
  FollowUpTask,
  CrawlResult,
  CrawlPage,
  TechDetection,
  Workspace,
  User,
  UserRole,
} from "@/lib/types";
import type { Database, Json } from "@/lib/supabase/database.types";

/* --------------------------------- Helpers -------------------------------- */

function initialsFrom(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/* ------------------------------ A/B testing ------------------------------- */

type ExperimentRow = Database["public"]["Tables"]["experiments"]["Row"];
type ExperimentInsert = Database["public"]["Tables"]["experiments"]["Insert"];

export const experiments = {
  table: "experiments" as const,
  toRow(x: Experiment, workspaceId: string): ExperimentInsert {
    return {
      id: x.id,
      workspace_id: workspaceId,
      name: x.name,
      dimension: x.dimension,
      status: x.status,
      campaign_id: x.campaignId ?? null,
      variants: x.variants as unknown as Json,
      winner_key: x.winnerKey ?? null,
      confidence: x.confidence ?? null,
      min_sample_per_variant: x.minSamplePerVariant,
      created_at: x.createdAt,
    };
  },
  fromRow(r: ExperimentRow): Experiment {
    return {
      id: r.id,
      name: r.name,
      dimension: r.dimension as Experiment["dimension"],
      status: r.status as Experiment["status"],
      campaignId: r.campaign_id ?? undefined,
      variants: (r.variants ?? []) as unknown as ExperimentVariant[],
      winnerKey: r.winner_key ?? undefined,
      confidence: r.confidence ?? undefined,
      minSamplePerVariant: r.min_sample_per_variant,
      createdAt: r.created_at,
    };
  },
};

/* ------------------------------ Saved views ------------------------------- */

type SavedViewRow = Database["public"]["Tables"]["saved_views"]["Row"];
type SavedViewInsert = Database["public"]["Tables"]["saved_views"]["Insert"];

export const savedViews = {
  table: "saved_views" as const,
  toRow(x: SavedView, workspaceId: string): SavedViewInsert {
    return {
      id: x.id,
      workspace_id: workspaceId,
      name: x.name,
      entity: x.entity,
      filters: x.filters as unknown as Json,
      sort: (x.sort ?? null) as unknown as Json,
      system: x.system,
      icon: x.icon ?? null,
    };
  },
  fromRow(r: SavedViewRow): SavedView {
    return {
      id: r.id,
      name: r.name,
      entity: r.entity as SavedView["entity"],
      filters: (r.filters ?? []) as unknown as FilterClause[],
      sort: (r.sort ?? undefined) as unknown as SavedView["sort"],
      system: r.system,
      icon: r.icon ?? undefined,
    };
  },
};

/* --------------------------- Opportunity scoring -------------------------- */

type ScoringConfigRow = Database["public"]["Tables"]["scoring_config"]["Row"];
type ScoringConfigInsert = Database["public"]["Tables"]["scoring_config"]["Insert"];

export const scoringConfig = {
  table: "scoring_config" as const,
  toRow(x: ScoringConfig, workspaceId: string): ScoringConfigInsert {
    return {
      workspace_id: workspaceId,
      rules: x.rules as unknown as Json,
      max_score: x.maxScore,
    };
  },
  fromRow(r: ScoringConfigRow): ScoringConfig {
    return {
      rules: (r.rules ?? []) as unknown as ScoringRule[],
      maxScore: r.max_score,
    };
  },
};

/* ------------------------------- Follow-ups ------------------------------- */

type FollowUpRow = Database["public"]["Tables"]["follow_ups"]["Row"];
type FollowUpInsert = Database["public"]["Tables"]["follow_ups"]["Insert"];

export const followUps = {
  table: "follow_ups" as const,
  toRow(x: FollowUpTask, workspaceId: string): FollowUpInsert {
    return {
      id: x.id,
      workspace_id: workspaceId,
      contact_id: x.contactId,
      company_id: x.companyId,
      campaign_id: x.campaignId ?? null,
      template_id: x.templateId ?? null,
      due_at: x.dueAt,
      status: x.status,
      draft_subject: x.draftSubject,
      draft_body: x.draftBody,
      reason: x.reason,
    };
  },
  fromRow(r: FollowUpRow): FollowUpTask {
    return {
      id: r.id,
      contactId: r.contact_id,
      companyId: r.company_id,
      campaignId: r.campaign_id ?? undefined,
      templateId: r.template_id ?? undefined,
      dueAt: r.due_at,
      status: r.status,
      draftSubject: r.draft_subject,
      draftBody: r.draft_body,
      reason: r.reason,
    };
  },
};

/* -------------------------------- Crawler --------------------------------- */

type CrawlResultRow = Database["public"]["Tables"]["crawl_results"]["Row"];
type CrawlResultInsert = Database["public"]["Tables"]["crawl_results"]["Insert"];

export const crawlResults = {
  table: "crawl_results" as const,
  toRow(x: CrawlResult, workspaceId: string): CrawlResultInsert {
    return {
      id: x.id,
      workspace_id: workspaceId,
      company_id: x.companyId ?? null,
      domain: x.domain,
      status: x.status,
      pages_crawled: x.pagesCrawled,
      pages: x.pages as unknown as Json,
      emails_found: x.emailsFound,
      social_links: x.socialLinks as unknown as Json,
      tech_stack: x.techStack as unknown as Json,
      started_at: x.startedAt,
      finished_at: x.finishedAt ?? null,
      error: x.error ?? null,
    };
  },
  fromRow(r: CrawlResultRow): CrawlResult {
    return {
      id: r.id,
      companyId: (r.company_id ?? undefined) as CrawlResult["companyId"],
      domain: r.domain,
      startedAt: r.started_at,
      finishedAt: r.finished_at ?? undefined,
      status: r.status as CrawlResult["status"],
      pagesCrawled: r.pages_crawled,
      pages: (r.pages ?? []) as unknown as CrawlPage[],
      emailsFound: r.emails_found,
      socialLinks: (r.social_links ?? []) as unknown as CrawlResult["socialLinks"],
      techStack: (r.tech_stack ?? []) as unknown as TechDetection[],
      error: r.error ?? undefined,
    };
  },
};

/* ------------------------------- Workspace -------------------------------- */

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceInsert = Database["public"]["Tables"]["workspaces"]["Insert"];

export const workspaces = {
  table: "workspaces" as const,
  toRow(x: Workspace, workspaceId: string): WorkspaceInsert {
    return {
      id: workspaceId,
      name: x.name,
      domain: x.domain,
      timezone: x.timezone,
      created_at: x.createdAt,
    };
  },
  fromRow(r: WorkspaceRow): Workspace {
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      timezone: r.timezone,
      createdAt: r.created_at,
    };
  },
};

/* -------------------------------- Profiles -------------------------------- */

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

export const profiles = {
  table: "profiles" as const,
  toRow(x: User): ProfileInsert {
    return {
      id: x.id,
      name: x.name,
      email: x.email,
      title: x.title ?? null,
      avatar_color: x.avatarColor,
    };
  },
  fromRow(r: ProfileRow, role: UserRole = "member"): User {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role,
      avatarColor: r.avatar_color ?? "#64748b",
      initials: initialsFrom(r.name),
      title: r.title ?? undefined,
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at ?? undefined,
    };
  },
};
