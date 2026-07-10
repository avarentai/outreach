/* =========================================================================
 * Outreach entity mappers — camelCase domain <-> snake_case Supabase rows.
 * Pure functions: toRow(x, workspaceId) for writes, fromRow(r) for reads.
 * Covers campaigns and sending accounts.
 * ========================================================================= */

import type { Campaign, SendingAccount, SendingWindow } from "@/lib/types";
import type { Database, Json } from "@/lib/supabase/database.types";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];

type SendingAccountRow = Database["public"]["Tables"]["sending_accounts"]["Row"];
type SendingAccountInsert = Database["public"]["Tables"]["sending_accounts"]["Insert"];

/* ------------------------------- Campaigns -------------------------------- */

export const campaigns = {
  table: "campaigns" as const,

  toRow(x: Campaign, workspaceId: string): CampaignInsert {
    // contactIds is not a column — campaign membership lives on contacts.campaign_id.
    return {
      id: x.id,
      name: x.name,
      // `|| null` (not `?? null`) so an empty-string ownerId becomes NULL,
      // never an invalid empty UUID written into the owner_id FK.
      owner_id: x.ownerId || null,
      status: x.status,
      sequence_id: x.sequenceId ?? null,
      sending_account_ids: x.sendingAccountIds,
      sending_window: x.sendingWindow as unknown as Json,
      stop_on_reply: x.stopOnReply,
      require_approval: x.requireApproval,
      started_at: x.startedAt ?? null,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
      workspace_id: workspaceId,
    };
  },

  fromRow(r: CampaignRow, contactIds: string[] = []): Campaign {
    return {
      id: r.id,
      name: r.name,
      ownerId: r.owner_id ?? "",
      status: r.status,
      sequenceId: r.sequence_id ?? "",
      sendingAccountIds: r.sending_account_ids,
      contactIds,
      sendingWindow: (r.sending_window ?? {}) as unknown as SendingWindow,
      stopOnReply: r.stop_on_reply,
      requireApproval: r.require_approval,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      startedAt: r.started_at ?? undefined,
    };
  },
};

/* ---------------------------- Sending accounts ---------------------------- */

export const sendingAccounts = {
  table: "sending_accounts" as const,

  toRow(x: SendingAccount, workspaceId: string): SendingAccountInsert {
    // smtp_* are server-only secrets — never surfaced from the domain model.
    return {
      id: x.id,
      label: x.label,
      from_name: x.fromName,
      from_email: x.fromEmail,
      provider: x.provider,
      daily_limit: x.dailyLimit,
      warmup_enabled: x.warmupEnabled,
      spf: x.spf,
      dkim: x.dkim,
      dmarc: x.dmarc,
      reputation_score: x.reputationScore,
      active: x.active,
      // smtp_* are intentionally OMITTED (not null): the domain model never
      // carries credentials, so upsert must not overwrite creds configured
      // out-of-band (dashboard/SQL). On first insert they default to null.
      created_at: x.createdAt,
      workspace_id: workspaceId,
    };
  },

  fromRow(r: SendingAccountRow): SendingAccount {
    return {
      id: r.id,
      label: r.label,
      fromName: r.from_name,
      fromEmail: r.from_email,
      provider: r.provider,
      dailyLimit: r.daily_limit,
      warmupEnabled: r.warmup_enabled,
      spf: r.spf as SendingAccount["spf"],
      dkim: r.dkim as SendingAccount["dkim"],
      dmarc: r.dmarc as SendingAccount["dmarc"],
      reputationScore: r.reputation_score,
      active: r.active,
      createdAt: r.created_at,
    };
  },
};
