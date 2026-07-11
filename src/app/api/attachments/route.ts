import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_KINDS = new Set(["pdf", "deck", "one_pager", "contract", "meeting_notes", "other"]);
const MAX_SIZE = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const userClient = await createServerSupabase();
  const admin = createAdminSupabase();
  if (!userClient || !admin) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const companyId = String(form.get("companyId") ?? "");
  const requestedKind = String(form.get("kind") ?? "other");
  if (!(file instanceof File) || !companyId) {
    return NextResponse.json({ error: "Choose a file and company." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Files must be between 1 byte and 25 MB." }, { status: 400 });
  }

  const { data: membership } = await admin
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Workspace membership required." }, { status: 403 });

  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("workspace_id", membership.workspace_id)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160) || "attachment";
  const id = `att_${nanoid(12)}`;
  const path = `${membership.workspace_id}/${companyId}/${id}-${safeName}`;
  const upload = await admin.storage.from("workspace-attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 502 });

  const kind = ALLOWED_KINDS.has(requestedKind) ? requestedKind : file.type === "application/pdf" ? "pdf" : "other";
  const createdAt = new Date().toISOString();
  const { error: insertError } = await admin.from("attachments").insert({
    id,
    workspace_id: membership.workspace_id,
    company_id: companyId,
    name: file.name,
    kind,
    size_bytes: file.size,
    storage_path: path,
    uploaded_by: authData.user.id,
    created_at: createdAt,
  });
  if (insertError) {
    await admin.storage.from("workspace-attachments").remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    attachment: { id, companyId, name: file.name, kind, sizeBytes: file.size, url: path, uploadedById: authData.user.id, createdAt },
  });
}
