/* =========================================================================
 * Company <-> DB row mappers.
 * Pure translation between the camelCase domain model and the snake_case
 * Supabase schema. No I/O, no side effects.
 * ========================================================================= */

import type { Company, CompanyEnrichment } from "@/lib/types";
import type { Database, Json } from "@/lib/supabase/database.types";

type Row = Database["public"]["Tables"]["companies"]["Row"];
type Insert = Database["public"]["Tables"]["companies"]["Insert"];

export const companies = {
  table: "companies" as const,

  toRow(x: Company, workspaceId: string): Insert {
    return {
      id: x.id,
      workspace_id: workspaceId,
      name: x.name,
      domain: x.domain,
      website: x.website ?? null,
      industry: x.industry ?? null,
      status: x.status,
      notes: x.notes ?? null,
      tags: x.tags,
      owner_id: x.ownerId ?? null,
      enrichment: x.enrichment as unknown as Json,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
    };
  },

  fromRow(r: Row): Company {
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      website: r.website ?? undefined,
      industry: r.industry ?? undefined,
      status: r.status,
      notes: r.notes ?? undefined,
      tags: r.tags,
      ownerId: r.owner_id ?? undefined,
      enrichment: (r.enrichment ?? {}) as unknown as CompanyEnrichment,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },
};
