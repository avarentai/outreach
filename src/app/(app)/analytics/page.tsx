"use client";

import * as React from "react";
import { useStore, useSnapshot } from "@/lib/store";
import {
  dashboardMetrics,
  dailySeries,
  funnel,
  campaignStats,
  templateStats,
  subjectStats,
  timeOfDayStats,
  dayOfWeekStats,
  senderStats,
  industryStats,
  pipelineStats,
  deliverabilityScore,
  isSent,
  type CampaignStat,
  type TemplateStat,
  type SubjectStat,
  type SenderStat,
  type IndustryStat,
  type StageStat,
} from "@/lib/engines/analytics";
import { PageHeader, StatCard, SectionTitle } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import {
  AreaChart,
  BarChart,
  Funnel,
  ProgressRing,
  Heatmap,
} from "@/components/ui/charts";
import { STAGE_META } from "@/lib/constants";
import {
  formatPercent,
  formatNumber,
  formatCompact,
  formatCurrency,
  cn,
} from "@/lib/utils";
import {
  BarChart3,
  Send,
  Reply,
  ThumbsUp,
  CalendarCheck,
  Megaphone,
  ShieldCheck,
  DollarSign,
  HelpCircle,
  Sparkles,
  User,
  Building2,
  Layers,
  Clock,
} from "lucide-react";

type TabValue =
  | "overview"
  | "campaigns"
  | "templates"
  | "subject"
  | "timing"
  | "senders"
  | "industries"
  | "funnel";

const TAB_META: { value: TabValue; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "campaigns", label: "Campaigns" },
  { value: "templates", label: "Templates" },
  { value: "subject", label: "Subject & CTA" },
  { value: "timing", label: "Timing" },
  { value: "senders", label: "Senders" },
  { value: "industries", label: "Industries" },
  { value: "funnel", label: "Funnel" },
];

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export default function AnalyticsPage() {
  const snap = useSnapshot();
  const companies = useStore((s) => s.companies);
  const [tab, setTab] = React.useState<TabValue>("overview");

  const m = React.useMemo(() => dashboardMetrics(snap), [snap]);
  const series30 = React.useMemo(() => dailySeries(snap, 30), [snap]);
  const funnelSteps = React.useMemo(() => funnel(snap), [snap]);
  const campaigns = React.useMemo(
    () => campaignStats(snap).sort((a, b) => b.sent - a.sent),
    [snap],
  );
  const templates = React.useMemo(
    () => templateStats(snap).sort((a, b) => b.score - a.score),
    [snap],
  );
  const subjects = React.useMemo(
    () => subjectStats(snap).filter((s) => s.sent > 0),
    [snap],
  );
  const timeOfDay = React.useMemo(() => timeOfDayStats(snap), [snap]);
  const dayOfWeek = React.useMemo(() => dayOfWeekStats(snap), [snap]);
  const senders = React.useMemo(
    () => senderStats(snap).sort((a, b) => b.reputationScore - a.reputationScore),
    [snap],
  );
  const industries = React.useMemo(
    () => industryStats(snap, companies),
    [snap, companies],
  );
  const pipeline = React.useMemo(() => pipelineStats(snap), [snap]);
  const deliverability = React.useMemo(() => deliverabilityScore(snap), [snap]);

  const totalRevenue = React.useMemo(
    () => campaigns.reduce((a, c) => a + c.revenue, 0),
    [campaigns],
  );

  const hasData = snap.messages.some(isSent);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Deep performance breakdowns across campaigns, templates, timing, and pipeline."
        actions={
          <Badge variant="muted" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Deliverability {deliverability}/100
          </Badge>
        }
      />

      <Tabs
        tabs={TAB_META}
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
      />

      {!hasData ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<BarChart3 className="size-8" />}
              title="No send data yet"
              description="Launch a campaign and start sending to populate analytics."
              className="py-12"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {tab === "overview" && (
            <OverviewTab
              m={m}
              series30={series30}
              funnelSteps={funnelSteps}
              revenue={totalRevenue}
            />
          )}
          {tab === "campaigns" && <CampaignsTab rows={campaigns} />}
          {tab === "templates" && <TemplatesTab rows={templates} />}
          {tab === "subject" && <SubjectTab rows={subjects} />}
          {tab === "timing" && (
            <TimingTab
              timeOfDay={timeOfDay}
              dayOfWeek={dayOfWeek}
              messages={snap.messages}
            />
          )}
          {tab === "senders" && <SendersTab rows={senders} />}
          {tab === "industries" && <IndustriesTab rows={industries} />}
          {tab === "funnel" && (
            <FunnelTab funnelSteps={funnelSteps} pipeline={pipeline} />
          )}
        </>
      )}
    </div>
  );
}

/* ============================== shared table ============================== */

function Th({
  children,
  className,
  right,
}: {
  children: React.ReactNode;
  className?: string;
  right?: boolean;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  right,
}: {
  children: React.ReactNode;
  className?: string;
  right?: boolean;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-sm",
        right && "text-right tabular",
        className,
      )}
    >
      {children}
    </td>
  );
}

function DataTable({
  head,
  children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function rateColor(rate: number, good: number, invert = false): string {
  const ok = invert ? rate <= good : rate >= good;
  return ok ? "var(--success)" : "var(--muted-foreground)";
}

/* ================================ Overview =============================== */

function OverviewTab({
  m,
  series30,
  funnelSteps,
  revenue,
}: {
  m: ReturnType<typeof dashboardMetrics>;
  series30: ReturnType<typeof dailySeries>;
  funnelSteps: ReturnType<typeof funnel>;
  revenue: number;
}) {
  const monthSent = series30.reduce((a, d) => a + d.sent, 0);
  const monthReplies = series30.reduce((a, d) => a + d.replies, 0);
  const monthMeetings = series30.reduce((a, d) => a + d.meetings, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total sent"
          value={formatNumber(m.totalSent)}
          icon={Send}
          accent="var(--chart-2)"
        />
        <StatCard
          label="Delivered"
          value={formatNumber(m.delivered)}
          icon={ShieldCheck}
          accent="var(--chart-4)"
        />
        <StatCard
          label="Replies"
          value={formatNumber(m.repliesReceived)}
          sublabel={formatPercent(m.replyRate)}
          icon={Reply}
          accent="var(--chart-1)"
        />
        <StatCard
          label="Positive"
          value={formatNumber(m.positiveReplies)}
          sublabel={formatPercent(m.positiveReplyRate)}
          icon={ThumbsUp}
          accent="var(--success)"
        />
        <StatCard
          label="Meetings"
          value={formatNumber(m.meetingsBooked)}
          icon={CalendarCheck}
          accent="var(--chart-5)"
        />
        <StatCard
          label="Revenue"
          value={formatCompact(revenue)}
          sublabel="attributed"
          icon={DollarSign}
          accent="var(--primary)"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <SectionTitle>Performance</SectionTitle>
            <p className="-mt-2 text-xs text-muted-foreground">
              Last 30 days · sends vs replies vs meetings
            </p>
          </div>
          <div className="flex gap-4 text-xs">
            <LegendDot color="var(--chart-2)" label={`${monthSent} sent`} />
            <LegendDot color="var(--chart-1)" label={`${monthReplies} replies`} />
            <LegendDot color="var(--success)" label={`${monthMeetings} meetings`} />
          </div>
        </div>
        <CardContent className="pt-4">
          <AreaChart
            labels={series30.map((d) => d.label)}
            series={[
              {
                key: "sent",
                label: "Sent",
                color: "var(--chart-2)",
                values: series30.map((d) => d.sent),
              },
              {
                key: "replies",
                label: "Replies",
                color: "var(--chart-1)",
                values: series30.map((d) => d.replies),
              },
              {
                key: "meetings",
                label: "Meetings",
                color: "var(--success)",
                values: series30.map((d) => d.meetings),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <SectionTitle>Conversion funnel</SectionTitle>
          <Funnel steps={funnelSteps} />
        </CardContent>
      </Card>
    </div>
  );
}

/* =============================== Campaigns =============================== */

function CampaignsTab({ rows }: { rows: CampaignStat[] }) {
  if (rows.length === 0)
    return <EmptyCard title="No campaigns yet" desc="Create a campaign to track its performance." />;

  const totals = rows.reduce(
    (a, c) => ({
      sent: a.sent + c.sent,
      customers: a.customers + c.customers,
      revenue: a.revenue + c.revenue,
    }),
    { sent: 0, customers: 0, revenue: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniPill label="Campaigns" value={formatNumber(rows.length)} icon={Megaphone} />
        <MiniPill label="Emails sent" value={formatNumber(totals.sent)} icon={Send} />
        <MiniPill label="Customers won" value={formatNumber(totals.customers)} icon={ThumbsUp} accent="var(--success)" />
        <MiniPill label="Revenue" value={formatCurrency(totals.revenue)} icon={DollarSign} accent="var(--primary)" />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            head={
              <>
                <Th>Campaign</Th>
                <Th right>Sent</Th>
                <Th right>Delivered</Th>
                <Th right>Opened</Th>
                <Th right>Replied</Th>
                <Th right>Positive</Th>
                <Th right>Meetings</Th>
                <Th right>Customers</Th>
                <Th right>Bounce</Th>
                <Th right>Reply rate</Th>
                <Th right>Positive rate</Th>
                <Th right>Revenue</Th>
              </>
            }
          >
            {rows.map((c) => (
              <tr key={c.campaignId} className="hover:bg-accent/40">
                <Td className="max-w-[220px] truncate font-medium">{c.name}</Td>
                <Td right>{formatNumber(c.sent)}</Td>
                <Td right>{formatNumber(c.delivered)}</Td>
                <Td right>{formatNumber(c.opened)}</Td>
                <Td right>{formatNumber(c.replied)}</Td>
                <Td right>{formatNumber(c.positive)}</Td>
                <Td right>{formatNumber(c.meetings)}</Td>
                <Td right>{formatNumber(c.customers)}</Td>
                <Td right>
                  <span style={{ color: rateColor(c.bounceRate, 0.02, true) }}>
                    {formatPercent(c.bounceRate)}
                  </span>
                </Td>
                <Td right>
                  <span style={{ color: rateColor(c.replyRate, 0.08) }}>
                    {formatPercent(c.replyRate)}
                  </span>
                </Td>
                <Td right>
                  <Badge variant={c.positiveRate >= 0.03 ? "success" : "muted"}>
                    {formatPercent(c.positiveRate)}
                  </Badge>
                </Td>
                <Td right className="font-medium">{formatCurrency(c.revenue)}</Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

/* =============================== Templates =============================== */

function TemplatesTab({ rows }: { rows: TemplateStat[] }) {
  if (rows.length === 0)
    return <EmptyCard title="No templates yet" desc="Add templates to compare their performance." />;

  const barData = [...rows]
    .sort((a, b) => b.positiveRate - a.positiveRate)
    .slice(0, 10)
    .map((t, i) => ({
      label: t.name,
      value: t.positiveRate,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle>Positive reply rate by template</SectionTitle>
          <BarChart
            data={barData}
            horizontal
            valueFormat={(v) => formatPercent(v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            head={
              <>
                <Th>Template</Th>
                <Th>Category</Th>
                <Th right>Words</Th>
                <Th right>Sent</Th>
                <Th right>Replied</Th>
                <Th right>Positive</Th>
                <Th right>Meetings</Th>
                <Th right>Reply rate</Th>
                <Th right>Positive rate</Th>
                <Th right>Score</Th>
              </>
            }
          >
            {rows.map((t) => (
              <tr key={t.templateId} className="hover:bg-accent/40">
                <Td className="max-w-[220px] truncate font-medium">{t.name}</Td>
                <Td>
                  <Badge variant="outline">{t.category}</Badge>
                </Td>
                <Td right>{formatNumber(t.words)}</Td>
                <Td right>{formatNumber(t.sent)}</Td>
                <Td right>{formatNumber(t.replied)}</Td>
                <Td right>{formatNumber(t.positive)}</Td>
                <Td right>{formatNumber(t.meetings)}</Td>
                <Td right>
                  <span style={{ color: rateColor(t.replyRate, 0.08) }}>
                    {formatPercent(t.replyRate)}
                  </span>
                </Td>
                <Td right>
                  <Badge variant={t.positiveRate >= 0.03 ? "success" : "muted"}>
                    {formatPercent(t.positiveRate)}
                  </Badge>
                </Td>
                <Td right className="text-muted-foreground">
                  {formatPercent(t.score)}
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================= Subject & CTA ============================= */

function SubjectTab({ rows }: { rows: SubjectStat[] }) {
  const agg = React.useMemo(() => {
    const bucket = (pred: (s: SubjectStat) => boolean) => {
      const sub = rows.filter(pred);
      const sent = sub.reduce((a, s) => a + s.sent, 0);
      const replied = sub.reduce((a, s) => a + s.replied, 0);
      return { sent, replied, rate: sent > 0 ? replied / sent : 0 };
    };
    return {
      question: bucket((s) => s.hasQuestion),
      statement: bucket((s) => !s.hasQuestion),
      personalized: bucket((s) => s.hasPersonalization),
      generic: bucket((s) => !s.hasPersonalization),
    };
  }, [rows]);

  if (rows.length === 0)
    return <EmptyCard title="No subject data yet" desc="Send emails to analyze subject-line performance." />;

  const sorted = [...rows].sort((a, b) => b.replyRate - a.replyRate);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <CompareCallout
          icon={HelpCircle}
          title="Questions vs statements"
          a={{ label: "Question subjects", ...agg.question }}
          b={{ label: "Statement subjects", ...agg.statement }}
        />
        <CompareCallout
          icon={Sparkles}
          title="Personalized vs generic"
          a={{ label: "Personalized", ...agg.personalized }}
          b={{ label: "Generic", ...agg.generic }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            head={
              <>
                <Th>Subject</Th>
                <Th right>Words</Th>
                <Th>Question</Th>
                <Th>Personalized</Th>
                <Th right>Sent</Th>
                <Th right>Replied</Th>
                <Th right>Reply rate</Th>
              </>
            }
          >
            {sorted.map((s, i) => (
              <tr key={i} className="hover:bg-accent/40">
                <Td className="max-w-[320px] truncate">{s.subject}</Td>
                <Td right>{formatNumber(s.words)}</Td>
                <Td>
                  {s.hasQuestion ? (
                    <Badge variant="info">Yes</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </Td>
                <Td>
                  {s.hasPersonalization ? (
                    <Badge variant="success">Yes</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </Td>
                <Td right>{formatNumber(s.sent)}</Td>
                <Td right>{formatNumber(s.replied)}</Td>
                <Td right>
                  <span style={{ color: rateColor(s.replyRate, 0.08) }}>
                    {formatPercent(s.replyRate)}
                  </span>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareCallout({
  icon: Icon,
  title,
  a,
  b,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  a: { label: string; sent: number; replied: number; rate: number };
  b: { label: string; sent: number; replied: number; rate: number };
}) {
  const winner = a.rate >= b.rate ? "a" : "b";
  const lift =
    Math.min(a.rate, b.rate) > 0
      ? Math.abs(a.rate - b.rate) / Math.min(a.rate, b.rate)
      : 0;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {lift > 0 && (
          <Badge variant="success" className="ml-auto">
            +{formatPercent(lift, 0)} lift
          </Badge>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[a, b].map((x, i) => {
          const isWinner = (winner === "a" && i === 0) || (winner === "b" && i === 1);
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3",
                isWinner ? "border-success/40 bg-success/5" : "border-border",
              )}
            >
              <div className="text-xs text-muted-foreground">{x.label}</div>
              <div
                className="mt-1 text-2xl font-semibold tabular"
                style={{ color: isWinner ? "var(--success)" : undefined }}
              >
                {formatPercent(x.rate)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground tabular">
                {formatNumber(x.replied)} / {formatNumber(x.sent)} replied
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ================================= Timing =============================== */

function TimingTab({
  timeOfDay,
  dayOfWeek,
  messages,
}: {
  timeOfDay: ReturnType<typeof timeOfDayStats>;
  dayOfWeek: ReturnType<typeof dayOfWeekStats>;
  messages: ReturnType<typeof useSnapshot>["messages"];
}) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build day x hour reply-rate heatmap from raw sent messages.
  const heat = React.useMemo(() => {
    const sentGrid: number[][] = dayNames.map(() => Array(24).fill(0));
    const repGrid: number[][] = dayNames.map(() => Array(24).fill(0));
    for (const msg of messages) {
      if (!isSent(msg) || !msg.sentAt) continue;
      const dt = new Date(msg.sentAt);
      const d = dt.getDay();
      const h = dt.getHours();
      sentGrid[d][h]++;
      if (msg.status === "replied" || msg.repliedAt) repGrid[d][h]++;
    }
    const values = sentGrid.map((row, d) =>
      row.map((sent, h) => (sent > 0 ? (repGrid[d][h] / sent) * 100 : 0)),
    );
    return { values, hasData: sentGrid.some((r) => r.some((v) => v > 0)) };
  }, [messages]);

  const hourCols = Array.from({ length: 24 }, (_, h) => (h % 3 === 0 ? String(h) : ""));

  const activeHours = timeOfDay.filter((b) => b.sent > 0);
  const hourBars = activeHours.map((b) => ({
    label: b.bucket,
    value: b.replyRate,
    color:
      b.replyRate === Math.max(...activeHours.map((x) => x.replyRate))
        ? "var(--success)"
        : "var(--chart-2)",
  }));
  const dayBars = dayOfWeek.map((b) => ({
    label: b.bucket,
    value: b.replyRate,
    color:
      b.replyRate === Math.max(...dayOfWeek.map((x) => x.replyRate)) && b.sent > 0
        ? "var(--success)"
        : "var(--chart-4)",
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <SectionTitle>Reply rate by hour of day</SectionTitle>
            {activeHours.length === 0 ? (
              <EmptyState title="No timing data" className="py-8" />
            ) : (
              <BarChart
                data={hourBars}
                valueFormat={(v) => formatPercent(v, 0)}
                height={180}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <SectionTitle>Reply rate by day of week</SectionTitle>
            <BarChart
              data={dayBars}
              valueFormat={(v) => formatPercent(v, 0)}
              height={180}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <SectionTitle>Send-time heatmap · reply rate (day × hour)</SectionTitle>
          {heat.hasData ? (
            <Heatmap
              rows={dayNames}
              cols={hourCols}
              values={heat.values}
              colorFor={(v, max) =>
                v <= 0
                  ? "var(--muted)"
                  : `color-mix(in oklch, var(--success) ${Math.round(
                      (v / max) * 100,
                    )}%, var(--muted))`
              }
            />
          ) : (
            <EmptyState title="Not enough data for a heatmap" className="py-8" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================ Senders =============================== */

function SendersTab({ rows }: { rows: SenderStat[] }) {
  if (rows.length === 0)
    return <EmptyCard title="No sending accounts" desc="Add a sending account to track sender health." />;

  const repColor = (v: number) =>
    v >= 85 ? "var(--success)" : v >= 70 ? "var(--warning)" : "var(--destructive)";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((s) => (
          <Card key={s.accountId} className="flex items-center gap-4 p-4">
            <ProgressRing
              value={s.reputationScore}
              color={repColor(s.reputationScore)}
              size={64}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" title={s.label}>
                {s.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground tabular">
                {formatNumber(s.sent)} sent · {formatPercent(s.replyRate)} reply
              </div>
              <div className="text-xs text-muted-foreground">Reputation</div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            head={
              <>
                <Th>Sender</Th>
                <Th right>Sent</Th>
                <Th right>Bounced</Th>
                <Th right>Replied</Th>
                <Th right>Bounce rate</Th>
                <Th right>Reply rate</Th>
                <Th right>Reputation</Th>
              </>
            }
          >
            {rows.map((s) => (
              <tr key={s.accountId} className="hover:bg-accent/40">
                <Td className="flex items-center gap-2 font-medium">
                  <User className="size-3.5 text-muted-foreground" />
                  {s.label}
                </Td>
                <Td right>{formatNumber(s.sent)}</Td>
                <Td right>{formatNumber(s.bounced)}</Td>
                <Td right>{formatNumber(s.replied)}</Td>
                <Td right>
                  <span style={{ color: rateColor(s.bounceRate, 0.02, true) }}>
                    {formatPercent(s.bounceRate)}
                  </span>
                </Td>
                <Td right>
                  <span style={{ color: rateColor(s.replyRate, 0.08) }}>
                    {formatPercent(s.replyRate)}
                  </span>
                </Td>
                <Td right>
                  <Badge
                    variant={
                      s.reputationScore >= 85
                        ? "success"
                        : s.reputationScore >= 70
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {s.reputationScore}
                  </Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

/* =============================== Industries ============================== */

function IndustriesTab({ rows }: { rows: IndustryStat[] }) {
  if (rows.length === 0)
    return <EmptyCard title="No industry data" desc="Enrich companies with industries to segment performance." />;

  const barData = [...rows]
    .filter((r) => r.sent > 0)
    .sort((a, b) => b.replyRate - a.replyRate)
    .map((r, i) => ({
      label: r.industry,
      value: r.replyRate,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle>Reply rate by industry</SectionTitle>
          {barData.length === 0 ? (
            <EmptyState title="No sends by industry yet" className="py-8" />
          ) : (
            <BarChart
              data={barData}
              horizontal
              valueFormat={(v) => formatPercent(v)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            head={
              <>
                <Th>Industry</Th>
                <Th right>Contacts</Th>
                <Th right>Sent</Th>
                <Th right>Replied</Th>
                <Th right>Meetings</Th>
                <Th right>Customers</Th>
                <Th right>Reply rate</Th>
                <Th right>Conversion</Th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r.industry} className="hover:bg-accent/40">
                <Td className="flex items-center gap-2 font-medium">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  {r.industry}
                </Td>
                <Td right>{formatNumber(r.contacts)}</Td>
                <Td right>{formatNumber(r.sent)}</Td>
                <Td right>{formatNumber(r.replied)}</Td>
                <Td right>{formatNumber(r.meetings)}</Td>
                <Td right>{formatNumber(r.customers)}</Td>
                <Td right>
                  <span style={{ color: rateColor(r.replyRate, 0.08) }}>
                    {formatPercent(r.replyRate)}
                  </span>
                </Td>
                <Td right>
                  <Badge variant={r.conversionRate >= 0.05 ? "success" : "muted"}>
                    {formatPercent(r.conversionRate)}
                  </Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================= Funnel =============================== */

function FunnelTab({
  funnelSteps,
  pipeline,
}: {
  funnelSteps: ReturnType<typeof funnel>;
  pipeline: StageStat[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle>Conversion funnel</SectionTitle>
          <Funnel steps={funnelSteps} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" />
              Pipeline stages
            </span>
          </SectionTitle>
          <DataTable
            head={
              <>
                <Th>Stage</Th>
                <Th right>Contacts</Th>
                <Th right>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    Avg days
                  </span>
                </Th>
                <Th right>Conversion to next</Th>
                <Th right>Drop-off</Th>
              </>
            }
          >
            {pipeline.map((s) => {
              const meta = STAGE_META[s.stage];
              return (
                <tr key={s.stage} className="hover:bg-accent/40">
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <span className="font-medium">{meta.label}</span>
                    </span>
                  </Td>
                  <Td right>{formatNumber(s.count)}</Td>
                  <Td right className="text-muted-foreground">
                    {s.avgDaysInStage}
                  </Td>
                  <Td right>
                    <span style={{ color: rateColor(s.conversionToNext, 0.3) }}>
                      {formatPercent(s.conversionToNext, 0)}
                    </span>
                  </Td>
                  <Td right className="text-muted-foreground">
                    {formatPercent(s.dropOff, 0)}
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================== small helpers =========================== */

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function MiniPill({
  label,
  value,
  icon: Icon,
  accent = "var(--muted-foreground)",
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" style={{ color: accent }} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular">{value}</div>
    </Card>
  );
}

function EmptyCard({ title, desc }: { title: string; desc?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <EmptyState title={title} description={desc} className="py-12" />
      </CardContent>
    </Card>
  );
}
