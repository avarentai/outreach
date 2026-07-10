"use client";

import * as React from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHeader, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import type { Meeting, MeetingOutcome } from "@/lib/types";
import { formatDateTime, formatDate, formatTime, isSameDay, cn, formatPercent } from "@/lib/utils";
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Users,
  Building2,
  CheckCircle2,
  Trophy,
  UserX,
  ArrowRight,
} from "lucide-react";

const OUTCOME_META: Record<MeetingOutcome, { label: string; variant: "default" | "success" | "warning" | "destructive" | "info" | "muted" }> = {
  scheduled: { label: "Scheduled", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  won: { label: "Won", variant: "success" },
  no_show: { label: "No-show", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "muted" },
  lost: { label: "Lost", variant: "destructive" },
};

export default function MeetingsPage() {
  const meetings = useStore((s) => s.meetings);
  const companies = useStore((s) => s.companies);
  const contacts = useStore((s) => s.contacts);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const addMeeting = useStore((s) => s.addMeeting);
  const updateMeeting = useStore((s) => s.updateMeeting);

  const [tab, setTab] = React.useState<"upcoming" | "past">("upcoming");
  const [editing, setEditing] = React.useState<Meeting | null>(null);
  const [scheduling, setScheduling] = React.useState(false);

  const companyById = React.useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const contactById = React.useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const now = new Date();
  const { upcoming, past } = React.useMemo(() => {
    const up: Meeting[] = [];
    const pa: Meeting[] = [];
    for (const m of meetings) {
      const future = new Date(m.scheduledAt) >= now && m.outcome === "scheduled";
      (future ? up : pa).push(m);
    }
    up.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
    pa.sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    return { upcoming: up, past: pa };
  }, [meetings]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = React.useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = meetings.filter((m) => new Date(m.scheduledAt) >= weekStart && new Date(m.scheduledAt) <= new Date(weekStart.getTime() + 7 * 864e5)).length;
    const completed = meetings.filter((m) => m.outcome === "completed" || m.outcome === "won").length;
    const won = meetings.filter((m) => m.outcome === "won").length;
    const decided = meetings.filter((m) => m.outcome !== "scheduled").length;
    const noShows = meetings.filter((m) => m.outcome === "no_show").length;
    return { thisWeek, completed, won, noShowRate: decided ? noShows / decided : 0 };
  }, [meetings]);

  const list = tab === "upcoming" ? upcoming : past;

  // group by day
  const grouped = React.useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of list) {
      const key = new Date(m.scheduledAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [list]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meeting Center"
        description="Track every discovery call, demo, and follow-up conversation."
        icon={CalendarDays}
        actions={
          <Button onClick={() => setScheduling(true)}>
            <CalendarPlus className="size-4" /> Schedule meeting
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="This week" value={stats.thisWeek} />
        <MiniStat label="Completed" value={stats.completed} color="var(--success)" />
        <MiniStat label="Won" value={stats.won} color="var(--success)" />
        <MiniStat label="No-show rate" value={formatPercent(stats.noShowRate, 0)} color="var(--warning)" />
      </div>

      <Tabs
        variant="pills"
        value={tab}
        onValueChange={(v) => setTab(v as "upcoming" | "past")}
        tabs={[
          { value: "upcoming", label: "Upcoming", count: upcoming.length },
          { value: "past", label: "Past", count: past.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title={tab === "upcoming" ? "No upcoming meetings" : "No past meetings"}
          description="Schedule a meeting or mark a booked call to see it here."
          action={
            <Button variant="outline" onClick={() => setScheduling(true)}>
              <CalendarPlus className="size-4" /> Schedule meeting
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {isSameDay(day, now) ? "Today" : formatDate(new Date(day).toISOString())}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((m) => {
                  const company = companyById.get(m.companyId);
                  const contact = contactById.get(m.contactId);
                  const owner = users.find((u) => u.id === m.ownerId);
                  const meta = OUTCOME_META[m.outcome];
                  return (
                    <Card
                      key={m.id}
                      className="cursor-pointer p-4 transition-shadow hover:shadow-md"
                      onClick={() => setEditing(m)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted text-center">
                            <span className="text-[10px] uppercase text-muted-foreground">
                              {new Date(m.scheduledAt).toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="text-sm font-semibold leading-none tabular">
                              {new Date(m.scheduledAt).getDate()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{m.title}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" /> {formatTime(m.scheduledAt)} · {m.durationMinutes}m
                              </span>
                              {company && (
                                <Link
                                  href={`/companies/${company.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 hover:text-foreground hover:underline"
                                >
                                  <Building2 className="size-3" /> {company.name}
                                </Link>
                              )}
                              {contact && (
                                <span className="flex items-center gap-1">
                                  <Users className="size-3" /> {contact.firstName} {contact.lastName}
                                </span>
                              )}
                            </div>
                            {m.nextAction && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-primary">
                                <ArrowRight className="size-3" /> {m.nextAction}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {owner && <Avatar name={owner.name} color={owner.avatarColor} size={24} />}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MeetingDialog meeting={editing} onClose={() => setEditing(null)} onSave={(patch) => { updateMeeting(editing.id, patch); setEditing(null); }} />
      )}
      {scheduling && (
        <ScheduleDialog
          onClose={() => setScheduling(false)}
          onCreate={(m) => {
            addMeeting({ ...m, ownerId: currentUserId });
            setScheduling(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------- view/edit -------------------------------- */

function MeetingDialog({
  meeting,
  onClose,
  onSave,
}: {
  meeting: Meeting;
  onClose: () => void;
  onSave: (patch: Partial<Meeting>) => void;
}) {
  const [agenda, setAgenda] = React.useState(meeting.agenda ?? "");
  const [notes, setNotes] = React.useState(meeting.notes ?? "");
  const [outcome, setOutcome] = React.useState<MeetingOutcome>(meeting.outcome);
  const [nextAction, setNextAction] = React.useState(meeting.nextAction ?? "");

  return (
    <Dialog open onClose={onClose} size="lg">
      <DialogHeader title={meeting.title} description={formatDateTime(meeting.scheduledAt)} onClose={onClose} />
      <DialogBody className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {meeting.attendees.map((a) => (
            <Badge key={a} variant="muted">{a}</Badge>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label>Agenda</Label>
          <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Meeting notes, key takeaways…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value as MeetingOutcome)}>
              {Object.entries(OUTCOME_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Next action</Label>
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Send proposal…" />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ agenda, notes, outcome, nextAction })}>Save changes</Button>
      </DialogFooter>
    </Dialog>
  );
}

/* -------------------------------- schedule -------------------------------- */

function ScheduleDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (m: Omit<Meeting, "id" | "createdAt" | "ownerId">) => void;
}) {
  const companies = useStore((s) => s.companies);
  const contacts = useStore((s) => s.contacts);
  const [companyId, setCompanyId] = React.useState(companies[0]?.id ?? "");
  const companyContacts = contacts.filter((c) => c.companyId === companyId);
  const [contactId, setContactId] = React.useState(companyContacts[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const [agenda, setAgenda] = React.useState("");

  React.useEffect(() => {
    const first = contacts.find((c) => c.companyId === companyId);
    setContactId(first?.id ?? "");
  }, [companyId, contacts]);

  const company = companies.find((c) => c.id === companyId);
  const contact = contacts.find((c) => c.id === contactId);
  const canSave = companyId && when && (title || company);

  return (
    <Dialog open onClose={onClose} size="md">
      <DialogHeader title="Schedule meeting" description="Log a call or demo with a prospect." onClose={onClose} />
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {companyContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={company ? `Avarent × ${company.name} — Discovery` : "Meeting title"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Date & time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Agenda</Label>
          <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} placeholder="What will you cover?" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!canSave}
          onClick={() =>
            onCreate({
              companyId,
              contactId: contactId || companyContacts[0]?.id || "",
              title: title || (company ? `Avarent × ${company.name} — Discovery` : "Meeting"),
              scheduledAt: new Date(when).toISOString(),
              durationMinutes: duration,
              attendees: [contact?.email, company ? `team@${company.domain}` : ""].filter(Boolean) as string[],
              agenda,
              outcome: "scheduled",
            })
          }
        >
          <CalendarPlus className="size-4" /> Schedule
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
