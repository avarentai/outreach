/* =========================================================================
 * Avarent Outbound — record entity mappers
 * Pure TS<->DB mappers for meetings, notes, attachments, thread comments,
 * and activity feed rows. camelCase domain <-> snake_case DB Row/Insert.
 * ========================================================================= */

import type {
  Activity,
  Attachment,
  InternalComment,
  Meeting,
  Note,
} from "@/lib/types";
import type { Database, Json } from "@/lib/supabase/database.types";

/* -------------------------------- Meetings -------------------------------- */

export const meetings = {
  table: "meetings" as const,
  toRow(
    x: Meeting,
    workspaceId: string,
  ): Database["public"]["Tables"]["meetings"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      company_id: x.companyId,
      contact_id: x.contactId,
      title: x.title,
      scheduled_at: x.scheduledAt,
      duration_minutes: x.durationMinutes,
      attendees: x.attendees,
      agenda: x.agenda ?? null,
      notes: x.notes ?? null,
      outcome: x.outcome,
      next_action: x.nextAction ?? null,
      owner_id: x.ownerId ?? null,
      created_at: x.createdAt,
    };
  },
  fromRow(r: Database["public"]["Tables"]["meetings"]["Row"]): Meeting {
    return {
      id: r.id,
      companyId: r.company_id,
      contactId: r.contact_id,
      title: r.title,
      scheduledAt: r.scheduled_at,
      durationMinutes: r.duration_minutes,
      attendees: r.attendees,
      agenda: r.agenda ?? undefined,
      notes: r.notes ?? undefined,
      outcome: r.outcome,
      nextAction: r.next_action ?? undefined,
      ownerId: r.owner_id ?? undefined,
      createdAt: r.created_at,
    };
  },
};

/* --------------------------------- Notes ---------------------------------- */

export const notes = {
  table: "notes" as const,
  toRow(
    x: Note,
    workspaceId: string,
  ): Database["public"]["Tables"]["notes"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      company_id: x.companyId,
      author_id: x.authorId,
      body: x.body,
      pinned: x.pinned,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
    };
  },
  fromRow(r: Database["public"]["Tables"]["notes"]["Row"]): Note {
    return {
      id: r.id,
      companyId: r.company_id,
      authorId: r.author_id ?? "",
      body: r.body,
      pinned: r.pinned,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },
};

/* ------------------------------ Attachments ------------------------------- */

export const attachments = {
  table: "attachments" as const,
  toRow(
    x: Attachment,
    workspaceId: string,
  ): Database["public"]["Tables"]["attachments"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      company_id: x.companyId,
      name: x.name,
      kind: x.kind,
      size_bytes: x.sizeBytes,
      storage_path: x.url,
      uploaded_by: x.uploadedById,
      created_at: x.createdAt,
    };
  },
  fromRow(r: Database["public"]["Tables"]["attachments"]["Row"]): Attachment {
    return {
      id: r.id,
      companyId: r.company_id,
      name: r.name,
      kind: r.kind,
      sizeBytes: r.size_bytes,
      url: r.storage_path,
      uploadedById: r.uploaded_by ?? "",
      createdAt: r.created_at,
    };
  },
};

/* ---------------------------- Thread comments ----------------------------- */

export const threadComments = {
  table: "thread_comments" as const,
  toRow(
    x: InternalComment,
    workspaceId: string,
  ): Database["public"]["Tables"]["thread_comments"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      entity_type: x.entityType,
      entity_id: x.entityId,
      author_id: x.authorId,
      body: x.body,
      created_at: x.createdAt,
    };
  },
  fromRow(
    r: Database["public"]["Tables"]["thread_comments"]["Row"],
  ): InternalComment {
    return {
      id: r.id,
      entityType: r.entity_type as InternalComment["entityType"],
      entityId: r.entity_id,
      authorId: r.author_id ?? "",
      body: r.body,
      createdAt: r.created_at,
    };
  },
};

/* ------------------------------- Activities ------------------------------- */

export const activities = {
  table: "activities" as const,
  toRow(
    x: Activity,
    workspaceId: string,
  ): Database["public"]["Tables"]["activities"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      type: x.type,
      actor_id: x.actorId ?? null,
      company_id: x.companyId ?? null,
      contact_id: x.contactId ?? null,
      campaign_id: x.campaignId ?? null,
      summary: x.summary,
      meta: (x.meta ?? null) as unknown as Json,
      created_at: x.createdAt,
    };
  },
  fromRow(r: Database["public"]["Tables"]["activities"]["Row"]): Activity {
    return {
      id: r.id,
      type: r.type,
      actorId: r.actor_id ?? undefined,
      companyId: r.company_id ?? undefined,
      contactId: r.contact_id ?? undefined,
      campaignId: r.campaign_id ?? undefined,
      summary: r.summary,
      meta: (r.meta ?? undefined) as Activity["meta"],
      createdAt: r.created_at,
    };
  },
};
