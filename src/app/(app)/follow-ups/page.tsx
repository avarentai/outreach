"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { FollowUpTask, FollowUpStatus } from "@/lib/types";
import { PageHeader, MiniStat } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { CAMPAIGN_STATUS_META } from "@/lib/constants";
import { cn, relativeTime, formatDateTime, wordCount } from "@/lib/utils";
import {
  RefreshCw,
  Check,
  X,
  Send,
  Inbox,
  Clock,
  CheckCircle2,
  Building2,
  Sparkles,
  CircleDot,
} from "lucide-react";

type TabValue = "due" | "approved" | "skipped" | "sent";

const STATUS_TABS: { value: TabValue; label: string }[] = [
  { value: "due", label: "Due" },
  { value: "approved", label: "Approved" },
  { value: "skipped", label: "Skipped" },
  { value: "sent", label: "Sent" },
];

interface Draft {
  subject: string;
  body: string;
}

export default function FollowUpsPage() {
  const followUps = useStore((s) => s.followUps);
  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const campaigns = useStore((s) => s.campaigns);
  const regenerateFollowUps = useStore((s) => s.regenerateFollowUps);
  const setFollowUpStatus = useStore((s) => s.setFollowUpStatus);

  const [tab, setTab] = React.useState<TabValue>("due");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  // Edited drafts held locally, keyed by follow-up id.
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});

  const contactById = React.useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );
  const companyById = React.useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const campaignById = React.useMemo(
    () => new Map(campaigns.map((c) => [c.id, c])),
    [campaigns],
  );

  const counts = React.useMemo(() => {
    const c: Record<FollowUpStatus, number> = { due: 0, approved: 0, skipped: 0, sent: 0 };
    for (const f of followUps) c[f.status]++;
    return c;
  }, [followUps]);

  // Sorted by soonest due first, filtered to the active tab.
  const visible = React.useMemo(
    () =>
      followUps
        .filter((f) => f.status === tab)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [followUps, tab],
  );

  // Drop selections that are no longer visible in the current tab.
  React.useEffect(() => {
    setSelected((prev) => {
      const visibleIds = new Set(visible.map((f) => f.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visible]);

  const draftFor = React.useCallback(
    (f: FollowUpTask): Draft =>
      drafts[f.id] ?? { subject: f.draftSubject, body: f.draftBody },
    [drafts],
  );

  const patchDraft = (id: string, patch: Partial<Draft>, base: Draft) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...base, ...prev[id], ...patch } }));

  const allSelected = visible.length > 0 && selected.size === visible.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((f) => f.id)));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyStatus = (id: string, status: FollowUpStatus) => {
    setFollowUpStatus(id, status);
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const regenerate = () => {
    regenerateFollowUps();
    setSelected(new Set());
    setDrafts({});
    toast.success("Follow-up queue regenerated");
  };

  const sendSelected = () => {
    const ids = [...selected];
    ids.forEach((id) => setFollowUpStatus(id, "sent"));
    setSelected(new Set());
    toast.success(`${ids.length} follow-up${ids.length === 1 ? "" : "s"} sent`);
  };

  const approveAll = () => {
    const ids = followUps.filter((f) => f.status === "due").map((f) => f.id);
    ids.forEach((id) => setFollowUpStatus(id, "approved"));
    setSelected(new Set());
    toast.success(`${ids.length} follow-up${ids.length === 1 ? "" : "s"} approved`);
  };

  const sendAllApproved = () => {
    const ids = followUps.filter((f) => f.status === "approved").map((f) => f.id);
    ids.forEach((id) => setFollowUpStatus(id, "sent"));
    setSelected(new Set());
    toast.success(`${ids.length} approved follow-up${ids.length === 1 ? "" : "s"} sent`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Review, edit, and clear your daily follow-up queue."
        icon={Inbox}
        actions={
          <>
            <Button variant="outline" onClick={approveAll} disabled={counts.due === 0}>
              <Check className="size-4" /> Approve all
            </Button>
            <Button variant="outline" onClick={sendAllApproved} disabled={counts.approved === 0}>
              <Send className="size-4" /> Send all approved
            </Button>
            <Button onClick={regenerate}>
              <RefreshCw className="size-4" /> Regenerate
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Due today" value={counts.due} color="var(--warning)" />
        <MiniStat label="Approved" value={counts.approved} color="var(--info)" />
        <MiniStat label="Sent" value={counts.sent} color="var(--success)" />
        <MiniStat label="Skipped" value={counts.skipped} color="var(--muted-foreground)" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={STATUS_TABS.map((t) => ({ ...t, count: counts[t.value] }))}
          value={tab}
          onValueChange={(v) => setTab(v as TabValue)}
        />
        <p className="text-xs text-muted-foreground tabular">
          {counts.due} due · {counts.approved} approved
        </p>
      </div>

      {/* Bulk toolbar */}
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-medium"
            aria-label="Select all"
          >
            <CheckBox checked={allSelected} indeterminate={someSelected} />
            Select all
          </button>
          <span className="text-xs text-muted-foreground tabular">
            {selected.size} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={sendSelected}
              disabled={selected.size === 0}
            >
              <Send className="size-3.5" /> Send selected
            </Button>
            {tab === "due" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ids = [...selected];
                  ids.forEach((id) => applyStatus(id, "approved"));
                }}
                disabled={selected.size === 0}
              >
                <Check className="size-3.5" /> Approve selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Queue */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<TabIcon tab={tab} />}
          title={emptyTitle(tab)}
          description={emptyDescription(tab)}
          action={
            tab === "due" ? (
              <Button variant="outline" onClick={regenerate}>
                <RefreshCw className="size-4" /> Regenerate queue
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((f) => {
            const contact = contactById.get(f.contactId);
            const company = companyById.get(f.companyId);
            const campaign = f.campaignId ? campaignById.get(f.campaignId) : undefined;
            const draft = draftFor(f);
            const overdue = new Date(f.dueAt).getTime() < Date.now();
            const name = contact
              ? `${contact.firstName} ${contact.lastName}`.trim() || contact.email
              : "Unknown contact";

            return (
              <Card
                key={f.id}
                className={cn(
                  "overflow-hidden p-0 transition-shadow",
                  selected.has(f.id) && "ring-1 ring-primary/40",
                )}
              >
                {/* Header row */}
                <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleOne(f.id)}
                    className="mt-1"
                    aria-label={`Select follow-up for ${name}`}
                  >
                    <CheckBox checked={selected.has(f.id)} />
                  </button>
                  <Avatar
                    name={name}
                    color={contact?.ownerId ? undefined : "var(--chart-2)"}
                    size={34}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {contact ? (
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="truncate text-sm font-semibold hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-semibold">{name}</span>
                      )}
                      {contact?.jobTitle && (
                        <span className="truncate text-xs text-muted-foreground">
                          {contact.jobTitle}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3" />
                        {company ? (
                          <Link
                            href={`/companies/${company.id}`}
                            className="hover:underline"
                          >
                            {company.name}
                          </Link>
                        ) : (
                          "Unknown company"
                        )}
                      </span>
                      {contact?.email && (
                        <span className="truncate">· {contact.email}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs tabular",
                        overdue ? "text-warning" : "text-muted-foreground",
                      )}
                      title={formatDateTime(f.dueAt)}
                    >
                      <Clock className="size-3" />
                      {overdue ? "Overdue" : "Due"} {relativeTime(f.dueAt)}
                    </span>
                    {campaign && (
                      <Badge variant="outline" dot={CAMPAIGN_STATUS_META[campaign.status].color}>
                        {campaign.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Reason */}
                <div className="flex items-center gap-2 px-4 pt-3">
                  <Badge variant="info">
                    <Sparkles className="size-3" /> {f.reason}
                  </Badge>
                </div>

                {/* Editable draft */}
                <div className="space-y-3 px-4 py-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`subj-${f.id}`}>Subject</Label>
                    <Input
                      id={`subj-${f.id}`}
                      value={draft.subject}
                      onChange={(e) =>
                        patchDraft(f.id, { subject: e.target.value }, {
                          subject: f.draftSubject,
                          body: f.draftBody,
                        })
                      }
                      placeholder="Subject line"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`body-${f.id}`}>Message</Label>
                      <span className="text-[11px] text-muted-foreground tabular">
                        {wordCount(draft.body)} words
                      </span>
                    </div>
                    <Textarea
                      id={`body-${f.id}`}
                      value={draft.body}
                      onChange={(e) =>
                        patchDraft(f.id, { body: e.target.value }, {
                          subject: f.draftSubject,
                          body: f.draftBody,
                        })
                      }
                      className="min-h-[140px] leading-relaxed"
                      placeholder="Write your follow-up…"
                    />
                  </div>
                </div>

                {/* Per-item actions */}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-4 py-2.5">
                  {f.status !== "skipped" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => applyStatus(f.id, "skipped")}
                    >
                      <X className="size-3.5" /> Skip
                    </Button>
                  )}
                  {f.status === "due" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyStatus(f.id, "approved")}
                    >
                      <Check className="size-3.5" /> Approve
                    </Button>
                  )}
                  {(f.status === "skipped" || f.status === "sent") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyStatus(f.id, "due")}
                    >
                      <RefreshCw className="size-3.5" /> Requeue
                    </Button>
                  )}
                  {f.status !== "sent" && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => applyStatus(f.id, "sent")}
                    >
                      <Send className="size-3.5" /> Send
                    </Button>
                  )}
                  {f.status === "sent" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" /> Sent
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Checkbox ------------------------------- */

function CheckBox({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  const active = checked || indeterminate;
  return (
    <span
      className={cn(
        "flex size-4 items-center justify-center rounded border transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-transparent",
      )}
    >
      {checked ? (
        <Check className="size-3" strokeWidth={3} />
      ) : indeterminate ? (
        <span className="h-0.5 w-2 rounded-full bg-primary-foreground" />
      ) : null}
    </span>
  );
}

/* ----------------------------- Empty states ----------------------------- */

function TabIcon({ tab }: { tab: TabValue }) {
  const cls = "size-6";
  if (tab === "sent") return <CheckCircle2 className={cls} />;
  if (tab === "approved") return <Check className={cls} />;
  if (tab === "skipped") return <X className={cls} />;
  return <CircleDot className={cls} />;
}

function emptyTitle(tab: TabValue): string {
  switch (tab) {
    case "due":
      return "Inbox zero — no follow-ups due";
    case "approved":
      return "Nothing approved yet";
    case "skipped":
      return "No skipped follow-ups";
    case "sent":
      return "No follow-ups sent yet";
  }
}

function emptyDescription(tab: TabValue): string {
  switch (tab) {
    case "due":
      return "You're all caught up. Regenerate the queue to surface new follow-ups from your active campaigns.";
    case "approved":
      return "Approved follow-ups are staged here, ready to send in bulk.";
    case "skipped":
      return "Follow-ups you skip land here. Requeue any to bring them back.";
    case "sent":
      return "Sent follow-ups are logged as activity against each contact.";
  }
}
