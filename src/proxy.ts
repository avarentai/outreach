/* =========================================================================
 * Next.js proxy — session refresh + route protection.
 *
 * DEMO mode (NEXT_PUBLIC_DATA_MODE !== 'live'): a no-op — the whole app is
 * client-side, auth lives in localStorage, so we never touch the request.
 *
 * LIVE mode: bridge cookies between the request and response so @supabase/ssr
 * can rotate the auth token, read the current user, then gate navigation:
 *   • no user + protected path  -> /login
 *   • user   + /login           -> /dashboard
 * Public paths (/login, /auth/*, static assets) are always allowed through.
 * ========================================================================= */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Paths that never require a session. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next")
  );
}

export async function proxy(req: NextRequest) {
  // DEMO mode: leave every request untouched.
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "live") {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Live flag set but keys missing — fail open rather than lock everyone out.
  if (!url || !key) return NextResponse.next();

  // Response we can mutate; the cookie bridge writes refreshed tokens onto it.
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() (not getSession) revalidates the token with Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  // Run on every path except Next internals, the favicon, and ALL /api routes.
  // Each API route authenticates itself (worker via secret, others via the
  // session cookie) and must return JSON — never an HTML login redirect.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
