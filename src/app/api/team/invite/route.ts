import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
  }

  const userClient = await createServerSupabase();
  const admin = createAdminSupabase();
  if (!userClient || !admin) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: membership } = await admin
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", authData.user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Owner or admin access required." }, { status: 403 });

  const email = parsed.data.email.toLowerCase();
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) return NextResponse.json({ error: listed.error.message }, { status: 502 });

  let user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  let invited = false;
  if (!user) {
    const origin = new URL(req.url).origin;
    const result = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback`,
      data: { name: email.split("@")[0] },
    });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 502 });
    user = result.data.user;
    invited = true;
  }
  if (!user) return NextResponse.json({ error: "Could not create the member." }, { status: 502 });

  const name = String(user.user_metadata?.name ?? email.split("@")[0]);
  const { error: profileError } = await admin.from("profiles").upsert(
    { id: user.id, email, name },
    { onConflict: "id" },
  );
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: membershipError } = await admin.from("memberships").upsert(
    { workspace_id: membership.workspace_id, user_id: user.id, role: parsed.data.role },
    { onConflict: "workspace_id,user_id" },
  );
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  return NextResponse.json({ ok: true, invited });
}
