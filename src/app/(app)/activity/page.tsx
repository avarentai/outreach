"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, Separator } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { ACTIVITY_META } from "@/lib/constants";
import { relativeTime, formatDate, formatTime, isSameDay, cn, formatNumber } from "@/lib/utils";
import type { Activity, ActivityType } from "@/lib/types";
import { Activity as ActivityIcon, Search, Send, MailOpen, CalendarCheck, Megaphone, UserPlus, X, Zap } from "lucide-react";
import * as Icons from "lucide-react";

/* Category groupings for the filter bar. */
const CATEGORIES: {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  types: ActivityType[] | null; // null == all
}[] = [
  { value: "all", label: "All", icon: ActivityIcon, types: null },
  {
    value: "emails",
    label: "Emails",
    icon: Send,
    types: ["email_sent", "email_scheduled", "email_delivered", "email_bounced"],
  },
  {
    value: "replies",
    label: "Replies",
    icon: MailOpen,
    types: ["reply_received", "positive_reply"],
  },
  {
    value: "meetings",
    label: "Meetings",
    icon: CalendarCheck,
    types: ["meeting_booked", "meeting_completed"],
  },
  {
    value: "campaigns",
    label: "Campaigns",
    icon: Megaphone,
    types: ["campaign_created", "campaign_paused", "campaign_resumed"],
  },
  {
    value: "leads",
    label: "Leads",
    icon: UserPlus,
    types: [
      "lead_imported",
      "lead_created",
      "stage_changed",
      "crawl_completed",
      "note_added",
      "template_edited",
      "user_login",
    ],
  },
];

const TYPE_TO_CATEGORY = new Map<ActivityType, string>();
for (const cat of CATEGORIES) {
  if (!cat.types) continue;
  for (const t of cat.types) TYPE_TO_CATEGORY.set(t, cat.value);
}

/* Human day-group label: Today, Yesterday, else full date. */
function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (isSameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  return formatDate(iso);
}

export default function ActivityPage() {
  const activities = useStore((s) => s.activities);
  const users = useStore((s) => s.users);

  const [category, setCategory] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const userById = React.useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  // Counts per category (over all activities, unfiltered by search).
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: activities.length };
    for (const cat of CATEGORIES) {
      if (!cat.types) continue;
      counts[cat.value] = activities.filter((a) => cat.types!.includes(a.type)).length;
    }
    return counts;
  }, [activities]);

  // Apply category + search filters.
  const filtered = React.useMemo(() => {
    const activeCat = CATEGORIES.find((c) => c.value === category);
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      if (activeCat?.types && !activeCat.types.includes(a.type)) return false;
      if (q && !a.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activities, category, query]);

  // Group filtered activities by day (preserving store order = newest first).
  const groups = React.useMemo(() => {
    const now = new Date();
    const out: { label: string; items: Activity[] }[] = [];
    const byLabel = new Map<string, { label: string; items: Activity[] }>();
    for (const a of filtered) {
      const label = dayLabel(a.createdAt, now);
      let g = byLabel.get(label);
      if (!g) {
        g = { label, items: [] };
        byLabel.set(label, g);
        out.push(g);
      }
      g.items.push(a);
    }
    return out;
  }, [filtered]);

  const todayCount = React.useMemo(() => {
    const now = new Date();
    return activities.filter((a) => isSameDay(a.createdAt, now)).length;
  }, [activities]);

  const weekCount = React.useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return activities.filter((a) => new Date(a.createdAt).getTime() >= cutoff).length;
  }, [activities]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="A full audit trail of everything happening across your outbound."
        icon={ActivityIcon}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total events" value={formatNumber(activities.length)} icon={ActivityIcon} accent="var(--primary)" />
        <StatCard label="Today" value={formatNumber(todayCount)} icon={Zap} accent="var(--chart-2)" />
        <StatCard label="Last 7 days" value={formatNumber(weekCount)} icon={CalendarCheck} accent="var(--chart-1)" />
        <StatCard label="Matching filter" value={formatNumber(filtered.length)} icon={Search} accent="var(--chart-4)" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="pills"
          value={category}
          onValueChange={setCategory}
          tabs={CATEGORIES.map((c) => ({
            value: c.value,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <c.icon className="size-3.5" />
                {c.label}
              </span>
            ),
            count: categoryCounts[c.value] ?? 0,
          }))}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activity…"
            className="pl-8 pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon className="size-8" />}
              title={query || category !== "all" ? "No matching activity" : "No activity yet"}
              description={
                query || category !== "all"
                  ? "Try a different filter or clear your search."
                  : "Actions across campaigns, replies and leads will appear here."
              }
              action={
                (query || category !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-6">
              {groups.map((group, gi) => (
                <div key={group.label}>
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </h3>
                    <Badge variant="muted">{group.items.length}</Badge>
                    <Separator className="flex-1" />
                  </div>

                  {/* Vertical timeline with connecting line */}
                  <div className="relative pl-1">
                    <div
                      className="absolute left-[15px] top-3 bottom-3 w-px bg-border"
                      aria-hidden
                    />
                    <div className="space-y-1">
                      {group.items.map((a) => {
                        const meta = ACTIVITY_META[a.type];
                        const Icon = (Icons[meta.icon as keyof typeof Icons] ??
                          Zap) as React.ComponentType<{ className?: string }>;
                        const actor = a.actorId ? userById.get(a.actorId) : undefined;
                        return (
                          <div
                            key={a.id}
                            className="group relative flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
                          >
                            {/* Icon bubble sits on the connecting line */}
                            <div
                              className="relative z-[1] mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card"
                              style={{
                                backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)`,
                                color: meta.color,
                              }}
                            >
                              <Icon className="size-3.5" />
                            </div>

                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-sm leading-snug">{a.summary}</p>
                              {actor && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Avatar
                                    name={actor.name}
                                    color={actor.avatarColor}
                                    size={16}
                                  />
                                  <span>{actor.name}</span>
                                </div>
                              )}
                            </div>

                            <span
                              className="shrink-0 pt-0.5 text-xs tabular text-muted-foreground"
                              title={`${formatDate(a.createdAt)} · ${formatTime(a.createdAt)}`}
                            >
                              {relativeTime(a.createdAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {gi < groups.length - 1 && <div className="h-1" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
