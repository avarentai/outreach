/* =========================================================================
 * POST /api/bootstrap   (first-login bootstrap — LIVE mode)
 * Idempotently guarantees the signed-in user has a profile, a workspace, and
 * a membership before the app hydrates. Returns { workspaceId, user }.
 *
 * The signed-in identity is read through the request-scoped, RLS-respecting
 * client (createServerSupabase). All writes go through the SERVICE-ROLE admin
 * client (createAdminSupabase) so the very first row — which no RLS policy
 * could yet permit — can be created. Server only.
 * ========================================================================= */

import { NextResponse } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { profiles } from "@/lib/data/entities/config";
import { avatarColor } from "@/lib/utils";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Human-friendly display name from user metadata, falling back to the email local-part. */
function deriveName(email: string, metaName: unknown): string {
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return email;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function POST() {
  // 1. Identify the caller from the session cookie (RLS-scoped client).
  const sb = await createServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser();
  if (userError || !user || !user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. All mutations use the service role — the first rows predate any RLS grant.
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const email = user.email;
  const name = deriveName(email, user.user_metadata?.name);

  // 3. Ensure the profile exists (id === auth uid). Upsert keeps this idempotent.
  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: user.id, name, email, avatar_color: avatarColor(name) },
      { onConflict: "id" },
    )
    .select("*")
    .single();
  if (profileError || !profileRow) {
    return NextResponse.json(
      { error: `bootstrap: profile — ${profileError?.message ?? "no row"}` },
      { status: 500 },
    );
  }

  // 4. Find the user's first membership; create a workspace + owner membership if none.
  const { data: existing, error: memberError } = await admin
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (memberError) {
    return NextResponse.json(
      { error: `bootstrap: membership lookup — ${memberError.message}` },
      { status: 500 },
    );
  }

  let workspaceId = existing?.workspace_id ?? null;

  if (!workspaceId) {
    const domain = email.split("@")[1] ?? "avarent.ai";
    const { data: workspaceRow, error: workspaceError } = await admin
      .from("workspaces")
      .insert({ name: "Avarent", domain, timezone: "America/Toronto" })
      .select("id")
      .single();
    if (workspaceError || !workspaceRow) {
      return NextResponse.json(
        { error: `bootstrap: workspace — ${workspaceError?.message ?? "no row"}` },
        { status: 500 },
      );
    }
    workspaceId = workspaceRow.id;

    const { error: insertMemberError } = await admin
      .from("memberships")
      .insert({ workspace_id: workspaceId, user_id: user.id, role: "owner" });
    if (insertMemberError) {
      return NextResponse.json(
        { error: `bootstrap: membership — ${insertMemberError.message}` },
        { status: 500 },
      );
    }

    // Seed an empty scoring config so the settings screen has a row to edit.
    await admin
      .from("scoring_config")
      .upsert({ workspace_id: workspaceId, rules: [], max_score: 100 }, { onConflict: "workspace_id" });
  }

  return NextResponse.json({
    workspaceId,
    user: profiles.fromRow(profileRow as ProfileRow, "owner"),
  });
}
