import { NextResponse } from "next/server";

import { createAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const destination = new URL(req.url).searchParams.get("url");
  if (!destination) return NextResponse.json({ error: "Missing destination." }, { status: 400 });
  let target: URL;
  try {
    target = new URL(destination);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error("invalid protocol");
  } catch {
    return NextResponse.json({ error: "Invalid destination." }, { status: 400 });
  }
  const { id } = await context.params;
  const admin = createAdminSupabase();
  if (admin) {
    const now = new Date().toISOString();
    await admin.from("email_messages").update({ status: "opened", clicked_at: now, opened_at: now }).eq("id", id).eq("direction", "outbound");
  }
  return NextResponse.redirect(target);
}
