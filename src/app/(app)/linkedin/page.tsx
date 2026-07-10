"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import type { Contact, Company, LinkedInStatus } from "@/lib/types";
import { PageHeader, MiniStat } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import {
  Linkedin,
  ShieldCheck,
  ExternalLink,
  Search,
  Link2Off,
  Send,
  UserCheck,
  MessagesSquare,
  Reply,
  CircleDashed,
  CalendarClock,
} from "lucide-react";

/* --------------------------- LinkedIn status meta -------------------------- */

const LINKEDIN_STATUS_META: Record<
  LinkedInStatus,
  {
    label: string;
    color: string;
    variant: "muted" | "secondary" | "warning" | "info" | "success" | "default";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  none: { label: "No status", color: "var(--muted-foreground)", variant: "muted", icon: CircleDashed },
  not_connected: { label: "Not connected", color: "var(--muted-foreground)", variant: "secondary", icon: Link2Off },
  request_sent: { label: "Request sent", color: "var(--warning)", variant: "warning", icon: Send },
  connected: { label: "Connected", color: "var(--info)", variant: "info", icon: UserCheck },
  messaged: { label: "Messaged", color: "var(--chart-1)", variant: "default", icon: MessagesSquare },
  replied: { label: "Replied", color: "var(--success)", variant: "success", icon: Reply },
};

const STATUS_ORDER: LinkedInStatus[] = [
  "none",
  "not_connected",
  "request_sent",
  "connected",
  "messaged",
  "replied",
];

/* -------------------------------- Page ------------------------------------- */

export default function LinkedInPage() {
  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const updateContact = useStore((s) => s.updateContact);

  const [tab, setTab] = React.useState<string>("all");
  const [query, setQuery] = React.useState("");
  const [onlyWithUrl, setOnlyWithUrl] = React.useState(true);

  const companyById = React.useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );

  // Base population: contacts scoped by the "only with LinkedIn URL" toggle.
  const base = React.useMemo(() => {
    return onlyWithUrl ? contacts.filter((c) => !!c.linkedinUrl) : contacts;
  }, [contacts, onlyWithUrl]);

  // Counts per status over the base population (drives tab badges + stats strip).
  const counts = React.useMemo(() => {
    const map: Record<LinkedInStatus, number> = {
      none: 0,
      not_connected: 0,
      request_sent: 0,
      connected: 0,
      messaged: 0,
      replied: 0,
    };
    for (const c of base) map[c.linkedinStatus] = (map[c.linkedinStatus] ?? 0) + 1;
    return map;
  }, [base]);

  const inProgress = counts.request_sent + counts.connected + counts.messaged;

  const tabs = React.useMemo(
    () => [
      { value: "all", label: "All", count: base.length },
      ...STATUS_ORDER.map((s) => ({
        value: s,
        label: LINKEDIN_STATUS_META[s].label,
        count: counts[s],
      })),
    ],
    [base.length, counts],
  );

  // Final visible rows: apply status tab + search query.
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return base
      .filter((c) => (tab === "all" ? true : c.linkedinStatus === tab))
      .filter((c) => {
        if (!q) return true;
        const co = companyById.get(c.companyId);
        return (
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          (c.jobTitle ?? "").toLowerCase().includes(q) ||
          (co?.name ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Surface actionable rows first: overdue follow-ups, then status progression.
        const fa = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
        const fb = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
        if (fa !== fb) return fa - fb;
        return b.score - a.score;
      });
  }, [base, tab, query, companyById]);

  const dueCount = React.useMemo(
    () =>
      base.filter(
        (c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() <= Date.now(),
      ).length,
    [base],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn Companion"
        description="Track connections, outreach status, and reminders alongside your email pipeline."
        icon={Linkedin}
      />

      {/* Compliance banner */}
      <Card className="flex items-start gap-3 border-info/30 bg-info/5 p-4">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-info/12 text-info">
          <ShieldCheck className="size-4.5" />
        </div>
        <div className="text-sm">
          <p className="font-medium">Tracking only — no automation.</p>
          <p className="mt-0.5 text-muted-foreground">
            This companion only stores the connection status and private notes you enter here. It
            never sends connection requests, messages, or performs any action on LinkedIn on your
            behalf. Move through each step manually on LinkedIn to stay fully compliant with their
            User Agreement.
          </p>
        </div>
      </Card>

      {/* Stats strip — counts per status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Tracked" value={base.length} />
        {STATUS_ORDER.filter((s) => s !== "none").map((s) => (
          <MiniStat
            key={s}
            label={LINKEDIN_STATUS_META[s].label}
            value={counts[s]}
            color={LINKEDIN_STATUS_META[s].color}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={tabs} value={tab} onValueChange={setTab} className="overflow-x-auto" />
        <div className="flex items-center gap-2">
          {dueCount > 0 && (
            <Badge variant="warning" className="gap-1">
              <CalendarClock className="size-3" />
              {dueCount} follow-up{dueCount === 1 ? "" : "s"} due
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setOnlyWithUrl((v) => !v)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              onlyWithUrl
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {onlyWithUrl ? "With LinkedIn URL" : "All contacts"}
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, title…"
              className="h-9 w-full pl-8 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Linkedin className="size-8" />}
          title={
            base.length === 0
              ? "No LinkedIn contacts yet"
              : "No contacts match this view"
          }
          description={
            base.length === 0
              ? "Contacts with a LinkedIn URL will appear here. Toggle to “All contacts” to track anyone."
              : "Try a different status tab or clear your search."
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          {/* header row */}
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)] gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Contact</span>
            <span>Company</span>
            <span>Outreach status</span>
            <span>Notes</span>
            <span>Follow-up</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                company={companyById.get(c.companyId)}
                onStatus={(linkedinStatus) => updateContact(c.id, { linkedinStatus })}
                onNotes={(linkedinNotes) => updateContact(c.id, { linkedinNotes })}
              />
            ))}
          </div>
        </Card>
      )}

      {inProgress > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {inProgress} contact{inProgress === 1 ? "" : "s"} mid-outreach · {counts.replied} replied
        </p>
      )}
    </div>
  );
}

/* -------------------------------- Row -------------------------------------- */

function ContactRow({
  contact,
  company,
  onStatus,
  onNotes,
}: {
  contact: Contact;
  company?: Company;
  onStatus: (status: LinkedInStatus) => void;
  onNotes: (notes: string) => void;
}) {
  const meta = LINKEDIN_STATUS_META[contact.linkedinStatus];
  const StatusIcon = meta.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  const name = `${contact.firstName} ${contact.lastName}`.trim() || contact.email;
  const overdue =
    !!contact.nextFollowUpAt && new Date(contact.nextFollowUpAt).getTime() <= Date.now();

  return (
    <div className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-accent/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      {/* Contact */}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={name} color={company ? undefined : "var(--muted-foreground)"} size={34} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{name}</span>
            {contact.linkedinUrl ? (
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noreferrer noopener"
                title="Open LinkedIn profile in a new tab"
                className="inline-flex shrink-0 items-center text-info hover:text-info/80"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {contact.jobTitle || "—"}
          </div>
        </div>
      </div>

      {/* Company */}
      <div className="min-w-0 lg:pt-1">
        <div className="truncate text-sm">{company?.name ?? "—"}</div>
        {company?.industry && (
          <div className="truncate text-xs text-muted-foreground">{company.industry}</div>
        )}
      </div>

      {/* Status */}
      <div className="lg:pt-0.5">
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground lg:hidden">
          Outreach status
        </label>
        <div className="flex items-center gap-2">
          <StatusIcon className="size-4 shrink-0" style={{ color: meta.color }} />
          <Select
            value={contact.linkedinStatus}
            onChange={(e) => onStatus(e.target.value as LinkedInStatus)}
            className="h-8"
            aria-label={`Outreach status for ${name}`}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {LINKEDIN_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground lg:hidden">
          Notes
        </label>
        <NotesField
          value={contact.linkedinNotes ?? ""}
          onCommit={onNotes}
          placeholder="Private notes — talking points, mutual connections…"
        />
      </div>

      {/* Follow-up */}
      <div className="lg:pt-1">
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground lg:hidden">
          Follow-up
        </label>
        {contact.nextFollowUpAt ? (
          <div className="flex flex-col gap-1">
            <Badge variant={overdue ? "warning" : "outline"} className="w-fit gap-1">
              <CalendarClock className="size-3" />
              {formatDate(contact.nextFollowUpAt)}
            </Badge>
            <span
              className={cn(
                "text-[11px]",
                overdue ? "text-warning" : "text-muted-foreground",
              )}
            >
              {relativeTime(contact.nextFollowUpAt)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No reminder</span>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Notes (debounced-commit) ---------------------- */

function NotesField({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState(value);

  // Keep local draft in sync when the underlying value changes externally.
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
      rows={2}
      className="min-h-[52px] text-sm"
    />
  );
}
