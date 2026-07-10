"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { PageHeader, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar, EmptyState, Separator } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import {
  COMPANY_STATUS_META,
  STAGE_META,
  MESSAGE_STATUS_META,
  ACTIVITY_META,
} from "@/lib/constants";
import {
  cn,
  formatNumber,
  formatDate,
  formatDateTime,
  relativeTime,
  formatCompact,
} from "@/lib/utils";
import type { EmailMessage, Meeting, Activity } from "@/lib/types";
import * as Icons from "lucide-react";
import {
  Building2,
  Globe,
  Radar,
  MapPin,
  Users,
  Calendar,
  Mail,
  FileText,
  StickyNote,
  Paperclip,
  Linkedin,
  Twitter,
  Facebook,
  Link2,
  ExternalLink,
  ArrowLeft,
  Send,
  Reply,
  Layers,
  Clock,
  Cpu,
  AtSign,
  Zap,
  Pin,
  Upload,
  CalendarCheck,
  Briefcase,
} from "lucide-react";

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  twitter: Twitter,
  x: Twitter,
  facebook: Facebook,
};

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  deck: "Deck",
  one_pager: "One-pager",
  contract: "Contract",
  meeting_notes: "Meeting notes",
  other: "File",
};

const OUTCOME_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "info" | "muted"
> = {
  scheduled: "info",
  completed: "success",
  won: "success",
  no_show: "warning",
  cancelled: "muted",
  lost: "destructive",
};

type TabValue = "overview" | "timeline" | "emails" | "meetings" | "notes" | "attachments";

export default function CompanyProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const company = useStore((s) => s.companies.find((c) => c.id === id));
  const contacts = useStore((s) => s.contacts);
  const messages = useStore((s) => s.messages);
  const meetings = useStore((s) => s.meetings);
  const activities = useStore((s) => s.activities);
  const notes = useStore((s) => s.notes);
  const attachments = useStore((s) => s.attachments);
  const campaigns = useStore((s) => s.campaigns);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const runCrawl = useStore((s) => s.runCrawl);
  const addNote = useStore((s) => s.addNote);

  const [tab, setTab] = React.useState<TabValue>("overview");
  const [noteDraft, setNoteDraft] = React.useState("");

  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const companyContacts = React.useMemo(
    () => (company ? contacts.filter((c) => c.companyId === company.id) : []),
    [contacts, company],
  );
  const companyMessages = React.useMemo(
    () =>
      company
        ? messages
            .filter((m) => m.companyId === company.id)
            .sort((a, b) => tsOf(b) - tsOf(a))
        : [],
    [messages, company],
  );
  const companyMeetings = React.useMemo(
    () =>
      company
        ? meetings
            .filter((m) => m.companyId === company.id)
            .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
        : [],
    [meetings, company],
  );
  const companyNotes = React.useMemo(
    () =>
      company
        ? notes
            .filter((n) => n.companyId === company.id)
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [],
    [notes, company],
  );
  const companyAttachments = React.useMemo(
    () => (company ? attachments.filter((a) => a.companyId === company.id) : []),
    [attachments, company],
  );
  const companyActivities = React.useMemo(
    () => (company ? activities.filter((a) => a.companyId === company.id) : []),
    [activities, company],
  );

  // Campaigns that have contacts from this company
  const companyCampaigns = React.useMemo(() => {
    if (!company) return [];
    const campContactCount = new Map<string, number>();
    for (const c of companyContacts) {
      if (c.campaignId) campContactCount.set(c.campaignId, (campContactCount.get(c.campaignId) ?? 0) + 1);
    }
    return campaigns
      .filter((camp) => campContactCount.has(camp.id))
      .map((camp) => ({ campaign: camp, contacts: campContactCount.get(camp.id) ?? 0 }));
  }, [campaigns, companyContacts, company]);

  // Merged interaction timeline: messages + meetings + activities
  const timeline = React.useMemo(() => {
    type TItem = { id: string; ts: number; kind: "email" | "meeting" | "activity"; title: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string };
    const items: TItem[] = [];
    for (const m of companyMessages) {
      items.push({
        id: `msg_${m.id}`,
        ts: tsOf(m),
        kind: "email",
        title: m.direction === "outbound" ? `Sent: ${m.subject || "(no subject)"}` : `Received: ${m.subject || "(no subject)"}`,
        sub: `${m.fromEmail} → ${m.toEmail}`,
        icon: m.direction === "outbound" ? Send : Reply,
        color: m.direction === "outbound" ? "var(--info)" : "var(--chart-1)",
      });
    }
    for (const mt of companyMeetings) {
      items.push({
        id: `mt_${mt.id}`,
        ts: new Date(mt.scheduledAt).getTime(),
        kind: "meeting",
        title: mt.title,
        sub: `${mt.durationMinutes} min · ${mt.outcome.replace(/_/g, " ")}`,
        icon: CalendarCheck,
        color: "var(--success)",
      });
    }
    for (const a of companyActivities) {
      const meta = ACTIVITY_META[a.type];
      const Icon = (Icons[meta.icon as keyof typeof Icons] ?? Zap) as React.ComponentType<{ className?: string }>;
      items.push({
        id: `act_${a.id}`,
        ts: new Date(a.createdAt).getTime(),
        kind: "activity",
        title: a.summary,
        icon: Icon,
        color: meta.color,
      });
    }
    return items.sort((a, b) => b.ts - a.ts);
  }, [companyMessages, companyMeetings, companyActivities]);

  // Not found
  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Company" icon={Building2} />
        <EmptyState
          icon={<Building2 className="size-8" />}
          title="Company not found"
          description="This account may have been removed or the link is out of date."
          action={
            <Link href="/companies">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> Back to companies
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const owner = company.ownerId ? userById.get(company.ownerId) : undefined;
  const statusMeta = COMPANY_STATUS_META[company.status];
  const enr = company.enrichment;

  const handleCrawl = () => {
    runCrawl(company.id);
    toast.success(`Crawling ${company.domain}…`, { description: "Enrichment refreshed from the latest crawl." });
  };

  const handleAddNote = () => {
    const body = noteDraft.trim();
    if (!body) return;
    addNote({ companyId: company.id, authorId: currentUserId, body, pinned: false });
    setNoteDraft("");
    toast.success("Note added");
  };

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "timeline", label: "Timeline", count: timeline.length },
    { value: "emails", label: "Emails", count: companyMessages.length },
    { value: "meetings", label: "Meetings", count: companyMeetings.length },
    { value: "notes", label: "Notes", count: companyNotes.length },
    { value: "attachments", label: "Files", count: companyAttachments.length },
  ];

  return (
    <div className="space-y-6">
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All companies
      </Link>

      <PageHeader
        title={company.name}
        description={company.industry ?? "—"}
        icon={Building2}
        actions={
          <>
            <a href={company.website ?? `https://${company.domain}`} target="_blank" rel="noreferrer">
              <Button variant="outline">
                <Globe className="size-4" /> Visit site
              </Button>
            </a>
            <Button onClick={handleCrawl}>
              <Radar className="size-4" /> Crawl website
            </Button>
          </>
        }
      />

      {/* Identity strip */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" dot={statusMeta.color}>
                {statusMeta.label}
              </Badge>
              <a
                href={company.website ?? `https://${company.domain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                <Globe className="size-3.5" /> {company.domain}
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {enr.hq && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {enr.hq}
                </span>
              )}
              {enr.employeeEstimate && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> {enr.employeeEstimate} employees
                </span>
              )}
              {enr.domainAgeYears !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {enr.domainAgeYears}y domain age
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" /> Added {formatDate(company.createdAt)}
              </span>
            </div>
            {company.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {company.tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {owner && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Avatar name={owner.name} color={owner.avatarColor} size={30} />
                <div className="leading-tight">
                  <div className="text-xs text-muted-foreground">Owner</div>
                  <div className="text-sm font-medium">{owner.name}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* quick stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Contacts" value={formatNumber(companyContacts.length)} />
          <MiniStat label="Emails" value={formatNumber(companyMessages.length)} />
          <MiniStat label="Meetings" value={formatNumber(companyMeetings.length)} color="var(--success)" />
          <MiniStat label="Discovered emails" value={formatNumber(enr.discoveredEmails?.length ?? 0)} color="var(--info)" />
        </div>
      </Card>

      <Tabs tabs={tabs} value={tab} onValueChange={(v) => setTab(v as TabValue)} />

      {/* ---------------------------------- Overview -------------------------------- */}
      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: enrichment + contacts */}
          <div className="space-y-4 lg:col-span-2">
            {/* Enrichment */}
            <Card>
              <CardContent className="p-5">
                <SectionTitle
                  action={
                    enr.lastCrawledAt ? (
                      <span className="text-xs text-muted-foreground">Crawled {relativeTime(enr.lastCrawledAt)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not crawled yet</span>
                    )
                  }
                >
                  Enrichment
                </SectionTitle>

                {/* Key pages */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <PageLink icon={Globe} label="Website" href={company.website ?? `https://${company.domain}`} />
                  <PageLink icon={Mail} label="Contact page" href={enr.contactPageUrl} />
                  <PageLink icon={FileText} label="About page" href={enr.aboutPageUrl} />
                  <PageLink icon={Briefcase} label="Careers page" href={enr.careersPageUrl} />
                  <PageLink icon={Users} label="Team page" href={enr.teamPageUrl} />
                </div>

                {/* Products */}
                {enr.products && enr.products.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">Products & services</div>
                    <div className="flex flex-wrap gap-1.5">
                      {enr.products.map((p) => (
                        <Badge key={p} variant="secondary">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tech stack */}
                {enr.techStack && enr.techStack.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Cpu className="size-3.5" /> Tech stack
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {enr.techStack.map((t) => (
                        <Badge key={t.name} variant="outline">
                          {t.name}
                          <span className="text-muted-foreground">· {t.category}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social + discovered emails */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Link2 className="size-3.5" /> Social links
                    </div>
                    {enr.socialLinks && enr.socialLinks.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {enr.socialLinks.map((s) => {
                          const Icon = SOCIAL_ICONS[s.platform] ?? Link2;
                          return (
                            <a
                              key={s.url}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              title={s.platform}
                            >
                              <Icon className="size-4" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">None found.</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <AtSign className="size-3.5" /> Discovered emails
                    </div>
                    {enr.discoveredEmails && enr.discoveredEmails.length > 0 ? (
                      <div className="space-y-1">
                        {enr.discoveredEmails.map((e) => (
                          <a
                            key={e}
                            href={`mailto:${e}`}
                            className="block truncate font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            {e}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">None found. Run a crawl to discover contacts.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardContent className="p-5">
                <SectionTitle
                  action={<span className="text-xs text-muted-foreground tabular">{companyContacts.length}</span>}
                >
                  Contacts at {company.name}
                </SectionTitle>
                {companyContacts.length === 0 ? (
                  <EmptyState title="No contacts yet" description="Import or add leads to this company." className="py-10" />
                ) : (
                  <div className="space-y-1">
                    {companyContacts
                      .slice()
                      .sort((a, b) => b.score - a.score)
                      .map((c) => {
                        const stageMeta = STAGE_META[c.stage];
                        return (
                          <Link
                            key={c.id}
                            href={`/leads/${c.id}`}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                          >
                            <Avatar name={`${c.firstName} ${c.lastName}`} size={30} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {c.firstName} {c.lastName}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">{c.jobTitle ?? c.email}</div>
                            </div>
                            <Badge variant="outline" dot={stageMeta.color}>
                              {stageMeta.short}
                            </Badge>
                            <div className="w-10 text-right text-sm font-semibold tabular" title="Opportunity score">
                              {c.score}
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: campaign history + recent emails */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <SectionTitle>Campaign history</SectionTitle>
                {companyCampaigns.length === 0 ? (
                  <EmptyState title="No campaigns" description="This account isn't in any campaign." className="py-8" />
                ) : (
                  <div className="space-y-2">
                    {companyCampaigns.map(({ campaign, contacts: n }) => (
                      <Link
                        key={campaign.id}
                        href={`/campaigns/${campaign.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{campaign.name}</div>
                          <div className="text-xs capitalize text-muted-foreground">{campaign.status}</div>
                        </div>
                        <Badge variant="outline">
                          <Layers className="size-3" /> {n}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <SectionTitle action={<button onClick={() => setTab("emails")} className="text-xs text-primary hover:underline">View all</button>}>
                  Recent emails
                </SectionTitle>
                {companyMessages.length === 0 ? (
                  <EmptyState title="No emails yet" className="py-8" />
                ) : (
                  <div className="space-y-2">
                    {companyMessages.slice(0, 5).map((m) => (
                      <EmailRow key={m.id} m={m} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ---------------------------------- Timeline -------------------------------- */}
      {tab === "timeline" && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle>Interaction timeline</SectionTitle>
            {timeline.length === 0 ? (
              <EmptyState title="No interactions yet" description="Emails, meetings, and activity will appear here." className="py-12" />
            ) : (
              <div className="relative space-y-0.5 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                {timeline.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="relative flex items-start gap-3 rounded-lg px-1.5 py-2 hover:bg-accent/50">
                      <div
                        className="relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card"
                        style={{ color: item.color }}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{item.title}</div>
                        {item.sub && <div className="truncate text-xs text-muted-foreground">{item.sub}</div>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(new Date(item.ts).toISOString())}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------- Emails --------------------------------- */}
      {tab === "emails" && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle action={<span className="text-xs text-muted-foreground tabular">{companyMessages.length}</span>}>
              Emails
            </SectionTitle>
            {companyMessages.length === 0 ? (
              <EmptyState title="No emails yet" className="py-12" />
            ) : (
              <div className="space-y-2">
                {companyMessages.map((m) => (
                  <EmailRow key={m.id} m={m} expanded />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------- Meetings -------------------------------- */}
      {tab === "meetings" && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle action={<span className="text-xs text-muted-foreground tabular">{companyMeetings.length}</span>}>
              Meetings
            </SectionTitle>
            {companyMeetings.length === 0 ? (
              <EmptyState title="No meetings booked" description="Meetings with this account will show here." className="py-12" />
            ) : (
              <div className="space-y-2">
                {companyMeetings.map((mt) => (
                  <MeetingRow key={mt.id} mt={mt} contactName={contactNameOf(mt, companyContacts)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------- Notes ---------------------------------- */}
      {tab === "notes" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <SectionTitle action={<span className="text-xs text-muted-foreground tabular">{companyNotes.length}</span>}>
                Notes
              </SectionTitle>
              {companyNotes.length === 0 ? (
                <EmptyState icon={<StickyNote className="size-7" />} title="No notes yet" description="Add the first note on the right." className="py-12" />
              ) : (
                <div className="space-y-3">
                  {companyNotes.map((n) => {
                    const author = userById.get(n.authorId);
                    return (
                      <div key={n.id} className="rounded-lg border border-border p-3">
                        <div className="mb-1.5 flex items-center gap-2">
                          {author && <Avatar name={author.name} color={author.avatarColor} size={22} />}
                          <span className="text-xs font-medium">{author?.name ?? "Someone"}</span>
                          {n.pinned && (
                            <Badge variant="warning">
                              <Pin className="size-3" /> Pinned
                            </Badge>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">{relativeTime(n.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionTitle>Add note</SectionTitle>
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Log a call, jot a reminder, capture context…"
                className="min-h-32"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{noteDraft.trim().length} chars</span>
                <Button onClick={handleAddNote} disabled={!noteDraft.trim()}>
                  <StickyNote className="size-4" /> Save note
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* -------------------------------- Attachments ------------------------------- */}
      {tab === "attachments" && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast("Upload is disabled in demo mode.", { description: "Attachments are read-only here." })}
                >
                  <Upload className="size-3.5" /> Upload
                </Button>
              }
            >
              Attachments
            </SectionTitle>
            {companyAttachments.length === 0 ? (
              <EmptyState icon={<Paperclip className="size-7" />} title="No files" description="Decks, one-pagers, and contracts attach here." className="py-12" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {companyAttachments.map((a) => {
                  const uploader = userById.get(a.uploadedById);
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {KIND_LABEL[a.kind] ?? "File"} · {formatBytes(a.sizeBytes)}
                          {uploader && ` · ${uploader.name}`}
                        </div>
                      </div>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------- helpers ---------------------------------- */

function tsOf(m: EmailMessage): number {
  return new Date(m.sentAt ?? m.scheduledAt ?? m.createdAt).getTime();
}

function contactNameOf(mt: Meeting, list: { id: string; firstName: string; lastName: string }[]): string {
  const c = list.find((x) => x.id === mt.contactId);
  return c ? `${c.firstName} ${c.lastName}` : "";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PageLink({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
}) {
  if (!href) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground/60">
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <span className="text-xs">—</span>
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

function EmailRow({ m, expanded }: { m: EmailMessage; expanded?: boolean }) {
  const statusMeta = MESSAGE_STATUS_META[m.status];
  const outbound = m.direction === "outbound";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            outbound ? "bg-info/12 text-info" : "bg-chart-1/12",
          )}
          style={!outbound ? { color: "var(--chart-1)" } : undefined}
        >
          {outbound ? <Send className="size-3" /> : <Reply className="size-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.subject || "(no subject)"}</span>
        <Badge variant="outline" dot={statusMeta.color}>
          {statusMeta.label}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(m.sentAt ?? m.scheduledAt ?? m.createdAt)}</span>
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {m.fromEmail} → {m.toEmail}
      </div>
      {expanded && m.body && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{m.body}</p>
      )}
    </div>
  );
}

function MeetingRow({ mt, contactName }: { mt: Meeting; contactName: string }) {
  const variant = OUTCOME_VARIANT[mt.outcome] ?? "muted";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
          <CalendarCheck className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{mt.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatDateTime(mt.scheduledAt)} · {mt.durationMinutes} min{contactName && ` · ${contactName}`}
          </div>
        </div>
        <Badge variant={variant} className="capitalize">
          {mt.outcome.replace(/_/g, " ")}
        </Badge>
      </div>
      {mt.nextAction && (
        <div className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-xs">
          <span className="font-medium text-muted-foreground">Next:</span>
          <span>{mt.nextAction}</span>
        </div>
      )}
    </div>
  );
}
