/* =========================================================================
 * GET /auth/callback   (magic-link landing — LIVE mode)
 * Supabase redirects the user here with a one-time `code` after they click
 * the email link. We exchange it for a session (which sets the auth cookies
 * via the SSR cookie bridge in createServerSupabase) and send them into the
 * app. A missing/invalid code — or an unconfigured/demo environment — bounces
 * back to /login with an error flag.
 * ========================================================================= */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const failure = new URL("/login?error=auth", url.origin);

  if (!code) return NextResponse.redirect(failure);

  const sb = await createServerSupabase();
  if (!sb) return NextResponse.redirect(failure);

  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failure);

  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
