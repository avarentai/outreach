/* =========================================================================
 * Campaign materialization — deterministic. NO AI.
 * Turns an activated campaign into the concrete rows the worker drains:
 * one thread per contact, the first email step's message per contact, and a
 * queue row per message. Send times, account round-robin, and windowed
 * spacing are delegated to the scheduler engine; subject/body rendering to
 * the template merge engine. Pure and unit-testable: the only clock input is
 * the `now` parameter — nothing reads Date.now() at module scope.
 * ========================================================================= */

import { nanoid } from "nanoid";

import type {
  Campaign,
  Company,
  Contact,
  EmailMessage,
  EmailTemplate,
  Sequence,
  SendingAccount,
  Snippet,
  Thread,
} from "../types";
import { wordCount } from "../utils";
import { planSends, DEFAULT_SENDING_WINDOW } from "./scheduler";
import { renderTemplate, type MergeContext } from "./merge";

/* -------------------------------------------------------------------------- */
/* I/O shapes — plain objects the API route persists via the entity mappers.  */
/* -------------------------------------------------------------------------- */

/** A thread ready to insert (no workspace_id — injected at write time). */
export type ThreadInsertLike = Omit<Thread, "messageIds">;

/** A message ready to insert (no workspace_id — injected at write time). */
export type EmailMessageLike = EmailMessage;

/** A queue entry pairing a message to its computed send time. */
export interface QueueEntryLike {
  messageId: string;
  sendAfter: string;
}

export interface MaterializeInput {
  campaign: Campaign;
  sequence: Sequence | undefined;
  templates: EmailTemplate[];
  snippets: Snippet[];
  contacts: Contact[];
  companies: Company[];
  accounts: SendingAccount[];
  now: Date;
}

export interface MaterializeOutput {
  threads: ThreadInsertLike[];
  messages: EmailMessageLike[];
  queue: QueueEntryLike[];
}

/* -------------------------------------------------------------------------- */
/* Materialize                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Deterministically expand a campaign into threads + first-step messages +
 * queue rows. Enrolls the given contacts (already filtered to the campaign),
 * skipping any that are unsubscribed or bounced. Returns empty output when the
 * sequence has no leading email step, so activation stays a no-op-safe write.
 */
export function materializeCampaign(input: MaterializeInput): MaterializeOutput {
  const { campaign, sequence, templates, snippets, contacts, companies, accounts, now } = input;

  const empty: MaterializeOutput = { threads: [], messages: [], queue: [] };
  if (!sequence) return empty;

  // The sequence's first email step drives the initial send. Waits/conditions
  // before it don't gate the very first message — the worker handles the rest.
  const firstEmail = sequence.steps.find((s) => s.type === "email");
  if (!firstEmail) return empty;

  const template = firstEmail.templateId
    ? templates.find((t) => t.id === firstEmail.templateId)
    : undefined;

  // Only enroll deliverable contacts. Order is preserved for stable scheduling.
  const enrolled = contacts.filter((c) => !c.unsubscribed && !c.bounced);
  if (enrolled.length === 0) return empty;

  const window = campaign.sendingWindow ?? DEFAULT_SENDING_WINDOW;
  const accountIds = campaign.sendingAccountIds.length
    ? campaign.sendingAccountIds
    : accounts.map((a) => a.id);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // Reuse the scheduler: it round-robins accounts and spreads sends across the
  // window (daily limits, min gap, jitter). Seed off the campaign id so plans
  // are reproducible for a given campaign + start time.
  const plans = planSends(enrolled.length, accountIds, window, now, hashCampaign(campaign.id));

  const threads: ThreadInsertLike[] = [];
  const messages: EmailMessageLike[] = [];
  const queue: QueueEntryLike[] = [];

  const nowIso = now.toISOString();

  enrolled.forEach((contact, i) => {
    const plan = plans[i];
    const account = accountById.get(plan.accountId);
    const company = companyById.get(contact.companyId);

    const ctx: MergeContext = {
      contact: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        jobTitle: contact.jobTitle,
      },
      company: {
        name: company?.name ?? "",
        industry: company?.industry,
        website: company?.website,
        domain: company?.domain ?? "",
      },
      sender: account ? { name: account.fromName } : undefined,
    };

    const rawSubject = firstEmail.subjectOverride ?? template?.subject ?? "";
    const rawBody = template?.body ?? "";
    const subject = renderTemplate(rawSubject, ctx, snippets).text;
    const bodyResult = renderTemplate(rawBody, ctx, snippets);

    const threadId = `th_${nanoid(12)}`;
    const messageId = `msg_${nanoid(12)}`;

    threads.push({
      id: threadId,
      contactId: contact.id,
      companyId: contact.companyId,
      campaignId: campaign.id,
      subject,
      ownerId: campaign.ownerId || undefined,
      state: "open",
      sentiment: "unclassified",
      interested: undefined,
      meetingBooked: false,
      snoozedUntil: undefined,
      lastMessageAt: plan.scheduledAt,
      unread: false,
      createdAt: nowIso,
    });

    messages.push({
      id: messageId,
      threadId,
      contactId: contact.id,
      companyId: contact.companyId,
      campaignId: campaign.id,
      sequenceStepId: firstEmail.id,
      templateId: template?.id,
      sendingAccountId: plan.accountId,
      direction: "outbound",
      status: "queued",
      subject,
      body: bodyResult.text,
      fromEmail: account?.fromEmail ?? "",
      toEmail: contact.email,
      scheduledAt: plan.scheduledAt,
      sentAt: undefined,
      openedAt: undefined,
      repliedAt: undefined,
      bounceReason: undefined,
      wordCount: bodyResult.words || wordCount(bodyResult.text),
      abVariant: undefined,
      attempts: 0,
      createdAt: nowIso,
    });

    queue.push({ messageId, sendAfter: plan.scheduledAt });
  });

  return { threads, messages, queue };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Stable 32-bit seed from a campaign id (FNV-1a) for reproducible plans. */
function hashCampaign(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
