import type {
  PipelineStage,
  CampaignStatus,
  ReplySentiment,
  TemplateCategory,
  MessageStatus,
  ActivityType,
  CompanyStatus,
} from "./types";

export const APP_NAME = "Avarent Outbound";

/* Pipeline stage presentation */
export const STAGE_META: Record<
  PipelineStage,
  { label: string; color: string; short: string }
> = {
  new: { label: "New", color: "var(--muted-foreground)", short: "New" },
  contacted: { label: "Contacted", color: "var(--chart-2)", short: "Contacted" },
  replied: { label: "Replied", color: "var(--chart-4)", short: "Replied" },
  qualified: { label: "Qualified", color: "var(--info)", short: "Qualified" },
  meeting_scheduled: { label: "Meeting Scheduled", color: "var(--chart-1)", short: "Meeting" },
  demo_completed: { label: "Demo Completed", color: "var(--chart-5)", short: "Demo" },
  proposal_sent: { label: "Proposal Sent", color: "var(--warning)", short: "Proposal" },
  customer: { label: "Customer", color: "var(--success)", short: "Customer" },
  closed_lost: { label: "Closed Lost", color: "var(--destructive)", short: "Lost" },
};

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--muted-foreground)" },
  active: { label: "Active", color: "var(--success)" },
  paused: { label: "Paused", color: "var(--warning)" },
  completed: { label: "Completed", color: "var(--info)" },
};

export const COMPANY_STATUS_META: Record<CompanyStatus, { label: string; color: string }> = {
  prospect: { label: "Prospect", color: "var(--muted-foreground)" },
  engaged: { label: "Engaged", color: "var(--chart-2)" },
  opportunity: { label: "Opportunity", color: "var(--chart-1)" },
  customer: { label: "Customer", color: "var(--success)" },
  lost: { label: "Lost", color: "var(--destructive)" },
};

export const SENTIMENT_META: Record<ReplySentiment, { label: string; color: string }> = {
  positive: { label: "Positive", color: "var(--success)" },
  neutral: { label: "Neutral", color: "var(--muted-foreground)" },
  negative: { label: "Negative", color: "var(--destructive)" },
  unclassified: { label: "Unclassified", color: "var(--muted-foreground)" },
};

export const TEMPLATE_CATEGORY_META: Record<TemplateCategory, { label: string }> = {
  initial: { label: "Initial Outreach" },
  follow_up: { label: "Follow-up" },
  breakup: { label: "Breakup" },
  referral: { label: "Referral Request" },
  meeting_confirmation: { label: "Meeting Confirmation" },
  custom: { label: "Custom" },
};

export const MESSAGE_STATUS_META: Record<MessageStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--muted-foreground)" },
  queued: { label: "Queued", color: "var(--chart-2)" },
  scheduled: { label: "Scheduled", color: "var(--chart-2)" },
  pending_approval: { label: "Needs Approval", color: "var(--warning)" },
  sent: { label: "Sent", color: "var(--info)" },
  delivered: { label: "Delivered", color: "var(--success)" },
  bounced: { label: "Bounced", color: "var(--destructive)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  opened: { label: "Opened", color: "var(--chart-1)" },
  replied: { label: "Replied", color: "var(--success)" },
  received: { label: "Received", color: "var(--info)" },
};

export const ACTIVITY_META: Record<ActivityType, { icon: string; color: string }> = {
  email_sent: { icon: "Send", color: "var(--info)" },
  email_scheduled: { icon: "Clock", color: "var(--chart-2)" },
  email_delivered: { icon: "MailCheck", color: "var(--success)" },
  email_bounced: { icon: "MailX", color: "var(--destructive)" },
  reply_received: { icon: "MailOpen", color: "var(--chart-1)" },
  positive_reply: { icon: "ThumbsUp", color: "var(--success)" },
  campaign_created: { icon: "Megaphone", color: "var(--primary)" },
  campaign_paused: { icon: "Pause", color: "var(--warning)" },
  campaign_resumed: { icon: "Play", color: "var(--success)" },
  meeting_booked: { icon: "CalendarCheck", color: "var(--success)" },
  meeting_completed: { icon: "CalendarClock", color: "var(--info)" },
  lead_imported: { icon: "Upload", color: "var(--chart-2)" },
  lead_created: { icon: "UserPlus", color: "var(--chart-2)" },
  template_edited: { icon: "FileText", color: "var(--muted-foreground)" },
  stage_changed: { icon: "GitBranch", color: "var(--chart-1)" },
  note_added: { icon: "StickyNote", color: "var(--muted-foreground)" },
  crawl_completed: { icon: "Globe", color: "var(--info)" },
  user_login: { icon: "LogIn", color: "var(--muted-foreground)" },
};

/* Template variables available to the merge engine */
export const TEMPLATE_VARIABLES = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{industry}}", label: "Industry" },
  { token: "{{website}}", label: "Website" },
  { token: "{{job_title}}", label: "Job title" },
  { token: "{{sender_name}}", label: "Sender name" },
] as const;

export const INDUSTRIES = [
  "Credit Union",
  "Community Bank",
  "Regional Bank",
  "Fintech",
  "Auto Lending",
  "Mortgage",
  "Insurance",
  "Wealth Management",
  "SaaS",
  "Healthcare",
];
