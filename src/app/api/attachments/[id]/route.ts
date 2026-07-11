import { NextResponse } from "next/server";

import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const userClient = await createServerSupabase();
  const admin = createAdminSupabase();
  if (!userClient || !admin) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const { data: membership } = await admin.from("memberships").select("workspace_id").eq("user_id", authData.user.id).limit(1).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Workspace membership required." }, { status: 403 });
  const { data: attachment } = await admin
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .eq("workspace_id", membership.workspace_id)
    .maybeSingle();
  if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  const signed = await admin.storage.from("workspace-attachments").createSignedUrl(attachment.storage_path, 60);
  if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 502 });
  return NextResponse.redirect(signed.data.signedUrl);
}
