/* =========================================================================
 * Avarent Outbound — inbox mappers (threads, email messages)
 * Pure TS<->DB translation. camelCase domain <-> snake_case rows.
 * ========================================================================= */

import type { EmailMessage, Thread } from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";

export const threads = {
  table: "threads" as const,

  toRow(
    x: Thread,
    workspaceId: string,
  ): Database["public"]["Tables"]["threads"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      contact_id: x.contactId,
      company_id: x.companyId,
      campaign_id: x.campaignId ?? null,
      subject: x.subject,
      owner_id: x.ownerId ?? null,
      state: x.state,
      sentiment: x.sentiment,
      interested: x.interested ?? null,
      meeting_booked: x.meetingBooked,
      snoozed_until: x.snoozedUntil ?? null,
      last_message_at: x.lastMessageAt,
      unread: x.unread,
      created_at: x.createdAt,
    };
  },

  fromRow(
    r: Database["public"]["Tables"]["threads"]["Row"],
    messageIds: string[] = [],
  ): Thread {
    return {
      id: r.id,
      contactId: r.contact_id,
      companyId: r.company_id,
      campaignId: r.campaign_id ?? undefined,
      subject: r.subject,
      ownerId: r.owner_id ?? undefined,
      state: r.state,
      sentiment: r.sentiment,
      interested: r.interested ?? undefined,
      meetingBooked: r.meeting_booked,
      snoozedUntil: r.snoozed_until ?? undefined,
      lastMessageAt: r.last_message_at,
      unread: r.unread,
      messageIds,
      createdAt: r.created_at,
    };
  },
};

export const emailMessages = {
  table: "email_messages" as const,

  toRow(
    x: EmailMessage,
    workspaceId: string,
  ): Database["public"]["Tables"]["email_messages"]["Insert"] {
    return {
      id: x.id,
      workspace_id: workspaceId,
      thread_id: x.threadId,
      contact_id: x.contactId,
      company_id: x.companyId,
      campaign_id: x.campaignId ?? null,
      sequence_step_id: x.sequenceStepId ?? null,
      template_id: x.templateId ?? null,
      sending_account_id: x.sendingAccountId ?? null,
      direction: x.direction,
      status: x.status,
      subject: x.subject,
      body: x.body,
      from_email: x.fromEmail,
      to_email: x.toEmail,
      scheduled_at: x.scheduledAt ?? null,
      sent_at: x.sentAt ?? null,
      opened_at: x.openedAt ?? null,
      replied_at: x.repliedAt ?? null,
      bounce_reason: x.bounceReason ?? null,
      word_count: x.wordCount,
      ab_variant: x.abVariant ?? null,
      attempts: x.attempts ?? 0,
      provider_message_id: null,
      created_at: x.createdAt,
    };
  },

  fromRow(
    r: Database["public"]["Tables"]["email_messages"]["Row"],
  ): EmailMessage {
    return {
      id: r.id,
      threadId: r.thread_id,
      contactId: r.contact_id,
      companyId: r.company_id,
      campaignId: r.campaign_id ?? undefined,
      sequenceStepId: r.sequence_step_id ?? undefined,
      templateId: r.template_id ?? undefined,
      sendingAccountId: r.sending_account_id ?? undefined,
      direction: r.direction,
      status: r.status,
      subject: r.subject,
      body: r.body,
      fromEmail: r.from_email,
      toEmail: r.to_email,
      scheduledAt: r.scheduled_at ?? undefined,
      sentAt: r.sent_at ?? undefined,
      openedAt: r.opened_at ?? undefined,
      repliedAt: r.replied_at ?? undefined,
      bounceReason: r.bounce_reason ?? undefined,
      wordCount: r.word_count,
      abVariant: r.ab_variant ?? undefined,
      attempts: r.attempts,
      createdAt: r.created_at,
    };
  },
};
