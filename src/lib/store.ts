"use client";

/* =========================================================================
 * Central client-side data store (Zustand + localStorage persistence).
 * In DEMO mode this IS the database. In LIVE mode a thin Supabase adapter
 * (lib/data/supabase.ts) hydrates and mirrors mutations to Postgres.
 * ========================================================================= */

import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type {
  Workspace,
  User,
  Company,
  Contact,
  EmailTemplate,
  Snippet,
  Sequence,
  Campaign,
  SendingAccount,
  EmailMessage,
  Thread,
  Meeting,
  Activity,
  Note,
  Attachment,
  Experiment,
  SavedView,
  ScoringConfig,
  FollowUpTask,
  CrawlResult,
  PipelineStage,
  ActivityType,
  ReplySentiment,
  ThreadState,
  InternalComment,
  CampaignStatus,
} from "./types";
import { generateSeed } from "./seed";
import type { DataSnapshot } from "./engines/analytics";
import { generateFollowUps } from "./engines/followups";
import { scoreContact } from "./engines/scoring";
import { isLiveMode } from "./supabase/client";
import { getBrowserDb, hydrateWorkspace, repo } from "./data";

export interface AppState {
  workspace: Workspace;
  users: User[];
  currentUserId: string;
  companies: Company[];
  contacts: Contact[];
  templates: EmailTemplate[];
  snippets: Snippet[];
  sequences: Sequence[];
  campaigns: Campaign[];
  accounts: SendingAccount[];
  messages: EmailMessage[];
  threads: Thread[];
  meetings: Meeting[];
  activities: Activity[];
  comments: InternalComment[];
  notes: Note[];
  attachments: Attachment[];
  experiments: Experiment[];
  savedViews: SavedView[];
  scoring: ScoringConfig;
  followUps: FollowUpTask[];
  authed: boolean;
  workspaceId: string | null;
  hydrated: boolean;

  /* actions */
  login: (userId: string) => void;
  logout: () => void;
  resetDemo: () => void;

  /* LIVE-mode auth + hydration (no-ops / demo-safe when !isLiveMode) */
  setSession: (user: User, workspaceId: string) => void;
  hydrateFromDb: (workspaceId: string) => Promise<void>;
  updateWorkspace: (patch: Partial<Pick<Workspace, "name" | "domain" | "timezone">>) => void;

  logActivity: (a: Omit<Activity, "id" | "createdAt"> & { createdAt?: string }) => void;

  addContact: (c: Partial<Contact> & { firstName: string; lastName: string; email: string; companyId: string }) => Contact;
  updateContact: (id: string, patch: Partial<Contact>) => void;
  bulkUpdateContacts: (ids: string[], patch: Partial<Contact>) => void;
  deleteContacts: (ids: string[]) => void;
  moveStage: (contactId: string, stage: PipelineStage) => void;

  addCompany: (c: Partial<Company> & { name: string; domain: string }) => Company;
  updateCompany: (id: string, patch: Partial<Company>) => void;

  addTemplate: (t: Partial<EmailTemplate> & { name: string }) => EmailTemplate;
  updateTemplate: (id: string, patch: Partial<EmailTemplate>) => void;
  deleteTemplate: (id: string) => void;
  addSnippet: (snippet: Omit<Snippet, "id">) => Snippet;

  addCampaign: (c: Partial<Campaign> & { name: string; sequenceId: string }) => Campaign;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;

  addSequence: (s: Sequence) => void;
  updateSequence: (id: string, patch: Partial<Sequence>) => void;

  updateThread: (id: string, patch: Partial<Thread>) => void;
  addMessage: (message: EmailMessage) => void;
  setThreadState: (id: string, state: ThreadState) => void;
  setThreadSentiment: (id: string, sentiment: ReplySentiment) => void;
  markMeetingBooked: (threadId: string) => void;

  addComment: (c: Omit<InternalComment, "id" | "createdAt">) => void;
  addNote: (n: Omit<Note, "id" | "createdAt" | "updatedAt">) => void;
  addMeeting: (m: Omit<Meeting, "id" | "createdAt">) => Meeting;
  updateMeeting: (id: string, patch: Partial<Meeting>) => void;
  addAttachment: (attachment: Omit<Attachment, "id" | "createdAt"> & Partial<Pick<Attachment, "id" | "createdAt">>) => Attachment;
  addExperiment: (experiment: Omit<Experiment, "id" | "createdAt">) => Experiment;

  updateScoring: (config: ScoringConfig) => void;
  recomputeScores: () => void;

  updateAccount: (id: string, patch: Partial<SendingAccount>) => void;
  addAccount: (a: SendingAccount) => void;

  regenerateFollowUps: () => void;
  setFollowUpStatus: (id: string, status: FollowUpTask["status"]) => void;

  runCrawl: (companyId: string) => void;

  importContacts: (rows: { contact: Partial<Contact>; company: Partial<Company> & { domain: string } }[]) => { created: number; duplicates: number; companiesCreated: number };

  addSavedView: (v: Omit<SavedView, "id">) => void;
}

function makeSnapshotSeed(): ReturnType<typeof generateSeed> {
  return generateSeed();
}

const seed = makeSnapshotSeed();

/**
 * Fire-and-forget mirror of a local mutation to Supabase. Runs only in LIVE
 * mode once a workspace is bound; otherwise a no-op so DEMO stays pure. Errors
 * are surfaced as a toast and logged, never thrown into the calling action.
 */
function sync(ws: string | null, op: () => Promise<void>): void {
  if (!isLiveMode || !ws) return;
  op().catch((e) => {
    console.error(e);
    toast.error("Sync failed");
  });
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seed,
      comments: [],
      authed: false,
      workspaceId: null,
      hydrated: false,

      login: (userId) => set({ authed: true, currentUserId: userId }),
      logout: () => {
        if (isLiveMode) getBrowserDb()?.auth.signOut();
        set({ authed: false, workspaceId: null, hydrated: false });
      },
      resetDemo: () => {
        const fresh = generateSeed();
        set({ ...fresh, comments: [], authed: true });
      },

      setSession: (user, workspaceId) =>
        set((s) => ({
          currentUserId: user.id,
          workspaceId,
          authed: true,
          users: s.users.some((u) => u.id === user.id)
            ? s.users.map((u) => (u.id === user.id ? user : u))
            : [...s.users, user],
        })),

      hydrateFromDb: async (workspaceId) => {
        if (!getBrowserDb()) return;
        const snap = await hydrateWorkspace(workspaceId);
        set((s) => ({
          workspace: snap.workspace ?? s.workspace,
          users: snap.users.length ? snap.users : s.users,
          companies: snap.companies,
          contacts: snap.contacts,
          templates: snap.templates,
          snippets: snap.snippets,
          sequences: snap.sequences,
          campaigns: snap.campaigns,
          accounts: snap.accounts,
          messages: snap.messages,
          threads: snap.threads,
          meetings: snap.meetings,
          activities: snap.activities,
          comments: snap.comments,
          notes: snap.notes,
          attachments: snap.attachments,
          experiments: snap.experiments,
          savedViews: snap.savedViews,
          scoring: snap.scoring ?? s.scoring,
          followUps: snap.followUps,
          hydrated: true,
        }));
      },

      updateWorkspace: (patch) => {
        set((s) => ({ workspace: { ...s.workspace, ...patch } }));
        sync(get().workspaceId, () => repo.workspaces.upsert(get().workspace, get().workspaceId!));
      },

      logActivity: (a) => {
        const activity: Activity = { id: `act_${nanoid(8)}`, createdAt: new Date().toISOString(), ...a };
        set((s) => ({ activities: [activity, ...s.activities].slice(0, 2000) }));
        sync(get().workspaceId, () => repo.activities.insert(activity, get().workspaceId!));
      },

      addContact: (c) => {
        const contact: Contact = {
          id: `ct_${nanoid(8)}`,
          companyId: c.companyId,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          emailValidity: c.emailValidity ?? "unknown",
          jobTitle: c.jobTitle,
          linkedinUrl: c.linkedinUrl,
          phone: c.phone,
          stage: c.stage ?? "new",
          stageEnteredAt: new Date().toISOString(),
          ownerId: c.ownerId ?? get().currentUserId,
          campaignId: c.campaignId,
          tags: c.tags ?? [],
          score: c.score ?? 0,
          scoreBreakdown: c.scoreBreakdown,
          lastContactedAt: c.lastContactedAt,
          nextFollowUpAt: c.nextFollowUpAt,
          linkedinStatus: c.linkedinStatus ?? "none",
          unsubscribed: false,
          bounced: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ contacts: [contact, ...s.contacts] }));
        sync(get().workspaceId, () => repo.contacts.upsert(contact, get().workspaceId!));
        get().logActivity({
          type: "lead_created",
          actorId: get().currentUserId,
          contactId: contact.id,
          companyId: contact.companyId,
          summary: `Lead ${contact.firstName} ${contact.lastName} created`,
        });
        return contact;
      },

      updateContact: (id, patch) => {
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
          ),
        }));
        const updated = get().contacts.find((c) => c.id === id);
        if (updated) sync(get().workspaceId, () => repo.contacts.upsert(updated, get().workspaceId!));
      },

      bulkUpdateContacts: (ids, patch) => {
        set((s) => ({
          contacts: s.contacts.map((c) =>
            ids.includes(c.id) ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
          ),
        }));
        const affected = get().contacts.filter((c) => ids.includes(c.id));
        sync(get().workspaceId, () => repo.contacts.bulkUpsert(affected, get().workspaceId!));
      },

      deleteContacts: (ids) => {
        set((s) => ({ contacts: s.contacts.filter((c) => !ids.includes(c.id)) }));
        const ws = get().workspaceId;
        for (const id of ids) sync(ws, () => repo.contacts.remove(id));
      },

      moveStage: (contactId, stage) => {
        const c = get().contacts.find((x) => x.id === contactId);
        if (!c || c.stage === stage) return;
        set((s) => ({
          contacts: s.contacts.map((x) =>
            x.id === contactId
              ? { ...x, stage, stageEnteredAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : x,
          ),
        }));
        const moved = get().contacts.find((x) => x.id === contactId);
        if (moved) sync(get().workspaceId, () => repo.contacts.upsert(moved, get().workspaceId!));
        get().logActivity({
          type: "stage_changed",
          actorId: get().currentUserId,
          contactId,
          companyId: c.companyId,
          summary: `${c.firstName} ${c.lastName} moved to ${stage.replace(/_/g, " ")}`,
        });
      },

      addCompany: (c) => {
        const company: Company = {
          id: `co_${nanoid(8)}`,
          name: c.name,
          domain: c.domain,
          website: c.website ?? `https://${c.domain}`,
          industry: c.industry,
          status: c.status ?? "prospect",
          tags: c.tags ?? [],
          ownerId: c.ownerId ?? get().currentUserId,
          notes: c.notes,
          enrichment: c.enrichment ?? { crawlStatus: "never" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ companies: [company, ...s.companies] }));
        sync(get().workspaceId, () => repo.companies.upsert(company, get().workspaceId!));
        return company;
      },

      updateCompany: (id, patch) => {
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
          ),
        }));
        const updated = get().companies.find((c) => c.id === id);
        if (updated) sync(get().workspaceId, () => repo.companies.upsert(updated, get().workspaceId!));
      },

      addTemplate: (t) => {
        const tpl: EmailTemplate = {
          id: `tpl_${nanoid(8)}`,
          name: t.name,
          category: t.category ?? "custom",
          subject: t.subject ?? "",
          body: t.body ?? "",
          ownerId: t.ownerId ?? get().currentUserId,
          tags: t.tags ?? [],
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        set((s) => ({ templates: [tpl, ...s.templates] }));
        sync(get().workspaceId, () => repo.templates.upsert(tpl, get().workspaceId!));
        return tpl;
      },

      updateTemplate: (id, patch) => {
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id
              ? { ...t, ...patch, version: t.version + 1, updatedAt: new Date().toISOString() }
              : t,
          ),
        }));
        const updated = get().templates.find((t) => t.id === id);
        if (updated) sync(get().workspaceId, () => repo.templates.upsert(updated, get().workspaceId!));
        get().logActivity({
          type: "template_edited",
          actorId: get().currentUserId,
          summary: `Template "${updated?.name}" edited`,
        });
      },

      deleteTemplate: (id) => {
        set((s) => ({ templates: s.templates.map((t) => (t.id === id ? { ...t, archived: true } : t)) }));
        const archived = get().templates.find((t) => t.id === id);
        if (archived) sync(get().workspaceId, () => repo.templates.upsert(archived, get().workspaceId!));
      },

      addSnippet: (input) => {
        const snippet: Snippet = { id: `sn_${nanoid(8)}`, ...input };
        set((s) => ({ snippets: [snippet, ...s.snippets] }));
        sync(get().workspaceId, () => repo.snippets.upsert(snippet, get().workspaceId!));
        return snippet;
      },

      addCampaign: (c) => {
        const camp: Campaign = {
          id: `camp_${nanoid(8)}`,
          name: c.name,
          ownerId: c.ownerId ?? get().currentUserId,
          status: c.status ?? "draft",
          sequenceId: c.sequenceId,
          sendingAccountIds: c.sendingAccountIds ?? [],
          contactIds: c.contactIds ?? [],
          sendingWindow: c.sendingWindow ?? get().campaigns[0].sendingWindow,
          stopOnReply: c.stopOnReply ?? true,
          requireApproval: c.requireApproval ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ campaigns: [camp, ...s.campaigns] }));
        sync(get().workspaceId, () => repo.campaigns.upsert(camp, get().workspaceId!));
        get().logActivity({
          type: "campaign_created",
          actorId: camp.ownerId,
          campaignId: camp.id,
          summary: `Campaign "${camp.name}" created`,
        });
        return camp;
      },

      updateCampaign: (id, patch) => {
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
          ),
        }));
        const updated = get().campaigns.find((c) => c.id === id);
        if (updated) sync(get().workspaceId, () => repo.campaigns.upsert(updated, get().workspaceId!));
      },

      setCampaignStatus: (id, status) => {
        const camp = get().campaigns.find((c) => c.id === id);
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === id
              ? { ...c, status, startedAt: status === "active" && !c.startedAt ? new Date().toISOString() : c.startedAt, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
        const updated = get().campaigns.find((c) => c.id === id);
        if (updated) sync(get().workspaceId, () => repo.campaigns.upsert(updated, get().workspaceId!));
        if (camp) {
          const type: ActivityType = status === "paused" ? "campaign_paused" : status === "active" ? "campaign_resumed" : "campaign_created";
          get().logActivity({
            type,
            actorId: get().currentUserId,
            campaignId: id,
            summary: `Campaign "${camp.name}" ${status}`,
          });
        }
      },

      addSequence: (s) => {
        set((st) => ({ sequences: [s, ...st.sequences] }));
        sync(get().workspaceId, () => repo.sequences.upsert(s, get().workspaceId!));
      },
      updateSequence: (id, patch) => {
        set((s) => ({
          sequences: s.sequences.map((q) =>
            q.id === id ? { ...q, ...patch, updatedAt: new Date().toISOString() } : q,
          ),
        }));
        const updated = get().sequences.find((q) => q.id === id);
        if (updated) sync(get().workspaceId, () => repo.sequences.upsert(updated, get().workspaceId!));
      },

      updateThread: (id, patch) => {
        set((s) => ({ threads: s.threads.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        const updated = get().threads.find((t) => t.id === id);
        if (updated) sync(get().workspaceId, () => repo.threads.upsert(updated, get().workspaceId!));
      },

      addMessage: (message) => {
        set((s) => ({
          messages: [...s.messages, message],
          threads: s.threads.map((thread) =>
            thread.id === message.threadId
              ? {
                  ...thread,
                  messageIds: [...thread.messageIds, message.id],
                  lastMessageAt: message.sentAt ?? message.createdAt,
                }
              : thread,
          ),
        }));
        sync(get().workspaceId, () => repo.messages.upsert(message, get().workspaceId!));
        const thread = get().threads.find((item) => item.id === message.threadId);
        if (thread) sync(get().workspaceId, () => repo.threads.upsert(thread, get().workspaceId!));
      },

      setThreadState: (id, state) => {
        set((s) => ({ threads: s.threads.map((t) => (t.id === id ? { ...t, state } : t)) }));
        const updated = get().threads.find((t) => t.id === id);
        if (updated) sync(get().workspaceId, () => repo.threads.upsert(updated, get().workspaceId!));
      },

      setThreadSentiment: (id, sentiment) => {
        set((s) => ({ threads: s.threads.map((t) => (t.id === id ? { ...t, sentiment, interested: sentiment === "positive" } : t)) }));
        const updated = get().threads.find((t) => t.id === id);
        if (updated) sync(get().workspaceId, () => repo.threads.upsert(updated, get().workspaceId!));
        if (sentiment === "positive") {
          const t = get().threads.find((x) => x.id === id);
          if (t)
            get().logActivity({
              type: "positive_reply",
              actorId: get().currentUserId,
              contactId: t.contactId,
              companyId: t.companyId,
              summary: `Marked thread interested`,
            });
        }
      },

      markMeetingBooked: (threadId) => {
        const t = get().threads.find((x) => x.id === threadId);
        if (!t) return;
        set((s) => ({ threads: s.threads.map((x) => (x.id === threadId ? { ...x, meetingBooked: true, sentiment: "positive" } : x)) }));
        const updated = get().threads.find((x) => x.id === threadId);
        if (updated) sync(get().workspaceId, () => repo.threads.upsert(updated, get().workspaceId!));
        // moveStage mirrors the contact itself (repo.contacts.upsert) in LIVE mode.
        get().moveStage(t.contactId, "meeting_scheduled");
        get().logActivity({
          type: "meeting_booked",
          actorId: get().currentUserId,
          contactId: t.contactId,
          companyId: t.companyId,
          summary: `Meeting booked from inbox`,
        });
      },

      addComment: (c) => {
        const comment: InternalComment = { id: `cm_${nanoid(8)}`, createdAt: new Date().toISOString(), ...c };
        set((s) => ({ comments: [comment, ...s.comments] }));
        sync(get().workspaceId, () => repo.comments.upsert(comment, get().workspaceId!));
      },

      addNote: (n) => {
        const note: Note = { id: `note_${nanoid(8)}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...n };
        set((s) => ({ notes: [note, ...s.notes] }));
        sync(get().workspaceId, () => repo.notes.upsert(note, get().workspaceId!));
        get().logActivity({
          type: "note_added",
          actorId: n.authorId,
          companyId: n.companyId,
          summary: "Note added",
        });
      },

      addMeeting: (m) => {
        const meeting: Meeting = { id: `mt_${nanoid(8)}`, createdAt: new Date().toISOString(), ...m };
        set((s) => ({ meetings: [meeting, ...s.meetings] }));
        sync(get().workspaceId, () => repo.meetings.upsert(meeting, get().workspaceId!));
        get().logActivity({
          type: "meeting_booked",
          actorId: m.ownerId,
          companyId: m.companyId,
          contactId: m.contactId,
          summary: `Meeting "${m.title}" scheduled`,
        });
        return meeting;
      },

      updateMeeting: (id, patch) => {
        set((s) => ({ meetings: s.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
        const updated = get().meetings.find((m) => m.id === id);
        if (updated) sync(get().workspaceId, () => repo.meetings.upsert(updated, get().workspaceId!));
      },

      addAttachment: (input) => {
        const attachment: Attachment = {
          ...input,
          id: input.id ?? `att_${nanoid(8)}`,
          createdAt: input.createdAt ?? new Date().toISOString(),
        };
        set((s) => ({ attachments: [attachment, ...s.attachments] }));
        sync(get().workspaceId, () => repo.attachments.upsert(attachment, get().workspaceId!));
        return attachment;
      },

      addExperiment: (input) => {
        const experiment: Experiment = {
          id: `exp_${nanoid(8)}`,
          createdAt: new Date().toISOString(),
          ...input,
        };
        set((s) => ({ experiments: [experiment, ...s.experiments] }));
        sync(get().workspaceId, () => repo.experiments.upsert(experiment, get().workspaceId!));
        return experiment;
      },

      updateScoring: (config) => {
        set({ scoring: config });
        sync(get().workspaceId, () => repo.scoring.upsert(config, get().workspaceId!));
        get().recomputeScores();
      },

      recomputeScores: () => {
        set((s) => {
          const companyById = new Map(s.companies.map((c) => [c.id, c]));
          const contacts = s.contacts.map((contact) => {
            const company = companyById.get(contact.companyId);
            if (!company) return contact;
            const engagementCount = s.threads.filter(
              (t) => t.contactId === contact.id && t.sentiment !== "unclassified",
            ).length;
            const res = scoreContact({ contact, company, engagementCount }, s.scoring);
            return { ...contact, score: res.score, scoreBreakdown: res.components };
          });
          return { contacts };
        });
        const affected = get().contacts;
        sync(get().workspaceId, () => repo.contacts.bulkUpsert(affected, get().workspaceId!));
      },

      updateAccount: (id, patch) => {
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
        const updated = get().accounts.find((a) => a.id === id);
        if (updated) sync(get().workspaceId, () => repo.sendingAccounts.upsert(updated, get().workspaceId!));
      },
      addAccount: (a) => {
        set((s) => ({ accounts: [a, ...s.accounts] }));
        sync(get().workspaceId, () => repo.sendingAccounts.upsert(a, get().workspaceId!));
      },

      regenerateFollowUps: () => {
        set((s) => ({
          followUps: generateFollowUps({
            contacts: s.contacts,
            companies: s.companies,
            campaigns: s.campaigns,
            sequences: s.sequences,
            templates: s.templates,
            snippets: s.snippets,
            senderName: s.users.find((u) => u.id === s.currentUserId)?.name ?? "Lucas",
          }),
        }));
        const ws = get().workspaceId;
        for (const f of get().followUps) sync(ws, () => repo.followUps.upsert(f, ws!));
      },

      setFollowUpStatus: (id, status) => {
        set((s) => ({ followUps: s.followUps.map((f) => (f.id === id ? { ...f, status } : f)) }));
        const updated = get().followUps.find((f) => f.id === id);
        if (updated) sync(get().workspaceId, () => repo.followUps.upsert(updated, get().workspaceId!));
        if (status === "sent") {
          const f = get().followUps.find((x) => x.id === id);
          if (f) {
            get().updateContact(f.contactId, {
              lastContactedAt: new Date().toISOString(),
              nextFollowUpAt: undefined,
            });
            get().logActivity({
              type: "email_sent",
              actorId: get().currentUserId,
              contactId: f.contactId,
              companyId: f.companyId,
              summary: "Follow-up sent",
            });
          }
        }
      },

      runCrawl: async (companyId) => {
        const company = get().companies.find((c) => c.id === companyId);
        if (!company) return;
        get().updateCompany(companyId, {
          enrichment: { ...company.enrichment, crawlStatus: "crawling" },
        });
        try {
          const response = await fetch("/api/crawl", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ domain: company.domain }),
          });
          const result = (await response.json()) as CrawlResult & { error?: string };
          if (!response.ok || result.status === "error") {
            throw new Error(result.error ?? "Crawl failed");
          }
          get().updateCompany(companyId, {
            enrichment: {
              ...company.enrichment,
              crawlStatus: "done",
              lastCrawledAt: result.finishedAt ?? new Date().toISOString(),
              techStack: result.techStack,
              socialLinks: result.socialLinks,
              discoveredEmails: result.emailsFound,
              contactPageUrl: result.pages.find((p) => p.type === "contact")?.url,
              aboutPageUrl: result.pages.find((p) => p.type === "about")?.url,
              careersPageUrl: result.pages.find((p) => p.type === "careers")?.url,
              teamPageUrl: result.pages.find((p) => p.type === "team")?.url,
            },
          });
          const crawlResult: CrawlResult = { ...result, companyId };
          sync(get().workspaceId, () => repo.crawlResults.upsert(crawlResult, get().workspaceId!));
          get().logActivity({
            type: "crawl_completed",
            actorId: get().currentUserId,
            companyId,
            summary: `Crawled ${company.domain} — ${result.emailsFound.length} emails, ${result.pagesCrawled} pages`,
          });
        } catch {
          get().updateCompany(companyId, {
            enrichment: { ...company.enrichment, crawlStatus: "error" },
          });
        }
      },

      importContacts: (rows) => {
        const state = get();
        const existingEmails = new Set(state.contacts.map((c) => c.email.toLowerCase()));
        const domainToCompany = new Map(state.companies.map((c) => [c.domain.toLowerCase(), c.id]));
        let created = 0;
        let duplicates = 0;
        let companiesCreated = 0;
        const newCompanies: Company[] = [];
        const newContacts: Contact[] = [];

        for (const { contact, company } of rows) {
          // Ensure the company exists for every row with a domain — even
          // email-less website-list rows must create/reuse a company.
          let companyId: string | undefined;
          if (company.domain) {
            companyId = domainToCompany.get(company.domain.toLowerCase());
            if (!companyId) {
              const co: Company = {
                id: `co_${nanoid(8)}`,
                name: company.name ?? company.domain.split(".")[0],
                domain: company.domain,
                website: company.website ?? `https://${company.domain}`,
                industry: company.industry,
                status: "prospect",
                tags: [],
                ownerId: state.currentUserId,
                enrichment: { crawlStatus: "never" },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              companyId = co.id;
              domainToCompany.set(company.domain.toLowerCase(), co.id);
              newCompanies.push(co);
              companiesCreated++;
            }
          }

          // Only create a contact when we have an email, a company, and it's not a dupe.
          if (!contact.email || !companyId) continue;
          if (existingEmails.has(contact.email.toLowerCase())) {
            duplicates++;
            continue;
          }
          existingEmails.add(contact.email.toLowerCase());
          newContacts.push({
            id: `ct_${nanoid(8)}`,
            companyId,
            firstName: contact.firstName ?? "",
            lastName: contact.lastName ?? "",
            email: contact.email,
            emailValidity: contact.emailValidity ?? "unknown",
            jobTitle: contact.jobTitle,
            linkedinUrl: contact.linkedinUrl,
            phone: contact.phone,
            stage: "new",
            stageEnteredAt: new Date().toISOString(),
            ownerId: state.currentUserId,
            tags: [],
            score: 0,
            linkedinStatus: "none",
            unsubscribed: false,
            bounced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
        set((s) => ({
          companies: [...newCompanies, ...s.companies],
          contacts: [...newContacts, ...s.contacts],
        }));
        // Persist new companies first (FK parents), then the imported contacts.
        // recomputeScores() below also bulk-mirrors all contacts in LIVE mode.
        const ws = get().workspaceId;
        for (const co of newCompanies) sync(ws, () => repo.companies.upsert(co, ws!));
        sync(ws, () => repo.contacts.bulkUpsert(newContacts, ws!));
        get().recomputeScores();
        get().logActivity({
          type: "lead_imported",
          actorId: state.currentUserId,
          summary: `Imported ${created} leads and ${companiesCreated} companies (${duplicates} duplicates skipped)`,
        });
        return { created, duplicates, companiesCreated };
      },

      addSavedView: (v) => {
        const view: SavedView = { id: `sv_${nanoid(6)}`, ...v };
        set((s) => ({ savedViews: [...s.savedViews, view] }));
        sync(get().workspaceId, () => repo.savedViews.upsert(view, get().workspaceId!));
      },
    }),
    {
      name: "avarent-outbound-v1",
      // SSR-safe: noop storage on the server, localStorage in the browser.
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
      version: 3,
      partialize: (s) => {
        // Live-session bindings must be re-derived from the Supabase session on
        // every load, never restored from a snapshot. If `hydrated` is persisted,
        // LiveShell's "already hydrated" short-circuit skips bootstrap + hydrateFromDb,
        // leaving a STALE workspaceId bound to every write — Supabase RLS then rejects
        // each upsert (workspace_id not in current_workspaces()). Demo mode leaves these
        // at their defaults (hydrated:false, workspaceId:null), so omitting them is a no-op there.
        const persisted = { ...s } as Partial<AppState>;
        delete persisted.hydrated;
        delete persisted.workspaceId;
        return persisted as AppState;
      },
      // v2 blobs persisted those flags; strip them so a stale snapshot can't shadow
      // the live workspace. Entities are reloaded from the DB (live) or reseeded
      // (demo), so keeping the rest of the persisted state is safe.
      migrate: (persisted) => {
        if (persisted && typeof persisted === "object") {
          const p = persisted as Record<string, unknown>;
          delete p.hydrated;
          delete p.workspaceId;
          return p as unknown as AppState;
        }
        return persisted as AppState;
      },
    },
  ),
);

/* Build the analytics snapshot the engines consume.
 * Each slice is subscribed individually (stable refs) to avoid the
 * "getSnapshot should be cached" re-render loop from returning a new object. */
export function useSnapshot(): DataSnapshot {
  const messages = useStore((s) => s.messages);
  const threads = useStore((s) => s.threads);
  const contacts = useStore((s) => s.contacts);
  const campaigns = useStore((s) => s.campaigns);
  const templates = useStore((s) => s.templates);
  const meetings = useStore((s) => s.meetings);
  const accounts = useStore((s) => s.accounts);
  return useMemo(
    () => ({ messages, threads, contacts, campaigns, templates, meetings, accounts }),
    [messages, threads, contacts, campaigns, templates, meetings, accounts],
  );
}
