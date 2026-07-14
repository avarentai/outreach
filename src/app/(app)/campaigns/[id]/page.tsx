"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore, useSnapshot } from "@/lib/store";
import { isLiveMode } from "@/lib/supabase/client";
import { campaignStats, type CampaignStat } from "@/lib/engines/analytics";
import { sequenceDurationDays } from "@/lib/engines/scheduler";
import { PageHeader, StatCard, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState } from "@/components/ui/misc";
import {
  CAMPAIGN_STATUS_META,
  STAGE_META,
  MESSAGE_STATUS_META,
  TEMPLATE_CATEGORY_META,
} from "@/lib/constants";
import {
  formatNumber,
  formatPercent,
  formatDateTime,
  relativeTime,
  cn,
  titleCase,
} from "@/lib/utils";
import type {
  Campaign,
  CampaignStatus,
  Contact,
  SequenceStep,
  EmailMessage,
  SendingWindow,
} from "@/lib/types";
import {
  Megaphone,
  Play,
  Pause,
  ArrowLeft,
  Send,
  Reply,
  ThumbsUp,
  CalendarCheck,
  Mail,
  Clock,
  GitBranch,
  ListChecks,
  Users,
  Timer,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_BADGE: Record<CampaignStatus, "success" | "warning" | "info" | "muted"> = {
  draft: "muted",
  active: "success",
  paused: "warning",
  completed: "info",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const snap = useSnapshot();
  const campaigns = useStore((s) => s.campaigns);
  const contacts = useStore((s) => s.contacts);
  const users = useStore((s) => s.users);
  const sequences = useStore((s) => s.sequences);
  const templates = useStore((s) => s.templates);
  const accounts = useStore((s) => s.accounts);
  const messages = useStore((s) => s.messages);
  const setCampaignStatus = useStore((s) => s.setCampaignStatus);

  const campaign = campaigns.find((c) => c.id === id);

  const stat = React.useMemo<CampaignStat | undefined>(
    () => (id ? campaignStats(snap).find((s) => s.campaignId === id) : undefined),
    [snap, id],
  );

  const enrolled = React.useMemo(
    () => contacts.filter((c) => c.campaignId === id),
    [contacts, id],
  );

  const sequence = campaign ? sequences.find((s) => s.id === campaign.sequenceId) : undefined;

  const recentMessages = React.useMemo(
    () =>
      messages
        .filter((m) => m.campaignId === id)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.sentAt ?? b.scheduledAt ?? b.createdAt).getTime() -
            new Date(a.sentAt ?? a.scheduledAt ?? a.createdAt).getTime(),
        )
        .slice(0, 8),
    [messages, id],
  );

  if (!campaign) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campaign not found" icon={Megaphone} />
        <EmptyState
          icon={<Megaphone className="size-8" />}
          title="This campaign doesn't exist"
          description="It may have been removed or the link is incorrect."
          action={
            <Link href="/campaigns">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> Back to campaigns
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const meta = CAMPAIGN_STATUS_META[campaign.status];
  const owner = users.find((u) => u.id === campaign.ownerId);
  const canRun = campaign.status !== "completed";
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const run = async (status: CampaignStatus) => {
    // LIVE mode: activation materializes real sends server-side. Pause/resume
    // and DEMO mode keep flipping the in-memory store status.
    if (isLiveMode && status === "active") {
      try {
        const res = await fetch("/api/campaigns/activate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ campaignId: campaign.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Activation failed");
        setCampaignStatus(campaign.id, "active");
        toast.success(`Campaign activated — ${data.queued} sends queued`);
      } catch (e) {
        toast.error((e as Error).message);
      }
      return;
    }
    setCampaignStatus(campaign.id, status);
    toast.success(`Campaign ${status}`);
  };

  // Queue prospects enrolled since launch. Idempotent — never re-sends.
  const sync = async () => {
    try {
      const res = await fetch("/api/campaigns/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast.success(
        data.queued > 0
          ? `${data.queued} new prospect${data.queued === 1 ? "" : "s"} queued`
          : "All caught up — no new prospects to queue.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/campaigns"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Campaigns
        </Link>
        <PageHeader
          title={campaign.name}
          icon={Megaphone}
          description={sequence ? `Running sequence: ${sequence.name}` : "No sequence assigned"}
          actions={
            <div className="flex items-center gap-2">
              {owner && (
                <span className="mr-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Avatar name={owner.name} color={owner.avatarColor} size={24} />
                  {owner.name}
                </span>
              )}
              <Badge variant={STATUS_BADGE[campaign.status]} dot={meta.color}>
                {meta.label}
              </Badge>
              {canRun &&
                (campaign.status === "active" ? (
                  <>
                    {isLiveMode && (
                      <Button variant="outline" onClick={() => void sync()}>
                        <RefreshCw className="size-4" /> Sync new prospects
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => run("paused")}>
                      <Pause className="size-4" /> Pause
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => run("active")}>
                    <Play className="size-4" />{" "}
                    {campaign.status === "paused" ? "Resume" : "Activate"}
                  </Button>
                ))}
            </div>
          }
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Prospects" value={formatNumber(enrolled.length)} icon={Users} accent="var(--primary)" />
        <StatCard label="Sent" value={formatNumber(stat?.sent ?? 0)} icon={Send} accent="var(--chart-2)" />
        <StatCard label="Replies" value={formatNumber(stat?.replied ?? 0)} sublabel={formatPercent(stat?.replyRate ?? 0)} icon={Reply} accent="var(--chart-1)" />
        <StatCard label="Positive" value={formatNumber(stat?.positive ?? 0)} sublabel={formatPercent(stat?.positiveRate ?? 0)} icon={ThumbsUp} accent="var(--success)" />
        <StatCard label="Meetings" value={formatNumber(stat?.meetings ?? 0)} icon={CalendarCheck} accent="var(--chart-5)" />
        <StatCard label="Bounce rate" value={formatPercent(stat?.bounceRate ?? 0)} icon={Mail} accent="var(--warning)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Enrolled contacts */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionTitle
              action={
                <span className="text-xs text-muted-foreground tabular">
                  {formatNumber(enrolled.length)} enrolled
                </span>
              }
            >
              Enrolled prospects
            </SectionTitle>
            {enrolled.length === 0 ? (
              <EmptyState
                icon={<Users className="size-7" />}
                title="No prospects enrolled"
                description="Add contacts to this campaign to start the sequence."
                className="py-10"
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Contact</th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                      <th className="px-3 py-2 font-medium">Last contacted</th>
                      <th className="px-3 py-2 text-right font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolled.slice(0, 25).map((c) => (
                      <ContactRow key={c.id} contact={c} />
                    ))}
                  </tbody>
                </table>
                {enrolled.length > 25 && (
                  <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                    +{formatNumber(enrolled.length - 25)} more prospects
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sequence + settings */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <SectionTitle
                action={
                  sequence && (
                    <span className="text-xs text-muted-foreground tabular">
                      ~{Math.round(sequenceDurationDays(sequence))}d span
                    </span>
                  )
                }
              >
                Sequence steps
              </SectionTitle>
              {!sequence || sequence.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sequence steps configured.</p>
              ) : (
                <SequenceSteps
                  steps={sequence.steps}
                  templateName={(tid?: string) => (tid ? templateById.get(tid)?.name : undefined)}
                  templateCategory={(tid?: string) =>
                    tid ? templateById.get(tid)?.category : undefined
                  }
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionTitle>Sending window</SectionTitle>
              <SendingWindowView window={campaign.sendingWindow} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="Stop on reply" value={campaign.stopOnReply ? "On" : "Off"} />
                <MiniStat
                  label="Approval"
                  value={campaign.requireApproval ? "Required" : "Auto"}
                />
              </div>
              <div className="mt-2 grid gap-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Send className="size-3.5" />
                  {campaign.sendingAccountIds.length === 0 ? (
                    <span>No sending accounts</span>
                  ) : (
                    <span className="truncate">
                      {campaign.sendingAccountIds
                        .map((aid) => accounts.find((a) => a.id === aid)?.label ?? "Unknown")
                        .join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent messages */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle>Recent messages</SectionTitle>
          {recentMessages.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-7" />}
              title="No messages yet"
              description="Messages will appear here once the campaign starts sending."
              className="py-10"
            />
          ) : (
            <div className="space-y-1">
              {recentMessages.map((m) => (
                <MessageRow key={m.id} message={m} contacts={contacts} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Sub-views --------------------------------- */

function ContactRow({ contact }: { contact: Contact }) {
  const stage = STAGE_META[contact.stage];
  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/40">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Avatar name={`${contact.firstName} ${contact.lastName}`} size={26} />
          <div className="min-w-0">
            <div className="truncate font-medium">
              {contact.firstName} {contact.lastName}
            </div>
            <div className="truncate text-xs text-muted-foreground">{contact.email}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
          {stage.short}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground tabular">
        {contact.lastContactedAt ? relativeTime(contact.lastContactedAt) : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-semibold tabular">{contact.score}</span>
      </td>
    </tr>
  );
}

function SequenceSteps({
  steps,
  templateName,
  templateCategory,
}: {
  steps: SequenceStep[];
  templateName: (id?: string) => string | undefined;
  templateCategory: (id?: string) => string | undefined;
}) {
  const emailIndex = (() => {
    let n = 0;
    return () => ++n;
  })();

  return (
    <ol className="relative space-y-3 pl-1">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3">
            {!isLast && (
              <span className="absolute left-[13px] top-7 h-[calc(100%-4px)] w-px bg-border" />
            )}
            <StepIcon step={step} />
            <div className="min-w-0 flex-1 pb-1">
              <StepBody
                step={step}
                order={step.type === "email" ? emailIndex() : undefined}
                templateName={templateName}
                templateCategory={templateCategory}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepIcon({ step }: { step: SequenceStep }) {
  const map: Record<SequenceStep["type"], { icon: React.ReactNode; color: string }> = {
    email: { icon: <Mail className="size-3.5" />, color: "var(--chart-2)" },
    wait: { icon: <Clock className="size-3.5" />, color: "var(--muted-foreground)" },
    condition: { icon: <GitBranch className="size-3.5" />, color: "var(--chart-1)" },
    manual_task: { icon: <ListChecks className="size-3.5" />, color: "var(--warning)" },
  };
  const m = map[step.type];
  return (
    <span
      className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card"
      style={{ color: m.color }}
    >
      {m.icon}
    </span>
  );
}

function StepBody({
  step,
  order,
  templateName,
  templateCategory,
}: {
  step: SequenceStep;
  order?: number;
  templateName: (id?: string) => string | undefined;
  templateCategory: (id?: string) => string | undefined;
}) {
  if (step.type === "email") {
    const name = templateName(step.templateId);
    const cat = templateCategory(step.templateId);
    return (
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Email {order ?? ""}</span>
          {cat && (
            <Badge variant="muted">
              {TEMPLATE_CATEGORY_META[cat as keyof typeof TEMPLATE_CATEGORY_META]?.label ??
                titleCase(cat)}
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {step.subjectOverride || name || "Untitled template"}
        </div>
      </div>
    );
  }
  if (step.type === "wait") {
    const parts = [
      step.waitDays ? `${step.waitDays}d` : "",
      step.waitHours ? `${step.waitHours}h` : "",
    ].filter(Boolean);
    return (
      <div>
        <span className="text-sm font-medium">Wait</span>
        <div className="text-xs text-muted-foreground">{parts.join(" ") || "0d"}</div>
      </div>
    );
  }
  if (step.type === "condition") {
    return (
      <div>
        <span className="text-sm font-medium">Condition</span>
        <div className="text-xs text-muted-foreground">
          Stop {titleCase(step.stopOn ?? "never")}
        </div>
      </div>
    );
  }
  return (
    <div>
      <span className="text-sm font-medium">Manual task</span>
      <div className="text-xs text-muted-foreground">{step.taskLabel ?? "Task"}</div>
    </div>
  );
}

function SendingWindowView({ window: w }: { window: SendingWindow }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {DAY_NAMES.map((d, i) => (
          <span
            key={d}
            className={cn(
              "flex h-6 w-8 items-center justify-center rounded-md border text-[11px] font-medium",
              w.daysOfWeek.includes(i)
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground/60",
            )}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <WindowRow icon={<Clock className="size-3.5" />} label="Hours" value={`${fmtHour(w.startHour)}–${fmtHour(w.endHour)}`} />
        <WindowRow icon={<Send className="size-3.5" />} label="Daily / account" value={`${w.dailyLimitPerAccount}`} />
        <WindowRow icon={<Timer className="size-3.5" />} label="Min gap" value={`${w.minMinutesBetweenSends}m`} />
        <WindowRow icon={<ChevronRight className="size-3.5" />} label="Jitter" value={`±${w.jitterMinutes}m`} />
      </div>
      <div className="text-[11px] text-muted-foreground">{w.timezone}</div>
    </div>
  );
}

function WindowRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium tabular">{value}</span>
    </div>
  );
}

function fmtHour(h: number): string {
  const suffix = h >= 12 ? "pm" : "am";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

function MessageRow({ message, contacts }: { message: EmailMessage; contacts: Contact[] }) {
  const contact = contacts.find((c) => c.id === message.contactId);
  const status = MESSAGE_STATUS_META[message.status];
  const when = message.sentAt ?? message.scheduledAt ?? message.createdAt;
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/50">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in oklch, ${status.color} 15%, transparent)`, color: status.color }}
      >
        {message.direction === "inbound" ? <Reply className="size-3.5" /> : <Send className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{message.subject || "(no subject)"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {contact ? `${contact.firstName} ${contact.lastName}` : message.toEmail}
        </div>
      </div>
      <Badge
        variant="outline"
        className="shrink-0"
        style={{ color: status.color, borderColor: `color-mix(in oklch, ${status.color} 30%, transparent)` }}
      >
        {status.label}
      </Badge>
      <span className="hidden shrink-0 text-xs text-muted-foreground tabular sm:block">
        {formatDateTime(when)}
      </span>
    </div>
  );
}
