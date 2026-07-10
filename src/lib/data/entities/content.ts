/* =========================================================================
 * Avarent Outbound — content mappers (templates, snippets, sequences)
 * Pure TS<->DB translation. camelCase domain <-> snake_case rows.
 * ========================================================================= */

import type { EmailTemplate, Sequence, SequenceStep, Snippet } from "@/lib/types";
import type { Database, Json } from "@/lib/supabase/database.types";

export const templates = {
  table: "templates" as const,

  toRow(
    x: EmailTemplate,
    workspaceId: string,
  ): Database["public"]["Tables"]["templates"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      name: x.name,
      category: x.category,
      subject: x.subject,
      body: x.body,
      owner_id: x.ownerId ?? null,
      tags: x.tags,
      archived: x.archived,
      version: x.version,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
    };
  },

  fromRow(
    r: Database["public"]["Tables"]["templates"]["Row"],
  ): EmailTemplate {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      subject: r.subject,
      body: r.body,
      ownerId: r.owner_id ?? undefined,
      tags: r.tags,
      archived: r.archived,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      version: r.version,
    };
  },
};

export const snippets = {
  table: "snippets" as const,

  toRow(
    x: Snippet,
    workspaceId: string,
  ): Database["public"]["Tables"]["snippets"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      trigger: x.trigger,
      label: x.label,
      content: x.content,
    };
  },

  fromRow(
    r: Database["public"]["Tables"]["snippets"]["Row"],
  ): Snippet {
    return {
      id: r.id,
      trigger: r.trigger,
      label: r.label,
      content: r.content,
    };
  },
};

export const sequences = {
  table: "sequences" as const,

  toRow(
    x: Sequence,
    workspaceId: string,
  ): Database["public"]["Tables"]["sequences"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      name: x.name,
      steps: x.steps as unknown as Json,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
    };
  },

  fromRow(
    r: Database["public"]["Tables"]["sequences"]["Row"],
  ): Sequence {
    return {
      id: r.id,
      name: r.name,
      steps: (r.steps ?? []) as unknown as SequenceStep[],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },
};
