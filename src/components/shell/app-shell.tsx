"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/components/providers";
import { isLiveMode, createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

/* -------------------------------------------------------------------------- *
 * Auth-layer contract added to the store (owned by lib/store.ts). Declared
 * here so this component stays type-clean while relying only on the CONTRACT
 * methods; we read them off the live store instance at runtime.
 * -------------------------------------------------------------------------- */
interface LiveAuthStore {
  workspaceId: string | null;
  hydrated: boolean;
  setSession(user: User, workspaceId: string): void;
  hydrateFromDb(workspaceId: string): Promise<void>;
}

/** Narrow the store instance to the live-auth contract without touching it. */
function liveStore(): LiveAuthStore {
  return useStore.getState() as unknown as LiveAuthStore;
}

/** Spinner shown while the shell resolves auth / hydration. */
function ShellLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

function LiveShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useStore((s) => (s as unknown as LiveAuthStore).hydrated);
  const [checking, setChecking] = React.useState(true);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // Cookie-aware SSR browser client so the session set by /auth/callback
      // (written to cookies server-side) is visible here — a plain
      // supabase-js client would only read localStorage and miss it.
      const db = createBrowserSupabase();
      if (!db) {
        // Live flag set but client unconfigured — send to login.
        router.replace("/login");
        return;
      }

      const {
        data: { session },
      } = await db.auth.getSession();

      if (cancelled) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      // Already hydrated (e.g. client-side nav back into the app): done.
      if (liveStore().hydrated) {
        setChecking(false);
        return;
      }

      try {
        const res = await fetch("/api/bootstrap", { method: "POST" });
        if (!res.ok) throw new Error(`bootstrap ${res.status}`);
        const { workspaceId, user } = (await res.json()) as {
          workspaceId: string;
          user: User;
        };
        if (cancelled) return;
        const store = liveStore();
        store.setSession(user, workspaceId);
        await store.hydrateFromDb(workspaceId);
      } catch {
        if (!cancelled) router.replace("/login");
        return;
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking || !hydrated) return <ShellLoader />;

  return <Chrome
    cmdOpen={cmdOpen}
    setCmdOpen={setCmdOpen}
    mobileNav={mobileNav}
    setMobileNav={setMobileNav}
  >{children}</Chrome>;
}

function DemoShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authed = useStore((s) => s.authed);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);

  React.useEffect(() => {
    if (!authed) router.replace("/login");
  }, [authed, router]);

  if (!authed) return null;

  return <Chrome
    cmdOpen={cmdOpen}
    setCmdOpen={setCmdOpen}
    mobileNav={mobileNav}
    setMobileNav={setMobileNav}
  >{children}</Chrome>;
}

/** Shared app chrome (sidebar + topbar + content) once auth is resolved. */
function Chrome({
  children,
  cmdOpen,
  setCmdOpen,
  mobileNav,
  setMobileNav,
}: {
  children: React.ReactNode;
  cmdOpen: boolean;
  setCmdOpen: (v: boolean) => void;
  mobileNav: boolean;
  setMobileNav: (v: boolean) => void;
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* mobile sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 animate-in">
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenCommand={() => setCmdOpen(true)} onOpenSidebar={() => setMobileNav(true)} />
        <main className={cn("flex-1 overflow-y-auto")}>
          <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">{children}</div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  // Client-only mount guard — avoids persist/SSR hydration mismatches.
  if (!hydrated) return <ShellLoader />;

  return isLiveMode ? <LiveShell>{children}</LiveShell> : <DemoShell>{children}</DemoShell>;
}
