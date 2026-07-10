"use client";

import * as React from "react";
import { useStore, useSnapshot } from "@/lib/store";
import {
  dashboardMetrics,
  dailySeries,
  deliverabilityScore,
  senderStats,
  isSent,
  isDelivered,
} from "@/lib/engines/analytics";
import type { SendingAccount } from "@/lib/types";
import { PageHeader, StatCard, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Progress, Switch, Separator } from "@/components/ui/misc";
import { AreaChart, ProgressRing } from "@/components/ui/charts";
import { formatPercent, formatNumber, formatCompact, cn, isSameDay } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  MailWarning,
  Send,
  Gauge,
  Flame,
  Server,
  AtSign,
  AlertTriangle,
  CheckCircle2,
  Activity as ActivityIcon,
  TrendingUp,
} from "lucide-react";

type AuthState = "pass" | "fail" | "unknown";

const AUTH_META: Record<AuthState, { variant: "success" | "warning" | "destructive"; label: string }> = {
  pass: { variant: "success", label: "Pass" },
  unknown: { variant: "warning", label: "Unknown" },
  fail: { variant: "destructive", label: "Fail" },
};

function healthVerdict(score: number) {
  if (score >= 85) return { label: "Strong", variant: "success" as const, color: "var(--success)" };
  if (score >= 70) return { label: "Fair", variant: "warning" as const, color: "var(--warning)" };
  return { label: "At risk", variant: "destructive" as const, color: "var(--destructive)" };
}

function repColor(score: number) {
  return score >= 90 ? "var(--success)" : score >= 80 ? "var(--chart-2)" : score >= 70 ? "var(--warning)" : "var(--destructive)";
}

export default function DeliverabilityPage() {
  const snap = useSnapshot();
  const accounts = useStore((s) => s.accounts);
  const updateAccount = useStore((s) => s.updateAccount);

  const score = React.useMemo(() => deliverabilityScore(snap), [snap]);
  const metrics = React.useMemo(() => dashboardMetrics(snap), [snap]);
  const series30 = React.useMemo(() => dailySeries(snap, 30), [snap]);
  const series7 = React.useMemo(() => dailySeries(snap, 7), [snap]);
  const senders = React.useMemo(() => senderStats(snap), [snap]);

  // Real per-day sent vs. delivered counts over the 30-day window (from messages).
  const domainPerf = React.useMemo(
    () =>
      series30.map((d) => ({
        sent: snap.messages.filter((m) => isSent(m) && m.sentAt && isSameDay(m.sentAt, d.date)).length,
        delivered: snap.messages.filter((m) => isDelivered(m) && m.sentAt && isSameDay(m.sentAt, d.date)).length,
      })),
    [snap, series30],
  );
  const sendersById = React.useMemo(
    () => new Map(senders.map((s) => [s.accountId, s])),
    [senders],
  );

  const verdict = healthVerdict(score);

  const sentToday = metrics.sentToday;
  const sent7d = series7.reduce((a, d) => a + d.sent, 0);
  const sent7Trend = series7.map((d) => d.sent);

  // Sending-limit utilization: today's sends vs. total daily capacity of active accounts.
  const capacity = React.useMemo(
    () => accounts.filter((a) => a.active).reduce((a, x) => a + x.dailyLimit, 0),
    [accounts],
  );
  const utilization = capacity > 0 ? sentToday / capacity : 0;

  // Per-account sends-today, derived deterministically from senderStats share of today's volume.
  const sentTodayByAccount = React.useMemo(() => {
    const totalSent = senders.reduce((a, s) => a + s.sent, 0);
    const map = new Map<string, number>();
    for (const s of senders) {
      const share = totalSent > 0 ? s.sent / totalSent : 0;
      map.set(s.accountId, Math.round(sentToday * share));
    }
    return map;
  }, [senders, sentToday]);

  /* --------------------------- issue detection --------------------------- */
  const issues = React.useMemo(() => {
    const list: { title: string; detail: string; action: string; severity: "high" | "medium" }[] = [];
    if (metrics.bounceRate > 0.03) {
      list.push({
        title: `Bounce rate elevated (${formatPercent(metrics.bounceRate)})`,
        detail: "Sustained bounces above 3% signal list-quality or reputation problems and hurt inbox placement.",
        action: "Reduce daily volume and verify addresses before sending",
        severity: "high",
      });
    }
    for (const a of accounts) {
      if (a.dmarc !== "pass") {
        list.push({
          title: `DMARC not passing on ${a.label}`,
          detail: `${a.fromEmail} has DMARC status "${a.dmarc}". Providers may quarantine or reject unauthenticated mail.`,
          action: "Enable DMARC (publish a _dmarc TXT record with p=quarantine)",
          severity: a.dmarc === "fail" ? "high" : "medium",
        });
      }
      if (a.spf !== "pass") {
        list.push({
          title: `SPF not passing on ${a.label}`,
          detail: `${a.fromEmail} has SPF status "${a.spf}". Add your sending provider to the domain's SPF record.`,
          action: "Fix SPF alignment for the sending domain",
          severity: a.spf === "fail" ? "high" : "medium",
        });
      }
      if (a.dkim !== "pass") {
        list.push({
          title: `DKIM not passing on ${a.label}`,
          detail: `${a.fromEmail} has DKIM status "${a.dkim}". Unsigned mail is far more likely to land in spam.`,
          action: "Publish the DKIM public key and enable signing",
          severity: a.dkim === "fail" ? "high" : "medium",
        });
      }
      if (a.reputationScore < 80) {
        list.push({
          title: `Low reputation on ${a.label} (${a.reputationScore})`,
          detail: `Sender reputation below 80 throttles deliverability across ${a.fromEmail}.`,
          action: a.warmupEnabled
            ? "Keep warmup on and lower daily volume until reputation recovers"
            : "Enable warmup and reduce daily volume",
          severity: a.reputationScore < 70 ? "high" : "medium",
        });
      }
    }
    return list;
  }, [accounts, metrics.bounceRate]);

  const highCount = issues.filter((i) => i.severity === "high").length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Deliverability"
        description="Proactive monitoring of sender reputation, domain authentication, and inbox placement across all sending accounts."
        actions={
          <Badge variant={verdict.variant} className="h-7 px-3 text-sm">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: verdict.color }} />
            {verdict.label}
          </Badge>
        }
      />

      {/* ---------------------- overall health + KPIs ---------------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex items-center gap-5 p-5">
            <ProgressRing
              value={score}
              size={116}
              thickness={11}
              color={verdict.color}
              label={
                <div className="flex flex-col items-center leading-none">
                  <span className="text-2xl font-semibold tabular" style={{ color: verdict.color }}>
                    {score}
                  </span>
                  <span className="mt-1 text-[10px] text-muted-foreground">/ 100</span>
                </div>
              }
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">Overall health</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-lg font-semibold tracking-tight" style={{ color: verdict.color }}>
                  {verdict.label}
                </span>
                <Badge variant={verdict.variant}>{verdict.label}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Blended from bounce rate, SPF/DKIM/DMARC authentication, and sender reputation across{" "}
                {accounts.length} account{accounts.length === 1 ? "" : "s"}.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <StatCard
            label="Bounce rate"
            value={formatPercent(metrics.bounceRate)}
            sublabel={metrics.bounceRate > 0.03 ? "above 3% threshold" : "within safe range"}
            icon={MailWarning}
            accent={metrics.bounceRate > 0.03 ? "var(--destructive)" : "var(--success)"}
          />
          <StatCard
            label="Sent today"
            value={formatNumber(sentToday)}
            sublabel={`${formatNumber(sent7d)} in last 7 days`}
            icon={Send}
            trend={sent7Trend}
            accent="var(--chart-2)"
          />
          <StatCard
            label="Sending capacity used"
            value={formatPercent(utilization, 0)}
            sublabel={`${formatNumber(sentToday)} of ${formatNumber(capacity)}/day`}
            icon={Gauge}
            accent={utilization > 0.9 ? "var(--warning)" : "var(--chart-4)"}
          />
          <StatCard
            label="Delivered"
            value={formatCompact(metrics.delivered)}
            sublabel={`${formatCompact(metrics.totalSent)} total sent`}
            icon={TrendingUp}
            accent="var(--chart-1)"
          />
        </div>
      </div>

      {/* --------------------------- warning banner --------------------------- */}
      {issues.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <AlertTriangle className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {issues.length} deliverability {issues.length === 1 ? "issue needs" : "issues need"} attention
                  </h2>
                  {highCount > 0 && <Badge variant="destructive">{highCount} high priority</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Address these to protect inbox placement before scaling volume.
                </p>
                <div className="mt-3 space-y-2">
                  {issues.map((issue, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      {issue.severity === "high" ? (
                        <ShieldX className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : (
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{issue.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{issue.detail}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {issue.action}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {issues.length === 0 && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <div>
              <div className="text-sm font-medium">All checks passing</div>
              <div className="text-xs text-muted-foreground">
                Authentication, reputation, and bounce rate are all within healthy thresholds.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --------------------------- sending accounts --------------------------- */}
      <div>
        <SectionTitle>Sending accounts</SectionTitle>
        {accounts.length === 0 ? (
          <EmptyState
            icon={<AtSign className="size-8" />}
            title="No sending accounts"
            description="Connect a sending account to start monitoring its authentication and reputation."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                sentToday={sentTodayByAccount.get(a.id) ?? 0}
                bounceRate={sendersById.get(a.id)?.bounceRate ?? 0}
                onWarmup={(v) => updateAccount(a.id, { warmupEnabled: v })}
              />
            ))}
          </div>
        )}
      </div>

      {/* -------------------------- domain performance -------------------------- */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-0">
          <div>
            <SectionTitle className="mb-1">Domain performance</SectionTitle>
            <p className="-mt-1 text-xs text-muted-foreground">
              Daily send volume over the last 30 days · monitoring is continuous and proactive
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <MiniLegend color="var(--chart-2)" label={`${formatNumber(series30.reduce((a, d) => a + d.sent, 0))} sent`} />
            <MiniLegend color="var(--destructive)" label={`${formatPercent(metrics.bounceRate)} bounce`} />
          </div>
        </div>
        <CardContent className="pt-4">
          <AreaChart
            labels={series30.map((d) => d.label)}
            series={[
              { key: "sent", label: "Sent", color: "var(--chart-2)", values: domainPerf.map((d) => d.sent) },
              { key: "delivered", label: "Delivered", color: "var(--success)", values: domainPerf.map((d) => d.delivered) },
            ]}
          />
        </CardContent>
      </Card>

      {/* ----------------------- per-account performance ----------------------- */}
      {senders.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle>Account throughput</SectionTitle>
            <div className="space-y-3">
              {senders
                .slice()
                .sort((a, b) => b.sent - a.sent)
                .map((s) => {
                  const acct = accounts.find((x) => x.id === s.accountId);
                  return (
                    <div key={s.accountId} className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                        <Server className="size-4" />
                      </div>
                      <div className="w-40 shrink-0 truncate">
                        <div className="truncate text-sm font-medium">{s.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{acct?.fromEmail}</div>
                      </div>
                      <div className="flex-1">
                        <Progress
                          value={acct ? Math.min(100, ((sentTodayByAccount.get(s.accountId) ?? 0) / acct.dailyLimit) * 100) : 0}
                          color={repColor(s.reputationScore)}
                        />
                      </div>
                      <div className="w-24 shrink-0 text-right text-xs tabular">
                        <span className="font-medium">{formatNumber(sentTodayByAccount.get(s.accountId) ?? 0)}</span>
                        <span className="text-muted-foreground"> / {acct ? formatNumber(acct.dailyLimit) : "—"}</span>
                      </div>
                      <Badge
                        variant={s.bounceRate > 0.03 ? "destructive" : s.bounceRate > 0.015 ? "warning" : "success"}
                        className="w-16 shrink-0 justify-center"
                      >
                        {formatPercent(s.bounceRate)}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ----------------------------- account card ------------------------------ */

function AccountCard({
  account,
  sentToday,
  bounceRate,
  onWarmup,
}: {
  account: SendingAccount;
  sentToday: number;
  bounceRate: number;
  onWarmup: (v: boolean) => void;
}) {
  const utilization = account.dailyLimit > 0 ? Math.min(100, (sentToday / account.dailyLimit) * 100) : 0;
  const nearLimit = utilization > 90;
  const rep = account.reputationScore;

  return (
    <Card className={cn("p-5", !account.active && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <AtSign className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{account.label}</span>
              {!account.active && <Badge variant="muted">Paused</Badge>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{account.fromEmail}</div>
          </div>
        </div>
        <ProgressRing
          value={rep}
          size={52}
          thickness={6}
          color={repColor(rep)}
          label={<span className="text-xs font-semibold tabular">{rep}</span>}
        />
      </div>

      {/* auth badges */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <AuthChip label="SPF" state={account.spf} />
        <AuthChip label="DKIM" state={account.dkim} />
        <AuthChip label="DMARC" state={account.dmarc} />
      </div>

      <Separator className="my-4" />

      {/* daily limit vs sent today */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Daily volume</span>
          <span className="tabular">
            <span className={cn("font-medium", nearLimit && "text-warning")}>{formatNumber(sentToday)}</span>
            <span className="text-muted-foreground"> / {formatNumber(account.dailyLimit)}</span>
          </span>
        </div>
        <Progress value={utilization} color={nearLimit ? "var(--warning)" : "var(--chart-2)"} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat
          label="Bounce rate"
          value={formatPercent(bounceRate)}
          color={bounceRate > 0.03 ? "var(--destructive)" : undefined}
        />
        <MiniStat label="Reputation" value={rep} color={repColor(rep)} />
      </div>

      {/* warmup toggle */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Flame className={cn("size-4", account.warmupEnabled ? "text-warning" : "text-muted-foreground")} />
          <div>
            <div className="text-xs font-medium">Warmup</div>
            <div className="text-[11px] text-muted-foreground">
              {account.warmupEnabled ? "Gradually ramping volume" : "Ramp disabled"}
            </div>
          </div>
        </div>
        <Switch checked={account.warmupEnabled} onCheckedChange={onWarmup} />
      </div>
    </Card>
  );
}

/* ------------------------------- auth chip ------------------------------- */

function AuthChip({ label, state }: { label: string; state: AuthState }) {
  const meta = AUTH_META[state];
  const Icon = state === "pass" ? ShieldCheck : state === "unknown" ? ShieldAlert : ShieldX;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border py-2",
        state === "pass" && "border-success/30 bg-success/5",
        state === "unknown" && "border-warning/30 bg-warning/5",
        state === "fail" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <Icon
        className={cn(
          "size-4",
          state === "pass" && "text-success",
          state === "unknown" && "text-warning",
          state === "fail" && "text-destructive",
        )}
      />
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <Badge variant={meta.variant} className="px-1.5 py-0 text-[10px]">
        {meta.label}
      </Badge>
    </div>
  );
}

function MiniLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
