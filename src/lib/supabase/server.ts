/* Server Supabase clients (LIVE mode). Used by API routes and RSC. */
import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Request-scoped client that respects the signed-in user + RLS. */
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* called from a Server Component — safe to ignore */
        }
      },
    },
  });
}

/** Service-role client for the background worker. Bypasses RLS — SERVER ONLY. */
export function createAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSbClient(url, key, { auth: { persistSession: false } });
}
