import { createAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PIXEL = Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64");

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: raw } = await context.params;
  const id = raw.replace(/\.gif$/, "");
  const admin = createAdminSupabase();
  if (admin) {
    const now = new Date().toISOString();
    await admin.from("email_messages").update({ status: "opened", opened_at: now }).eq("id", id).eq("direction", "outbound").is("opened_at", null);
  }
  return new Response(PIXEL, {
    headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" },
  });
}
