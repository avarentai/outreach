"use client";

import * as React from "react";
import Link from "next/link";
import { useStore, useSnapshot } from "@/lib/store";
import {
  dashboardMetrics,
  dailySeries,
  funnel,
  campaignStats,
} from "@/lib/engines/analytics";
import { PageHeader, StatCard, SectionTitle } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { AreaChart, Funnel } from "@/components/ui/charts";
import { ACTIVITY_META, STAGE_META } from "@/lib/constants";
import { formatPercent, formatNumber, relativeTime, formatCompact, cn } from "@/lib/utils";
import {
  Send,
  Clock,
  MailOpen,
  ThumbsUp,
  CalendarCheck,
  Megaphone,
  ShieldCheck,
  Reply,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Circle,
  Zap,
} from "lucide-react";
import * as Icons from "lucide-react";

export default function DashboardPage() {
  const snap = useSnapshot();
  const companies = useStore((s) => s.companies);
  const activities = useStore((s) => s.activities);
  const followUps = useStore((s) => s.followUps);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const user = users.find((u) => u.id === currentUserId);

  const m = React.useMemo(() => dashboardMetrics(snap), [snap]);
  const series30 = React.useMemo(() => dailySeries(snap, 30), [snap]);
  const series7 = React.useMemo(() => dailySeries(snap, 7), [snap]);
  const funnelSteps = React.useMemo(() => funnel(snap), [snap]);
  const topCampaigns = React.useMemo(
    () => campaignStats(snap).sort((a, b) => b.positiveRate - a.positiveRate).slice(0, 4),
    [snap],
  );

  const sentTrend = series7.map((d) => d.sent);
  const replyTrend = series7.map((d) => d.replies);

  const weekSent = series7.reduce((a, d) => a + d.sent, 0);
  const monthSent = series30.reduce((a, d) => a + d.sent, 0);
  const dueFollowUps = followUps.filter((f) => f.status === "due");

  const dailyTasks = [
    { label: `Review ${dueFollowUps.length} follow-ups due today`, done: dueFollowUps.length === 0, href: "/follow-ups" },
    { label: `Clear inbox — ${snap.threads.filter((t) => t.unread && t.state === "open").length} unread`, done: snap.threads.filter((t) => t.unread && t.state === "open").length === 0, href: "/inbox" },
    { label: `${m.scheduled} emails queued to send`, done: false, href: "/campaigns" },
    { label: "Check deliverability health", done: m.deliverabilityHealth >= 85, href: "/deliverability" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${greeting()}, ${user?.name ?? "there"}`}
        description="Here's what's happening across your outbound today."
        actions={
          <>
            <Link href="/import">
              <Button variant="outline">Import leads</Button>
            </Link>
            <Link href="/campaigns?new=1">
              <Button>
                <Megaphone className="size-4" /> New campaign
              </Button>
            </Link>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Sent today" value={formatNumber(m.sentToday)} icon={Send} trend={sentTrend} accent="var(--chart-2)" />
        <StatCard label="Scheduled" value={formatNumber(m.scheduled)} icon={Clock} accent="var(--chart-4)" href="/campaigns" />
        <StatCard label="Replies" value={formatNumber(m.repliesReceived)} icon={Reply} trend={replyTrend} accent="var(--chart-1)" href="/inbox" />
        <StatCard label="Positive" value={formatNumber(m.positiveReplies)} icon={ThumbsUp} accent="var(--success)" href="/inbox" />
        <StatCard label="Meetings" value={formatNumber(m.meetingsBooked)} icon={CalendarCheck} accent="var(--chart-5)" href="/meetings" />
        <StatCard label="Campaigns" value={formatNumber(m.campaignsRunning)} sublabel="running" icon={Megaphone} accent="var(--primary)" href="/campaigns" />
      </div>

      {/* Rates row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <RateCard label="Reply rate" value={m.replyRate} good={0.08} icon={Reply} />
        <RateCard label="Positive reply rate" value={m.positiveReplyRate} good={0.03} icon={ThumbsUp} />
        <RateCard label="Bounce rate" value={m.bounceRate} good={0.02} invert icon={TrendingUp} />
        <HealthCard value={m.deliverabilityHealth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Performance chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-0">
            <div>
              <SectionTitle>Performance</SectionTitle>
              <p className="-mt-2 text-xs text-muted-foreground">Last 30 days · sends vs replies vs meetings</p>
            </div>
            <div className="flex gap-4 text-xs">
              <LegendDot color="var(--chart-2)" label={`${monthSent} sent`} />
              <LegendDot color="var(--chart-1)" label={`${series30.reduce((a, d) => a + d.replies, 0)} replies`} />
              <LegendDot color="var(--success)" label={`${series30.reduce((a, d) => a + d.meetings, 0)} meetings`} />
            </div>
          </div>
          <CardContent className="pt-4">
            <AreaChart
              labels={series30.map((d) => d.label)}
              series={[
                { key: "sent", label: "Sent", color: "var(--chart-2)", values: series30.map((d) => d.sent) },
                { key: "replies", label: "Replies", color: "var(--chart-1)", values: series30.map((d) => d.replies) },
                { key: "meetings", label: "Meetings", color: "var(--success)", values: series30.map((d) => d.meetings) },
              ]}
            />
          </CardContent>
        </Card>

        {/* Daily tasks */}
        <Card>
          <CardContent className="p-5">
            <SectionTitle>Today&apos;s tasks</SectionTitle>
            <div className="space-y-1">
              {dailyTasks.map((t, i) => (
                <Link
                  key={i}
                  href={t.href}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  {t.done ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  <span className={cn("flex-1", t.done && "text-muted-foreground line-through")}>{t.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>

            <SectionTitle className="mt-5">Funnel</SectionTitle>
            <Funnel steps={funnelSteps} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionTitle action={<Link href="/activity" className="text-xs text-primary hover:underline">View all</Link>}>
              Recent activity
            </SectionTitle>
            <div className="space-y-0.5">
              {activities.slice(0, 8).map((a) => {
                const meta = ACTIVITY_META[a.type];
                const Icon = (Icons[meta.icon as keyof typeof Icons] ?? Zap) as React.ComponentType<{ className?: string }>;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/60">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)` }}>
                      <Icon className="size-3.5" />
                    </div>
                    <span className="flex-1 truncate">{a.summary}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top campaigns + weekly/monthly */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <SectionTitle action={<Link href="/analytics" className="text-xs text-primary hover:underline">Analytics</Link>}>
                Top campaigns
              </SectionTitle>
              {topCampaigns.length === 0 ? (
                <EmptyState title="No campaign data yet" className="py-8" />
              ) : (
                <div className="space-y-2.5">
                  {topCampaigns.map((c) => (
                    <Link key={c.campaignId} href={`/campaigns/${c.campaignId}`} className="block">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{c.name}</span>
                        <Badge variant="success">{formatPercent(c.positiveRate)}</Badge>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.positiveRate * 800)}%` }} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">This week</div>
              <div className="mt-1 text-2xl font-semibold tabular">{formatCompact(weekSent)}</div>
              <div className="text-xs text-muted-foreground">emails sent</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium text-muted-foreground">This month</div>
              <div className="mt-1 text-2xl font-semibold tabular">{formatCompact(monthSent)}</div>
              <div className="text-xs text-muted-foreground">emails sent</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function RateCard({
  label,
  value,
  good,
  invert,
  icon: Icon,
}: {
  label: string;
  value: number;
  good: number;
  invert?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isGood = invert ? value <= good : value >= good;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </span>
        <Badge variant={isGood ? "success" : "warning"}>{isGood ? "Healthy" : "Watch"}</Badge>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">{formatPercent(value)}</div>
    </Card>
  );
}

function HealthCard({ value }: { value: number }) {
  const variant = value >= 85 ? "success" : value >= 70 ? "warning" : "destructive";
  const color = value >= 85 ? "var(--success)" : value >= 70 ? "var(--warning)" : "var(--destructive)";
  return (
    <Link href="/deliverability">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Deliverability
          </span>
          <Badge variant={variant}>{value >= 85 ? "Strong" : value >= 70 ? "Fair" : "At risk"}</Badge>
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-2xl font-semibold tabular" style={{ color }}>{value}</span>
          <span className="mb-1 text-xs text-muted-foreground">/ 100</span>
        </div>
      </Card>
    </Link>
  );
}
