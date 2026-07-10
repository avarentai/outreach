"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { useStore } from "@/lib/store";
import type { PipelineStage } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/types";
import { STAGE_META, ACTIVITY_META, MESSAGE_STATUS_META } from "@/lib/constants";
import { PageHeader, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Avatar, EmptyState, Separator, Progress } from "@/components/ui/misc";
import { cn, formatDateTime, relativeTime, initials } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  Building2,
  Clock,
  Megaphone,
  User as UserIcon,
  Tag as TagIcon,
  UserX,
  ThumbsUp,
  Send,
  MessageSquare,
  Zap,
  ExternalLink,
} from "lucide-react";

const VALIDITY_COLOR: Record<string, string> = {
  valid: "var(--success)",
  risky: "var(--warning)",
  invalid: "var(--destructive)",
  unknown: "var(--muted-foreground)",
};

const LINKEDIN_META: Record<string, { label: string; variant: "muted" | "secondary" | "info" | "warning" | "success" }> = {
  none: { label: "No LinkedIn", variant: "muted" },
  not_connected: { label: "Not connected", variant: "secondary" },
  request_sent: { label: "Request sent", variant: "warning" },
  connected: { label: "Connected", variant: "info" },
  messaged: { label: "Messaged", variant: "info" },
  replied: { label: "Replied", variant: "success" },
};

function scoreColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 40) return "var(--warning)";
  return "var(--muted-foreground)";
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const campaigns = useStore((s) => s.campaigns);
  const messages = useStore((s) => s.messages);
  const activities = useStore((s) => s.activities);
  const comments = useStore((s) => s.comments);
  const currentUserId = useStore((s) => s.currentUserId);

  const moveStage = useStore((s) => s.moveStage);
  const addComment = useStore((s) => s.addComment);

  const contact = contacts.find((c) => c.id === id);
  const company = contact ? companies.find((c) => c.id === contact.companyId) : undefined;
  const owner = contact ? users.find((u) => u.id === contact.ownerId) : undefined;
  const campaign = contact?.campaignId ? campaigns.find((c) => c.id === contact.campaignId) : undefined;

  /* Timeline: this contact's messages + activities, newest first */
  const timeline = React.useMemo(() => {
    if (!contact) return [];
    type Item =
      | { kind: "message"; at: number; data: (typeof messages)[number] }
      | { kind: "activity"; at: number; data: (typeof activities)[number] };
    const items: Item[] = [];
    for (const m of messages) {
      if (m.contactId !== contact.id) continue;
      items.push({ kind: "message", at: new Date(m.sentAt ?? m.createdAt).getTime(), data: m });
    }
    for (const a of activities) {
      if (a.contactId !== contact.id) continue;
      items.push({ kind: "activity", at: new Date(a.createdAt).getTime(), data: a });
    }
    return items.sort((x, y) => y.at - x.at);
  }, [contact, messages, activities]);

  const contactComments = React.useMemo(
    () =>
      comments
        .filter((c) => c.entityType === "contact" && c.entityId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments, id],
  );

  const [commentBody, setCommentBody] = React.useState("");

  if (!contact) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lead not found" icon={UserX} />
        <EmptyState
          icon={<UserX className="size-8" />}
          title="This lead doesn't exist"
          description="It may have been deleted or the link is incorrect."
          action={
            <Link href="/leads">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> Back to leads
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const userById = new Map(users.map((u) => [u.id, u]));

  function submitComment() {
    const body = commentBody.trim();
    if (!body) return;
    addComment({ entityType: "contact", entityId: id, authorId: currentUserId, body });
    setCommentBody("");
    toast.success("Comment added");
  }

  const fullName = `${contact.firstName} ${contact.lastName}`;
  const linkedinInfo = LINKEDIN_META[contact.linkedinStatus] ?? LINKEDIN_META.none;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/leads"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to leads
        </Link>
        <PageHeader
          title={fullName}
          description={
            [contact.jobTitle, company?.name].filter(Boolean).join(" · ") || undefined
          }
          actions={
            <>
              {company && (
                <Link href={`/companies/${company.id}`}>
                  <Button variant="outline">
                    <Building2 className="size-4" /> View company
                  </Button>
                </Link>
              )}
              <a href={`mailto:${contact.email}`}>
                <Button>
                  <Mail className="size-4" /> Email
                </Button>
              </a>
            </>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------ Left column ------------------------------ */}
        <div className="space-y-4">
          {/* Profile */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={fullName} color={owner?.avatarColor} size={48} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{fullName}</div>
                  {contact.jobTitle && (
                    <div className="truncate text-sm text-muted-foreground">{contact.jobTitle}</div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" dot={STAGE_META[contact.stage].color}>
                      {STAGE_META[contact.stage].label}
                    </Badge>
                    {contact.unsubscribed && <Badge variant="destructive">Unsubscribed</Badge>}
                    {contact.bounced && <Badge variant="warning">Bounced</Badge>}
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3 text-sm">
                <ContactRow icon={<Mail className="size-4" />}>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: VALIDITY_COLOR[contact.emailValidity] }}
                      title={contact.emailValidity}
                    />
                    <a
                      href={`mailto:${contact.email}`}
                      className="truncate hover:text-primary hover:underline"
                    >
                      {contact.email}
                    </a>
                  </span>
                </ContactRow>
                <ContactRow icon={<Phone className="size-4" />}>
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="hover:text-primary">
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No phone</span>
                  )}
                </ContactRow>
                <ContactRow icon={<Linkedin className="size-4" />}>
                  {contact.linkedinUrl ? (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 truncate hover:text-primary hover:underline"
                    >
                      LinkedIn profile <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No LinkedIn URL</span>
                  )}
                </ContactRow>
                <ContactRow icon={<Building2 className="size-4" />}>
                  {company ? (
                    <Link href={`/companies/${company.id}`} className="truncate hover:text-primary hover:underline">
                      {company.name}
                      {company.industry ? (
                        <span className="text-muted-foreground"> · {company.industry}</span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No company</span>
                  )}
                </ContactRow>
                <ContactRow icon={<UserIcon className="size-4" />}>
                  {owner ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar name={owner.name} color={owner.avatarColor} size={18} /> {owner.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </ContactRow>
                <ContactRow icon={<Megaphone className="size-4" />}>
                  {campaign ? (
                    <Link href={`/campaigns/${campaign.id}`} className="truncate hover:text-primary hover:underline">
                      {campaign.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not in a campaign</span>
                  )}
                </ContactRow>
              </div>

              {contact.tags.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TagIcon className="size-3.5" /> Tags
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contact.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stage control */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Pipeline stage</SectionTitle>
              <Select
                value={contact.stage}
                onChange={(e) => {
                  moveStage(contact.id, e.target.value as PipelineStage);
                  toast.success(`Moved to ${STAGE_META[e.target.value as PipelineStage].label}`);
                }}
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_META[s].label}
                  </option>
                ))}
              </Select>
              <div className="mt-2 text-xs text-muted-foreground tabular">
                In stage since {formatDateTime(contact.stageEnteredAt)}
              </div>
            </CardContent>
          </Card>

          {/* Next follow-up */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Cadence</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <MiniStat
                  label="Last contacted"
                  value={contact.lastContactedAt ? relativeTime(contact.lastContactedAt) : "—"}
                />
                <MiniStat
                  label="Next follow-up"
                  value={contact.nextFollowUpAt ? relativeTime(contact.nextFollowUpAt) : "—"}
                  color={contact.nextFollowUpAt ? "var(--warning)" : undefined}
                />
              </div>
              {contact.nextFollowUpAt && (
                <Link href="/follow-ups" className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Clock className="size-3.5" /> Go to follow-ups
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------ Middle column ---------------------------- */}
        <div className="space-y-4 lg:col-span-2">
          {/* Score */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Opportunity score</SectionTitle>
              <div className="flex items-center gap-4">
                <div
                  className="flex size-16 shrink-0 items-center justify-center rounded-full text-2xl font-semibold tabular"
                  style={{
                    color: scoreColor(contact.score),
                    backgroundColor: `color-mix(in oklch, ${scoreColor(contact.score)} 12%, transparent)`,
                  }}
                >
                  {contact.score}
                </div>
                <div className="min-w-0 flex-1">
                  <Progress value={contact.score} color={scoreColor(contact.score)} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {contact.score >= 70
                      ? "High-priority — matches your ICP strongly."
                      : contact.score >= 40
                        ? "Moderate fit — worth nurturing."
                        : "Low fit for the current scoring model."}
                  </p>
                </div>
              </div>

              {contact.scoreBreakdown && contact.scoreBreakdown.length > 0 ? (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    {contact.scoreBreakdown.map((comp, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{comp.rule}</div>
                          <div className="truncate text-xs text-muted-foreground">{comp.reason}</div>
                        </div>
                        <Badge variant={comp.points >= 0 ? "success" : "destructive"}>
                          {comp.points >= 0 ? "+" : ""}
                          {comp.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  No scoring rules matched this contact.
                </p>
              )}
            </CardContent>
          </Card>

          {/* LinkedIn status */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle>LinkedIn status</SectionTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--info)_14%,transparent)] text-info">
                    <Linkedin className="size-4.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Outreach status</div>
                    {contact.linkedinNotes && (
                      <div className="text-xs text-muted-foreground">{contact.linkedinNotes}</div>
                    )}
                  </div>
                </div>
                <Badge variant={linkedinInfo.variant}>{linkedinInfo.label}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Timeline</SectionTitle>
              {timeline.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="size-7" />}
                  title="No activity yet"
                  description="Emails and updates for this lead will appear here."
                  className="py-10"
                />
              ) : (
                <div className="space-y-0.5">
                  {timeline.slice(0, 40).map((item, i) => {
                    if (item.kind === "message") {
                      const m = item.data;
                      const meta = MESSAGE_STATUS_META[m.status];
                      const outbound = m.direction === "outbound";
                      return (
                        <div
                          key={`m-${m.id}-${i}`}
                          className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/50"
                        >
                          <div
                            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)`,
                              color: meta.color,
                            }}
                          >
                            {outbound ? <Send className="size-3.5" /> : <Mail className="size-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{m.subject}</span>
                              <Badge variant="outline" dot={meta.color} className="shrink-0">
                                {meta.label}
                              </Badge>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {m.body.replace(/<[^>]*>/g, " ").trim()}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground tabular">
                            {relativeTime(m.sentAt ?? m.createdAt)}
                          </span>
                        </div>
                      );
                    }
                    const a = item.data;
                    const meta = ACTIVITY_META[a.type];
                    const Icon = (Icons[meta.icon as keyof typeof Icons] ??
                      Zap) as React.ComponentType<{ className?: string }>;
                    return (
                      <div
                        key={`a-${a.id}-${i}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/50"
                      >
                        <div
                          className="flex size-7 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)`,
                            color: meta.color,
                          }}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <span className="flex-1 truncate text-muted-foreground">{a.summary}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {relativeTime(a.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes / comments */}
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Notes</SectionTitle>
              <div className="flex items-start gap-2">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add an internal note about this lead…"
                  className="min-h-[64px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                  }}
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={submitComment} disabled={!commentBody.trim()}>
                  <ThumbsUp className="size-3.5" /> Post note
                </Button>
              </div>

              {contactComments.length > 0 && (
                <div className="mt-4 space-y-3">
                  {contactComments.map((cm) => {
                    const author = userById.get(cm.authorId);
                    return (
                      <div key={cm.id} className="flex items-start gap-2.5">
                        <Avatar
                          name={author?.name ?? initials(cm.authorId)}
                          color={author?.avatarColor}
                          size={26}
                        />
                        <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">{author?.name ?? "Someone"}</span>
                            <span className="text-muted-foreground tabular">
                              {relativeTime(cm.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm">{cm.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("shrink-0 text-muted-foreground")}>{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
