/* =========================================================================
 * Avarent Outbound — data layer (LIVE mode).
 * The typed browser client, workspace hydration, and a write-through
 * repository. Every Supabase side effect is a no-op unless the browser
 * client is configured (env vars present). RLS is scoped by the session
 * cookie, so all reads pass `workspace_id` explicitly and rely on RLS.
 *
 * Row mapping is delegated entirely to the pure entity mappers in
 * ./entities; this module owns only I/O and assembly (grouping messages
 * onto threads, contacts onto campaigns, memberships+profiles into users).
 * ========================================================================= */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  Activity,
  Attachment,
  Campaign,
  Company,
  Contact,
  CrawlResult,
  EmailMessage,
  EmailTemplate,
  Experiment,
  FollowUpTask,
  InternalComment,
  Meeting,
  Note,
  SavedView,
  ScoringConfig,
  SendingAccount,
  Sequence,
  Snippet,
  Thread,
  User,
  UserRole,
  Workspace,
} from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

import { companies } from "./entities/companies";
import { contacts } from "./entities/contacts";
import { templates, snippets, sequences } from "./entities/content";
import { campaigns, sendingAccounts } from "./entities/outreach";
import { threads, emailMessages } from "./entities/inbox";
import {
  meetings,
  notes,
  attachments,
  threadComments,
  activities,
} from "./entities/records";
import {
  experiments,
  savedViews,
  scoringConfig,
  followUps,
  crawlResults,
  workspaces,
  profiles,
} from "./entities/config";

/* -------------------------------------------------------------------------- */
/* Snapshot shape — the whole workspace in one object.                         */
/* -------------------------------------------------------------------------- */

export interface WorkspaceSnapshot {
  workspace: Workspace | null;
  users: User[];
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
  scoring: ScoringConfig | null;
  followUps: FollowUpTask[];
}

/* -------------------------------------------------------------------------- */
/* Browser client — memoized, null when unconfigured.                          */
/* -------------------------------------------------------------------------- */

let browserDb: SupabaseClient<Database> | null | undefined;

/**
 * Typed browser Supabase client. Memoized across calls. Returns null when
 * either public env var is missing (demo mode / build without config), which
 * makes every repo write a silent no-op. The auth session cookie scopes RLS.
 */
export function getBrowserDb(): SupabaseClient<Database> | null {
  if (browserDb !== undefined) return browserDb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  browserDb = url && key ? createClient<Database>(url, key) : null;
  return browserDb;
}

/* -------------------------------------------------------------------------- */
/* Hydration — pull an entire workspace and assemble the domain snapshot.      */
/* -------------------------------------------------------------------------- */

/** Membership row joined to its profile, as returned by the select below. */
type MembershipWithProfile = {
  role: UserRole;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

/** Unwrap a list select: throw on error, coalesce a null payload to []. */
function rows<T>(
  label: string,
  res: { data: T[] | null; error: { message: string } | null },
): T[] {
  if (res.error) {
    throw new Error(`hydrateWorkspace: ${label} failed — ${res.error.message}`);
  }
  return res.data ?? [];
}

/** Unwrap a maybeSingle select: throw on error, pass the row (or null) through. */
function one<T>(
  label: string,
  res: { data: T | null; error: { message: string } | null },
): T | null {
  if (res.error) {
    throw new Error(`hydrateWorkspace: ${label} failed — ${res.error.message}`);
  }
  return res.data;
}

/**
 * Load every workspace-scoped table and map rows into the domain model.
 * Independent selects run in parallel. Threads receive their ordered
 * messageIds and campaigns their contactIds via in-memory grouping.
 * Returns empty arrays / null where a resource is absent.
 */
export async function hydrateWorkspace(
  workspaceId: string,
): Promise<WorkspaceSnapshot> {
  const db = getBrowserDb();
  if (!db) {
    return emptySnapshot();
  }

  // Literal table names per select so PostgREST infers each Row type exactly.
  // A dynamic-string helper would collapse every builder into a union.
  const [
    workspaceRes,
    membershipRes,
    companyRes,
    contactRes,
    templateRes,
    snippetRes,
    sequenceRes,
    campaignRes,
    accountRes,
    messageRes,
    threadRes,
    meetingRes,
    activityRes,
    commentRes,
    noteRes,
    attachmentRes,
    experimentRes,
    savedViewRes,
    scoringRes,
    followUpRes,
  ] = await Promise.all([
    db.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
    db
      .from("memberships")
      .select("role, profiles(*)")
      .eq("workspace_id", workspaceId),
    db.from("companies").select("*").eq("workspace_id", workspaceId),
    db.from("contacts").select("*").eq("workspace_id", workspaceId),
    db.from("templates").select("*").eq("workspace_id", workspaceId),
    db.from("snippets").select("*").eq("workspace_id", workspaceId),
    db.from("sequences").select("*").eq("workspace_id", workspaceId),
    db.from("campaigns").select("*").eq("workspace_id", workspaceId),
    db.from("sending_accounts").select("*").eq("workspace_id", workspaceId),
    db
      .from("email_messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    db.from("threads").select("*").eq("workspace_id", workspaceId),
    db.from("meetings").select("*").eq("workspace_id", workspaceId),
    db.from("activities").select("*").eq("workspace_id", workspaceId),
    db.from("thread_comments").select("*").eq("workspace_id", workspaceId),
    db.from("notes").select("*").eq("workspace_id", workspaceId),
    db.from("attachments").select("*").eq("workspace_id", workspaceId),
    db.from("experiments").select("*").eq("workspace_id", workspaceId),
    db.from("saved_views").select("*").eq("workspace_id", workspaceId),
    db
      .from("scoring_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    db.from("follow_ups").select("*").eq("workspace_id", workspaceId),
  ]);

  const workspaceRow = one("workspaces", workspaceRes);
  const memberRows = rows(
    "memberships",
    membershipRes,
  ) as unknown as MembershipWithProfile[];
  const companyRows = rows("companies", companyRes);
  const contactRows = rows("contacts", contactRes);
  const templateRows = rows("templates", templateRes);
  const snippetRows = rows("snippets", snippetRes);
  const sequenceRows = rows("sequences", sequenceRes);
  const campaignRows = rows("campaigns", campaignRes);
  const accountRows = rows("sending_accounts", accountRes);
  const messageRows = rows("email_messages", messageRes);
  const threadRows = rows("threads", threadRes);
  const meetingRows = rows("meetings", meetingRes);
  const activityRows = rows("activities", activityRes);
  const commentRows = rows("thread_comments", commentRes);
  const noteRows = rows("notes", noteRes);
  const attachmentRows = rows("attachments", attachmentRes);
  const experimentRows = rows("experiments", experimentRes);
  const savedViewRows = rows("saved_views", savedViewRes);
  const scoringRow = one("scoring_config", scoringRes);
  const followUpRows = rows("follow_ups", followUpRes);

  // Assemble thread.messageIds: email_messages already come ordered by
  // created_at asc, so grouping preserves chronological order per thread.
  const messageIdsByThread = new Map<string, string[]>();
  for (const m of messageRows) {
    const list = messageIdsByThread.get(m.thread_id);
    if (list) list.push(m.id);
    else messageIdsByThread.set(m.thread_id, [m.id]);
  }

  // Assemble campaign.contactIds: contact membership lives on contacts.campaign_id.
  const contactIdsByCampaign = new Map<string, string[]>();
  for (const c of contactRows) {
    if (!c.campaign_id) continue;
    const list = contactIdsByCampaign.get(c.campaign_id);
    if (list) list.push(c.id);
    else contactIdsByCampaign.set(c.campaign_id, [c.id]);
  }

  // Users from memberships + profiles (role carried in from the membership).
  const users: User[] = [];
  for (const row of memberRows) {
    if (row.profiles) users.push(profiles.fromRow(row.profiles, row.role));
  }

  return {
    workspace: workspaceRow ? workspaces.fromRow(workspaceRow) : null,
    users,
    companies: companyRows.map((r) => companies.fromRow(r)),
    contacts: contactRows.map((r) => contacts.fromRow(r)),
    templates: templateRows.map((r) => templates.fromRow(r)),
    snippets: snippetRows.map((r) => snippets.fromRow(r)),
    sequences: sequenceRows.map((r) => sequences.fromRow(r)),
    campaigns: campaignRows.map((r) =>
      campaigns.fromRow(r, contactIdsByCampaign.get(r.id) ?? []),
    ),
    accounts: accountRows.map((r) => sendingAccounts.fromRow(r)),
    messages: messageRows.map((r) => emailMessages.fromRow(r)),
    threads: threadRows.map((r) =>
      threads.fromRow(r, messageIdsByThread.get(r.id) ?? []),
    ),
    meetings: meetingRows.map((r) => meetings.fromRow(r)),
    activities: activityRows.map((r) => activities.fromRow(r)),
    comments: commentRows.map((r) => threadComments.fromRow(r)),
    notes: noteRows.map((r) => notes.fromRow(r)),
    attachments: attachmentRows.map((r) => attachments.fromRow(r)),
    experiments: experimentRows.map((r) => experiments.fromRow(r)),
    savedViews: savedViewRows.map((r) => savedViews.fromRow(r)),
    scoring: scoringRow ? scoringConfig.fromRow(scoringRow) : null,
    followUps: followUpRows.map((r) => followUps.fromRow(r)),
  };
}

/** A fully-empty snapshot — used when the browser client is unconfigured. */
function emptySnapshot(): WorkspaceSnapshot {
  return {
    workspace: null,
    users: [],
    companies: [],
    contacts: [],
    templates: [],
    snippets: [],
    sequences: [],
    campaigns: [],
    accounts: [],
    messages: [],
    threads: [],
    meetings: [],
    activities: [],
    comments: [],
    notes: [],
    attachments: [],
    experiments: [],
    savedViews: [],
    scoring: null,
    followUps: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Write-through repository — every method no-ops when the client is null.     */
/* -------------------------------------------------------------------------- */

/** Await a Supabase builder and throw a labelled error on failure. */
async function run(
  label: string,
  op: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await op;
  if (error) throw new Error(`repo.${label} failed — ${error.message}`);
}

export const repo = {
  workspaces: {
    async upsert(x: Workspace, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run("workspaces.upsert", db.from(workspaces.table).upsert(workspaces.toRow(x, ws)));
    },
  },

  companies: {
    async upsert(x: Company, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "companies.upsert",
        db.from(companies.table).upsert(companies.toRow(x, ws)),
      );
    },
    async remove(id: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "companies.remove",
        db.from(companies.table).delete().eq("id", id),
      );
    },
  },

  contacts: {
    async upsert(x: Contact, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "contacts.upsert",
        db.from(contacts.table).upsert(contacts.toRow(x, ws)),
      );
    },
    async bulkUpsert(xs: Contact[], ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db || xs.length === 0) return;
      await run(
        "contacts.bulkUpsert",
        db.from(contacts.table).upsert(xs.map((x) => contacts.toRow(x, ws))),
      );
    },
    async remove(id: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "contacts.remove",
        db.from(contacts.table).delete().eq("id", id),
      );
    },
  },

  templates: {
    async upsert(x: EmailTemplate, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "templates.upsert",
        db.from(templates.table).upsert(templates.toRow(x, ws)),
      );
    },
  },

  snippets: {
    async upsert(x: Snippet, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "snippets.upsert",
        db.from(snippets.table).upsert(snippets.toRow(x, ws)),
      );
    },
  },

  sequences: {
    async upsert(x: Sequence, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "sequences.upsert",
        db.from(sequences.table).upsert(sequences.toRow(x, ws)),
      );
    },
  },

  campaigns: {
    async upsert(x: Campaign, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "campaigns.upsert",
        db.from(campaigns.table).upsert(campaigns.toRow(x, ws)),
      );
    },
  },

  sendingAccounts: {
    async upsert(x: SendingAccount, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "sendingAccounts.upsert",
        db.from(sendingAccounts.table).upsert(sendingAccounts.toRow(x, ws)),
      );
    },
  },

  threads: {
    async upsert(x: Thread, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "threads.upsert",
        db.from(threads.table).upsert(threads.toRow(x, ws)),
      );
    },
  },

  messages: {
    async upsert(x: EmailMessage, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "messages.upsert",
        db.from(emailMessages.table).upsert(emailMessages.toRow(x, ws)),
      );
    },
  },

  meetings: {
    async upsert(x: Meeting, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "meetings.upsert",
        db.from(meetings.table).upsert(meetings.toRow(x, ws)),
      );
    },
  },

  notes: {
    async upsert(x: Note, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run("notes.upsert", db.from(notes.table).upsert(notes.toRow(x, ws)));
    },
  },

  attachments: {
    async upsert(x: Attachment, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "attachments.upsert",
        db.from(attachments.table).upsert(attachments.toRow(x, ws)),
      );
    },
  },

  comments: {
    async upsert(x: InternalComment, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "comments.upsert",
        db.from(threadComments.table).upsert(threadComments.toRow(x, ws)),
      );
    },
  },

  activities: {
    async insert(x: Activity, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "activities.insert",
        db.from(activities.table).insert(activities.toRow(x, ws)),
      );
    },
  },

  experiments: {
    async upsert(x: Experiment, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "experiments.upsert",
        db.from(experiments.table).upsert(experiments.toRow(x, ws)),
      );
    },
  },

  savedViews: {
    async upsert(x: SavedView, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "savedViews.upsert",
        db.from(savedViews.table).upsert(savedViews.toRow(x, ws)),
      );
    },
  },

  scoring: {
    async upsert(x: ScoringConfig, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "scoring.upsert",
        db
          .from(scoringConfig.table)
          .upsert(scoringConfig.toRow(x, ws), { onConflict: "workspace_id" }),
      );
    },
  },

  followUps: {
    async upsert(x: FollowUpTask, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "followUps.upsert",
        db.from(followUps.table).upsert(followUps.toRow(x, ws)),
      );
    },
  },

  crawlResults: {
    async upsert(x: CrawlResult, ws: string): Promise<void> {
      const db = getBrowserDb();
      if (!db) return;
      await run(
        "crawlResults.upsert",
        db.from(crawlResults.table).upsert(crawlResults.toRow(x, ws)),
      );
    },
  },
};
