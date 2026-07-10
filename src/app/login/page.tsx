"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/components/providers";
import { isLiveMode, createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Zap, ArrowRight, ShieldCheck, MailCheck, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const users = useStore((s) => s.users);
  const login = useStore((s) => s.login);
  const workspace = useStore((s) => s.workspace);

  // Demo-only credential state (kept intact for DEMO mode).
  const [email, setEmail] = React.useState("lucas@avarent.ai");
  const [password, setPassword] = React.useState("demo");

  // Live magic-link state.
  const [liveEmail, setLiveEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const signIn = (userId?: string) => {
    const user = userId
      ? users.find((u) => u.id === userId)
      : users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    login((user ?? users[0]).id);
    router.push("/dashboard");
  };

  const sendMagicLink = async () => {
    const addr = liveEmail.trim();
    if (!addr) return;
    // SSR browser client so the PKCE code_verifier is stored in a cookie the
    // /auth/callback server route can read to complete exchangeCodeForSession.
    const db = createBrowserSupabase();
    if (!db) {
      toast.error("Auth is not configured.");
      return;
    }
    setSending(true);
    const { error } = await db.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      toast.error(error.message || "Could not send the magic link.");
      return;
    }
    setSent(true);
  };

  if (!hydrated) return null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15), transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-2.5 text-primary-foreground">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <Zap className="size-5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold">{workspace.name}</span>
        </div>
        <div className="relative space-y-6 text-primary-foreground">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            The outbound operating system for a two-person team.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Every lead, campaign, reply, and meeting in one fast, deterministic workspace — built to
            maximize replies and minimize busywork.
          </p>
          <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
            <ShieldCheck className="size-4" />
            Deterministic by design · AI optional
          </div>
        </div>
        <div className="relative text-xs text-primary-foreground/50">© {new Date().getFullYear()} Avarent</div>
      </div>

      {/* Right: sign in */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Zap className="size-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your Avarent workspace.</p>
          </div>

          {isLiveMode ? (
            /* ---------------------------- LIVE mode --------------------------- */
            sent ? (
              <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheck className="size-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We sent a sign-in link to <span className="font-medium text-foreground">{liveEmail.trim()}</span>. Open
                    it on this device to continue.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSent(false)}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMagicLink();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={liveEmail}
                    onChange={(e) => setLiveEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={sending || !liveEmail.trim()}>
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Sending link…
                    </>
                  ) : (
                    <>
                      Send magic link <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  No password needed — we&apos;ll email you a one-time sign-in link.
                </p>
              </form>
            )
          ) : (
            /* ---------------------------- DEMO mode --------------------------- */
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Sign in <ArrowRight className="size-4" />
                </Button>
              </form>

              <div className="space-y-2">
                <div className="text-center text-xs text-muted-foreground">Or continue as</div>
                <div className="grid grid-cols-2 gap-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => signIn(u.id)}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-ring/40 hover:bg-accent"
                    >
                      <Avatar name={u.name} color={u.avatarColor} size={32} />
                      <div className="min-w-0 leading-tight">
                        <div className="truncate text-sm font-medium">{u.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{u.title}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Demo mode — no credentials required. Data lives in your browser.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
