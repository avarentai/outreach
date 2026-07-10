"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { PageHeader, SectionTitle } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, Separator } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { SENTIMENT_META, STAGE_META } from "@/lib/constants";
import {
  cn,
  relativeTime,
  formatDateTime,
  formatTime,
  addDays,
  avatarColor,
} from "@/lib/utils";
import type { Thread, EmailMessage } from "@/lib/types";
import {
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  ThumbsUp,
  ThumbsDown,
  CalendarCheck,
  Archive,
  Clock,
  CalendarPlus,
  UserPlus,
  Send,
  MessageSquare,
  MoreHorizontal,
  ChevronLeft,
  CircleDot,
} from "lucide-react";

type FilterTab = "all" | "unread" | "positive" | "meetings" | "snoozed" | "archived";

export default function InboxPage() {
  const threads = useStore((s) => s.threads);
  const messages = useStore((s) => s.messages);
  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const comments = useStore((s) => s.comments);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);

  const updateThread = useStore((s) => s.updateThread);
  const setThreadState = useStore((s) => s.setThreadState);
  const setThreadSentiment = useStore((s) => s.setThreadSentiment);
  const markMeetingBooked = useStore((s) => s.markMeetingBooked);
  const updateContact = useStore((s) => s.updateContact);
  const addComment = useStore((s) => s.addComment);

  const [tab, setTab] = React.useState<FilterTab>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [reply, setReply] = React.useState("");

  const contactById = React.useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );
  const companyById = React.useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  /* Sorted threads, newest activity first */
  const sortedThreads = React.useMemo(
    () =>
      [...threads].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      ),
    [threads],
  );

  const counts = React.useMemo(() => {
    const open = sortedThreads.filter((t) => t.state !== "archived");
    return {
      all: open.filter((t) => t.state === "open").length,
      unread: open.filter((t) => t.unread && t.state === "open").length,
      positive: open.filter((t) => t.sentiment === "positive" && t.state === "open").length,
      meetings: open.filter((t) => t.meetingBooked).length,
      snoozed: sortedThreads.filter((t) => t.state === "snoozed").length,
      archived: sortedThreads.filter((t) => t.state === "archived").length,
    };
  }, [sortedThreads]);

  const filtered = React.useMemo(() => {
    switch (tab) {
      case "unread":
        return sortedThreads.filter((t) => t.unread && t.state === "open");
      case "positive":
        return sortedThreads.filter((t) => t.sentiment === "positive" && t.state === "open");
      case "meetings":
        return sortedThreads.filter((t) => t.meetingBooked && t.state !== "archived");
      case "snoozed":
        return sortedThreads.filter((t) => t.state === "snoozed");
      case "archived":
        return sortedThreads.filter((t) => t.state === "archived");
      default:
        return sortedThreads.filter((t) => t.state === "open");
    }
  }, [sortedThreads, tab]);

  /* Keep selection valid; default to first thread in the active filter */
  React.useEffect(() => {
    if (selectedId && filtered.some((t) => t.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const selected = React.useMemo(
    () => (selectedId ? threads.find((t) => t.id === selectedId) ?? null : null),
    [threads, selectedId],
  );

  const threadMessages = React.useMemo<EmailMessage[]>(() => {
    if (!selected) return [];
    return messages
      .filter((m) => m.threadId === selected.id)
      .sort((a, b) => {
        const ta = new Date(a.sentAt ?? a.createdAt).getTime();
        const tb = new Date(b.sentAt ?? b.createdAt).getTime();
        return ta - tb;
      });
  }, [messages, selected]);

  const threadComments = React.useMemo(() => {
    if (!selected) return [];
    return comments
      .filter((c) => c.entityType === "thread" && c.entityId === selected.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [comments, selected]);

  /* Mark read when a thread is opened */
  const openThread = React.useCallback(
    (id: string) => {
      setSelectedId(id);
      const t = threads.find((x) => x.id === id);
      if (t?.unread) updateThread(id, { unread: false });
    },
    [threads, updateThread],
  );

  const selContact = selected ? contactById.get(selected.contactId) : undefined;
  const selCompany = selected ? companyById.get(selected.companyId) : undefined;
  const selOwner = selected?.ownerId ? userById.get(selected.ownerId) : undefined;

  function handleSendComment() {
    if (!selected || !comment.trim()) return;
    addComment({
      entityType: "thread",
      entityId: selected.id,
      authorId: currentUserId,
      body: comment.trim(),
    });
    setComment("");
  }

  function handleScheduleFollowUp() {
    if (!selContact) return;
    updateContact(selContact.id, {
      nextFollowUpAt: addDays(new Date(), 3).toISOString(),
    });
  }

  if (threads.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inbox"
          description="Unified inbox for every reply across your outbound."
          icon={InboxIcon}
        />
        <EmptyState
          icon={<InboxIcon className="size-8" />}
          title="No conversations yet"
          description="Replies from your campaigns will land here. Launch a campaign to start filling the inbox."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inbox"
        description="Every reply across your outbound, in one place."
        icon={InboxIcon}
        actions={
          <Badge variant={counts.unread > 0 ? "info" : "muted"}>
            {counts.unread} unread
          </Badge>
        }
      />

      <div className="grid h-[calc(100vh-11rem)] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_320px]">
        {/* ---------------------------- Left: thread list --------------------------- */}
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden",
            selectedId && "hidden lg:flex",
          )}
        >
          <div className="border-b border-border p-2">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as FilterTab)}
              variant="pills"
              className="flex w-full flex-wrap"
              tabs={[
                { value: "all", label: "All", count: counts.all },
                { value: "unread", label: "Unread", count: counts.unread },
                { value: "positive", label: "Positive", count: counts.positive },
                { value: "meetings", label: "Meetings", count: counts.meetings },
                { value: "snoozed", label: "Snoozed", count: counts.snoozed },
                { value: "archived", label: "Archived", count: counts.archived },
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<MailOpen className="size-7" />}
                title="Nothing here"
                description="No threads match this filter."
                className="m-3 border-0 py-12"
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((t) => (
                  <ThreadListItem
                    key={t.id}
                    thread={t}
                    active={t.id === selectedId}
                    contactName={contactName(contactById.get(t.contactId))}
                    companyName={companyById.get(t.companyId)?.name ?? "—"}
                    onClick={() => openThread(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* --------------------------- Main: conversation --------------------------- */}
        <Card
          className={cn(
            "flex min-h-0 flex-col overflow-hidden",
            !selectedId && "hidden lg:flex",
          )}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={<Mail className="size-8" />}
                title="Select a conversation"
                description="Choose a thread from the list to read the full exchange."
                className="border-0"
              />
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="flex items-start gap-3 border-b border-border p-4">
                <button
                  className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-accent lg:hidden"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to list"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <Avatar
                  name={contactName(selContact)}
                  color={avatarColor(selected.contactId)}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{contactName(selContact)}</h2>
                    {selContact && (
                      <Badge variant="outline" dot={STAGE_META[selContact.stage].color}>
                        {STAGE_META[selContact.stage].short}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {selContact?.jobTitle ? `${selContact.jobTitle} · ` : ""}
                    {selCompany?.name ?? "—"}
                    {selContact?.email ? ` · ${selContact.email}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      selected.sentiment === "positive"
                        ? "success"
                        : selected.sentiment === "negative"
                          ? "destructive"
                          : "muted"
                    }
                    dot={SENTIMENT_META[selected.sentiment].color}
                  >
                    {SENTIMENT_META[selected.sentiment].label}
                  </Badge>
                  {selected.meetingBooked && (
                    <Badge variant="success">
                      <CalendarCheck className="size-3" /> Meeting
                    </Badge>
                  )}
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setThreadSentiment(selected.id, "positive")}
                >
                  <ThumbsUp className="size-3.5" /> Interested
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setThreadSentiment(selected.id, "negative")}
                >
                  <ThumbsDown className="size-3.5" /> Not interested
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => markMeetingBooked(selected.id)}
                  disabled={selected.meetingBooked}
                >
                  <CalendarCheck className="size-3.5" /> Meeting booked
                </Button>

                <div className="ml-auto flex items-center gap-1.5">
                  {/* Assign owner */}
                  <Dropdown
                    align="end"
                    trigger={
                      <Button variant="ghost" size="sm">
                        <UserPlus className="size-3.5" />
                        {selOwner ? selOwner.name.split(" ")[0] : "Assign"}
                      </Button>
                    }
                  >
                    <DropdownLabel>Assign owner</DropdownLabel>
                    {users.map((u) => (
                      <DropdownItem
                        key={u.id}
                        icon={<Avatar name={u.name} color={u.avatarColor} size={18} />}
                        onClick={() => updateThread(selected.id, { ownerId: u.id })}
                      >
                        {u.name}
                        {u.id === selected.ownerId && (
                          <CircleDot className="ml-auto size-3.5 text-primary" />
                        )}
                      </DropdownItem>
                    ))}
                  </Dropdown>

                  {/* Overflow */}
                  <Dropdown
                    align="end"
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="More actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  >
                    <DropdownItem
                      icon={<CalendarPlus />}
                      onClick={handleScheduleFollowUp}
                    >
                      Schedule follow-up (3d)
                    </DropdownItem>
                    <DropdownItem
                      icon={<Clock />}
                      onClick={() => setThreadState(selected.id, "snoozed")}
                    >
                      Snooze
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem
                      icon={<Archive />}
                      destructive
                      onClick={() => setThreadState(selected.id, "archived")}
                    >
                      Archive
                    </DropdownItem>
                  </Dropdown>
                </div>
              </div>

              {/* Message thread */}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
                <div className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {selected.subject}
                </div>
                {threadMessages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    contactName={contactName(selContact)}
                  />
                ))}
              </div>

              {/* Reply composer (visual) */}
              <div className="border-t border-border p-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={`Reply to ${contactName(selContact)}…`}
                  className="min-h-[64px]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Replying from your connected account
                  </span>
                  <Button
                    size="sm"
                    disabled={!reply.trim()}
                    onClick={() => setReply("")}
                  >
                    <Send className="size-3.5" /> Send reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* --------------------------- Right rail: context -------------------------- */}
        {selected && (
          <Card className="hidden min-h-0 flex-col overflow-hidden xl:flex">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {/* Owner + meta */}
              <div>
                <SectionTitle>Thread</SectionTitle>
                <dl className="space-y-2 text-sm">
                  <MetaRow label="Owner">
                    {selOwner ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={selOwner.name} color={selOwner.avatarColor} size={18} />
                        {selOwner.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </MetaRow>
                  <MetaRow label="Company">{selCompany?.name ?? "—"}</MetaRow>
                  <MetaRow label="Messages">
                    <span className="tabular">{threadMessages.length}</span>
                  </MetaRow>
                  <MetaRow label="Last reply">
                    <span className="text-muted-foreground">
                      {relativeTime(selected.lastMessageAt)}
                    </span>
                  </MetaRow>
                  {selContact?.nextFollowUpAt && (
                    <MetaRow label="Follow-up">
                      <span className="text-muted-foreground">
                        {formatDateTime(selContact.nextFollowUpAt)}
                      </span>
                    </MetaRow>
                  )}
                </dl>
              </div>

              <Separator />

              {/* Internal comments */}
              <div>
                <SectionTitle>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" /> Internal notes
                  </span>
                </SectionTitle>
                {threadComments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No internal notes yet. These are only visible to your team.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {threadComments.map((c) => {
                      const author = userById.get(c.authorId);
                      return (
                        <li key={c.id} className="flex gap-2.5">
                          <Avatar
                            name={author?.name ?? "?"}
                            color={author?.avatarColor}
                            size={26}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium">
                                {author?.name ?? "Unknown"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {relativeTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm leading-snug">{c.body}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add an internal note…"
                    className="min-h-[56px] text-sm"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSendComment();
                    }}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!comment.trim()}
                      onClick={handleSendComment}
                    >
                      Post note
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- helper components ---------------------------- */

function contactName(c?: { firstName: string; lastName: string }): string {
  if (!c) return "Unknown contact";
  return `${c.firstName} ${c.lastName}`.trim() || "Unknown contact";
}

function ThreadListItem({
  thread,
  active,
  contactName,
  companyName,
  onClick,
}: {
  thread: Thread;
  active: boolean;
  contactName: string;
  companyName: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/60",
          active && "bg-accent",
        )}
      >
        <div className="relative">
          <Avatar name={contactName} color={avatarColor(thread.contactId)} size={36} />
          {thread.unread && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-info" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm",
                thread.unread ? "font-semibold" : "font-medium",
              )}
            >
              {contactName}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {relativeTime(thread.lastMessageAt)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: SENTIMENT_META[thread.sentiment].color }}
              title={SENTIMENT_META[thread.sentiment].label}
            />
            <span className="truncate text-xs text-muted-foreground">{companyName}</span>
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              thread.unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {thread.subject}
          </p>
          {thread.meetingBooked && (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <CalendarCheck className="size-3" /> Meeting booked
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function MessageBubble({
  message,
  contactName,
}: {
  message: EmailMessage;
  contactName: string;
}) {
  const outbound = message.direction === "outbound";
  const time = message.sentAt ?? message.createdAt;
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] md:max-w-[75%]", outbound && "items-end")}>
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-[11px] text-muted-foreground",
            outbound && "justify-end",
          )}
        >
          <span className="font-medium">
            {outbound ? message.fromEmail : contactName}
          </span>
          <span>{formatTime(time)}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed",
            outbound
              ? "rounded-br-sm border-primary/20 bg-primary/10 text-foreground"
              : "rounded-bl-sm border-border bg-card text-foreground",
          )}
        >
          {message.subject && (
            <div className="mb-1 text-xs font-semibold text-muted-foreground">
              {message.subject}
            </div>
          )}
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
        <div
          className={cn(
            "mt-1 text-[10px] text-muted-foreground/70",
            outbound ? "text-right" : "text-left",
          )}
          title={formatDateTime(time)}
        >
          {outbound ? `to ${message.toEmail}` : `from ${message.fromEmail}`}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}
