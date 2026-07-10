/* Browser Supabase client (LIVE mode only). Safe no-op when unconfigured. */
import { createBrowserClient } from "@supabase/ssr";

export const isLiveMode = process.env.NEXT_PUBLIC_DATA_MODE === "live";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
