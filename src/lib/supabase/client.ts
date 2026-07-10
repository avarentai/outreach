/* Browser Supabase client (LIVE mode only). Safe no-op when unconfigured. */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const isLiveMode = process.env.NEXT_PUBLIC_DATA_MODE === "live";

/**
 * The single browser Supabase client for the whole app — auth AND data.
 * @supabase/ssr's createBrowserClient is cookie-aware (it sees the session
 * /auth/callback writes server-side) and is a full SupabaseClient, so one
 * memoized instance serves every caller. Sharing one instance avoids the
 * "Multiple GoTrueClient instances detected ... same storage key" warning that
 * two clients (ssr + supabase-js) on the same auth key would emit, and
 * guarantees auth checks and DB queries observe the same session.
 *
 * `undefined` = not yet created; `null` = env unconfigured (demo/build) so
 * every consumer treats it as a no-op.
 */
let browserClient: SupabaseClient<Database> | null | undefined;

export function createClient(): SupabaseClient<Database> | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  browserClient = url && key ? createBrowserClient<Database>(url, key) : null;
  return browserClient;
}
