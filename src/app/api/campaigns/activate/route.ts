/* =========================================================================
 * POST /api/campaigns/activate   { campaignId: string }
 * Activates a campaign by deterministically materializing the initial sends
 * the worker will drain. Auth via the request-scoped Supabase session; the
 * workspace is resolved from the caller's memberships. All loads and writes
 * use the SERVICE-ROLE client so RLS can't silently drop rows during the
 * multi-table insert. Scheduling/rendering is pure (lib/engines) — NO AI.
 *
 * Returns { threads, messages, queued } counts. A failed insert rolls forward
 * no further and returns a 500 with the underlying message.
 * ========================================================================= */

import { NextResponse } from "next/server";

import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { materializeCampaign } from "@/lib/engines/materialize";
import { campaigns, sendingAccounts } from "@/lib/data/entities/outreach";
import { templates, snippets, sequences } from "@/lib/data/entities/content";
import { contacts as contactMapper } from "@/lib/data/entities/contacts";
import { companies as companyMapper } from "@/lib/data/entities/companies";
import { threads as threadMapper, emailMessages } from "@/lib/data/entities/inbox";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // 1. Authenticate the caller.
  const auth = await createServerSupabase();
  if (!auth) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse the body.
  let campaignId = "";
  try {
    const body = await req.json();
    campaignId = String(body.campaignId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // 3. Service-role client for the loads + writes (bypasses RLS).
  const sb = createAdminSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Service role key not configured" },
      { status: 503 },
    );
  }

  // 4. Resolve the caller's workspaces, then locate the campaign inside one.
  const { data: memberRows, error: memberErr } = await sb
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id);
  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }
  const workspaceIds = (memberRows ?? []).map((m) => m.workspace_id as string);
  if (workspaceIds.length === 0) {
    return NextResponse.json({ error: "no workspace for user" }, { status: 403 });
  }

  const { data: campaignRow, error: campaignErr } = await sb
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .in("workspace_id", workspaceIds)
    .maybeSingle();
  if (campaignErr) {
    return NextResponse.json({ error: campaignErr.message }, { status: 500 });
  }
  if (!campaignRow) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }
  const workspaceId = campaignRow.workspace_id;

  // 5. Load the sequence, enrolled contacts, their companies, accounts, and
  //    content in parallel — all scoped to the resolved workspace.
  const [
    sequenceRes,
    contactRes,
    accountRes,
    templateRes,
    snippetRes,
  ] = await Promise.all([
    campaignRow.sequence_id
      ? sb.from("sequences").select("*").eq("id", campaignRow.sequence_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    sb.from("contacts").select("*").eq("campaign_id", campaignId).eq("workspace_id", workspaceId),
    sb.from("sending_accounts").select("*").eq("workspace_id", workspaceId),
    sb.from("templates").select("*").eq("workspace_id", workspaceId),
    sb.from("snippets").select("*").eq("workspace_id", workspaceId),
  ]);

  const firstError =
    sequenceRes.error || contactRes.error || accountRes.error || templateRes.error || snippetRes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const contactRows = contactRes.data ?? [];
  const companyIds = [...new Set(contactRows.map((c) => c.company_id as string))];
  const { data: companyRows, error: companyErr } = companyIds.length
    ? await sb.from("companies").select("*").in("id", companyIds).eq("workspace_id", workspaceId)
    : { data: [], error: null };
  if (companyErr) {
    return NextResponse.json({ error: companyErr.message }, { status: 500 });
  }

  // 6. Map DB rows -> domain model and run the pure materializer.
  const now = new Date();
  const { threads, messages, queue } = materializeCampaign({
    campaign: campaigns.fromRow(campaignRow, contactRows.map((c) => c.id as string)),
    sequence: sequenceRes.data ? sequences.fromRow(sequenceRes.data) : undefined,
    templates: (templateRes.data ?? []).map((r) => templates.fromRow(r)),
    snippets: (snippetRes.data ?? []).map((r) => snippets.fromRow(r)),
    contacts: contactRows.map((r) => contactMapper.fromRow(r)),
    companies: (companyRows ?? []).map((r) => companyMapper.fromRow(r)),
    accounts: (accountRes.data ?? []).map((r) => sendingAccounts.fromRow(r)),
    now,
  });

  // 7. Persist: threads, then messages, then queue rows, then flip status.
  //    Ordered so foreign keys resolve (queue.message_id -> email_messages.id).
  try {
    if (threads.length) {
      const rows = threads.map((t) =>
        threadMapper.toRow({ ...t, messageIds: [] }, workspaceId),
      );
      const { error } = await sb.from("threads").insert(rows);
      if (error) throw new Error(`threads insert failed — ${error.message}`);
    }

    if (messages.length) {
      const rows = messages.map((m) => emailMessages.toRow(m, workspaceId));
      const { error } = await sb.from("email_messages").insert(rows);
      if (error) throw new Error(`email_messages insert failed — ${error.message}`);
    }

    if (queue.length) {
      const rows = queue.map((q) => ({
        workspace_id: workspaceId,
        message_id: q.messageId,
        send_after: q.sendAfter,
      }));
      const { error } = await sb.from("email_queue").insert(rows);
      if (error) throw new Error(`email_queue insert failed — ${error.message}`);
    }

    const { error: statusErr } = await sb
      .from("campaigns")
      .update({ status: "active", started_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId);
    if (statusErr) throw new Error(`campaign activation failed — ${statusErr.message}`);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    threads: threads.length,
    messages: messages.length,
    queued: queue.length,
  });
}
