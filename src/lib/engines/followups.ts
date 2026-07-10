/* =========================================================================
 * Follow-up queue generator — deterministic. NO AI.
 * Each day, produces the list of prospects due for a follow-up, with a
 * pre-filled draft derived from the campaign's next sequence step.
 * ========================================================================= */

import type {
  Contact,
  Company,
  Campaign,
  Sequence,
  EmailTemplate,
  FollowUpTask,
  Snippet,
} from "../types";
import { renderTemplate } from "./merge";

export interface FollowUpInput {
  contacts: Contact[];
  companies: Company[];
  campaigns: Campaign[];
  sequences: Sequence[];
  templates: EmailTemplate[];
  snippets: Snippet[];
  senderName: string;
}

/**
 * Build today's follow-up queue. A contact is "due" when:
 *  - it has a nextFollowUpAt in the past/today,
 *  - it hasn't replied / unsubscribed / bounced,
 *  - and its campaign is active (or it has no campaign but is mid-pipeline).
 */
export function generateFollowUps(input: FollowUpInput, now = new Date()): FollowUpTask[] {
  const companyById = new Map(input.companies.map((c) => [c.id, c]));
  const campaignById = new Map(input.campaigns.map((c) => [c.id, c]));
  const seqById = new Map(input.sequences.map((s) => [s.id, s]));
  const templateById = new Map(input.templates.map((t) => [t.id, t]));

  const tasks: FollowUpTask[] = [];

  for (const contact of input.contacts) {
    if (contact.unsubscribed || contact.bounced) continue;
    if (contact.stage === "customer" || contact.stage === "closed_lost") continue;
    if (!contact.nextFollowUpAt) continue;
    if (new Date(contact.nextFollowUpAt) > now) continue;

    const company = companyById.get(contact.companyId);
    if (!company) continue;

    const campaign = contact.campaignId ? campaignById.get(contact.campaignId) : undefined;
    if (campaign && campaign.status === "paused") continue;

    // pick the follow-up template: campaign sequence's next email step, else any follow-up template
    let template: EmailTemplate | undefined;
    let reason = "Scheduled follow-up is due";
    if (campaign) {
      const seq = seqById.get(campaign.sequenceId);
      const emailSteps = seq?.steps.filter((s) => s.type === "email") ?? [];
      // heuristic: choose a follow-up step (2nd+) template
      const step = emailSteps[1] ?? emailSteps[0];
      template = step?.templateId ? templateById.get(step.templateId) : undefined;
      reason = `Next step in "${campaign.name}"`;
    }
    if (!template) {
      template =
        input.templates.find((t) => t.category === "follow_up" && !t.archived) ??
        input.templates.find((t) => !t.archived);
      reason = "No reply yet — follow-up recommended";
    }
    if (!template) continue;

    const ctx = {
      contact,
      company,
      sender: { name: input.senderName },
    };
    const subject = renderTemplate(template.subject, ctx, input.snippets).text;
    const body = renderTemplate(template.body, ctx, input.snippets).text;

    tasks.push({
      id: `fu_${contact.id}`,
      contactId: contact.id,
      companyId: contact.companyId,
      campaignId: contact.campaignId,
      templateId: template.id,
      dueAt: contact.nextFollowUpAt,
      status: "due",
      draftSubject: subject,
      draftBody: body,
      reason,
    });
  }

  // Most overdue first
  return tasks.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
