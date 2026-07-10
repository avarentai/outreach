/* =========================================================================
 * Contacts mapper — TS camelCase <-> Supabase snake_case. Pure, no I/O.
 * jsonb columns hold the nested TS shape verbatim (supabase-js serializes).
 * ========================================================================= */

import type { Contact, ScoreComponent } from "@/lib/types";
import type { Database, Json } from "@/lib/supabase/database.types";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export const contacts = {
  table: "contacts" as const,

  toRow(x: Contact, workspaceId: string): ContactInsert {
    return {
      id: x.id,
      workspace_id: workspaceId,
      company_id: x.companyId,
      first_name: x.firstName,
      last_name: x.lastName,
      email: x.email,
      email_validity: x.emailValidity,
      job_title: x.jobTitle ?? null,
      linkedin_url: x.linkedinUrl ?? null,
      phone: x.phone ?? null,
      stage: x.stage,
      stage_entered_at: x.stageEnteredAt,
      owner_id: x.ownerId ?? null,
      campaign_id: x.campaignId ?? null,
      tags: x.tags,
      score: x.score,
      score_breakdown: (x.scoreBreakdown ?? null) as unknown as Json,
      last_contacted_at: x.lastContactedAt ?? null,
      next_follow_up_at: x.nextFollowUpAt ?? null,
      linkedin_status: x.linkedinStatus,
      linkedin_notes: x.linkedinNotes ?? null,
      unsubscribed: x.unsubscribed,
      bounced: x.bounced,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
    };
  },

  fromRow(r: ContactRow): Contact {
    return {
      id: r.id,
      companyId: r.company_id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      emailValidity: r.email_validity,
      jobTitle: r.job_title ?? undefined,
      linkedinUrl: r.linkedin_url ?? undefined,
      phone: r.phone ?? undefined,
      stage: r.stage,
      stageEnteredAt: r.stage_entered_at,
      ownerId: r.owner_id ?? undefined,
      campaignId: r.campaign_id ?? undefined,
      tags: r.tags,
      score: r.score,
      scoreBreakdown:
        (r.score_breakdown ?? undefined) as unknown as ScoreComponent[] | undefined,
      lastContactedAt: r.last_contacted_at ?? undefined,
      nextFollowUpAt: r.next_follow_up_at ?? undefined,
      linkedinStatus: r.linkedin_status,
      linkedinNotes: r.linkedin_notes ?? undefined,
      unsubscribed: r.unsubscribed,
      bounced: r.bounced,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },
};
