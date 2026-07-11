/* =========================================================================
 * Avarent Outbound — domain model
 * The single source of truth for every entity in the sales OS.
 * Mirrors the Supabase schema in /supabase/migrations.
 * ========================================================================= */

export type ID = string;
export type ISODate = string; // ISO-8601 timestamp

/* ----------------------------- Auth & workspace ----------------------------- */

export type UserRole = "owner" | "admin" | "member" | "viewer";

export interface User {
  id: ID;
  name: string;
  email: string;
  role: UserRole;
  avatarColor: string; // deterministic accent for avatar
  initials: string;
  title?: string;
  createdAt: ISODate;
  lastActiveAt?: ISODate;
}

export interface Workspace {
  id: ID;
  name: string;
  domain: string;
  timezone: string; // IANA, e.g. "America/Toronto"
  createdAt: ISODate;
}

/* ------------------------------- Companies -------------------------------- */

export type CompanyStatus = "prospect" | "engaged" | "opportunity" | "customer" | "lost";

export interface TechDetection {
  name: string;
  category: string;
  confidence: number; // 0..1 from deterministic signature match
}

export interface CompanyEnrichment {
  contactPageUrl?: string;
  aboutPageUrl?: string;
  careersPageUrl?: string;
  teamPageUrl?: string;
  products?: string[];
  hq?: string;
  employeeEstimate?: string; // e.g. "51-200"
  techStack?: TechDetection[];
  socialLinks?: { platform: string; url: string }[];
  domainAgeYears?: number;
  discoveredEmails?: string[];
  lastCrawledAt?: ISODate;
  crawlStatus?: "never" | "queued" | "crawling" | "done" | "error";
}

export interface Company {
  id: ID;
  name: string;
  domain: string; // normalized bare domain, unique key
  website?: string;
  industry?: string;
  status: CompanyStatus;
  notes?: string;
  tags: string[];
  ownerId?: ID;
  enrichment: CompanyEnrichment;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ----------------------------- Contacts / Leads ---------------------------- */

export type PipelineStage =
  | "new"
  | "contacted"
  | "replied"
  | "qualified"
  | "meeting_scheduled"
  | "demo_completed"
  | "proposal_sent"
  | "customer"
  | "closed_lost";

export const PIPELINE_STAGES: PipelineStage[] = [
  "new",
  "contacted",
  "replied",
  "qualified",
  "meeting_scheduled",
  "demo_completed",
  "proposal_sent",
  "customer",
  "closed_lost",
];

export type EmailValidity = "valid" | "risky" | "invalid" | "unknown";

export type LinkedInStatus =
  | "none"
  | "not_connected"
  | "request_sent"
  | "connected"
  | "messaged"
  | "replied";

export interface Contact {
  id: ID;
  companyId: ID;
  firstName: string;
  lastName: string;
  email: string;
  emailValidity: EmailValidity;
  jobTitle?: string;
  linkedinUrl?: string;
  phone?: string;
  stage: PipelineStage;
  stageEnteredAt: ISODate;
  ownerId?: ID;
  campaignId?: ID;
  tags: string[];
  score: number; // opportunity score 0..100 (deterministic)
  scoreBreakdown?: ScoreComponent[];
  lastContactedAt?: ISODate;
  nextFollowUpAt?: ISODate;
  linkedinStatus: LinkedInStatus;
  linkedinNotes?: string;
  unsubscribed: boolean;
  bounced: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ScoreComponent {
  rule: string;
  points: number;
  reason: string;
}

/* ------------------------------- Templates -------------------------------- */

export type TemplateCategory =
  | "initial"
  | "follow_up"
  | "breakup"
  | "referral"
  | "meeting_confirmation"
  | "custom";

export interface EmailTemplate {
  id: ID;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string; // supports {{variables}} and /snippets
  ownerId?: ID;
  tags: string[];
  archived: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  version: number;
}

export interface Snippet {
  id: ID;
  trigger: string; // e.g. "/demo"
  label: string;
  content: string;
}

/* ------------------------------- Sequences -------------------------------- */

export type SequenceStepType = "email" | "wait" | "condition" | "manual_task";

export type StopCondition = "on_reply" | "on_meeting_booked" | "on_click" | "never";

export interface SequenceStep {
  id: ID;
  type: SequenceStepType;
  // email
  templateId?: ID;
  subjectOverride?: string;
  // wait
  waitDays?: number;
  waitHours?: number;
  // condition
  stopOn?: StopCondition;
  // manual task
  taskLabel?: string;
}

export interface Sequence {
  id: ID;
  name: string;
  steps: SequenceStep[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ------------------------------- Campaigns -------------------------------- */

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface SendingWindow {
  // Business-hour sending config
  timezone: string;
  daysOfWeek: number[]; // 0=Sun .. 6=Sat
  startHour: number; // 0..23
  endHour: number; // 0..23
  dailyLimitPerAccount: number;
  minMinutesBetweenSends: number;
  jitterMinutes: number; // random spread to look natural
}

export interface Campaign {
  id: ID;
  name: string;
  ownerId: ID;
  status: CampaignStatus;
  sequenceId: ID;
  sendingAccountIds: ID[];
  contactIds: ID[];
  sendingWindow: SendingWindow;
  stopOnReply: boolean;
  requireApproval: boolean; // manual review before send
  createdAt: ISODate;
  updatedAt: ISODate;
  startedAt?: ISODate;
}

/* ---------------------------- Sending accounts ---------------------------- */

export type SendingProvider = "resend" | "smtp";

export interface SendingAccount {
  id: ID;
  label: string;
  fromName: string;
  fromEmail: string;
  provider: SendingProvider;
  dailyLimit: number;
  warmupEnabled: boolean;
  // auth status (deterministic DNS checks)
  spf: "pass" | "fail" | "unknown";
  dkim: "pass" | "fail" | "unknown";
  dmarc: "pass" | "fail" | "unknown";
  reputationScore: number; // 0..100
  active: boolean;
  createdAt: ISODate;
}

/* ------------------------------- Email / Inbox ---------------------------- */

export type MessageDirection = "outbound" | "inbound";

export type MessageStatus =
  | "draft"
  | "queued"
  | "scheduled"
  | "pending_approval"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "opened"
  | "replied"
  | "received";

export interface EmailMessage {
  id: ID;
  threadId: ID;
  contactId: ID;
  companyId: ID;
  campaignId?: ID;
  sequenceStepId?: ID;
  templateId?: ID;
  sendingAccountId?: ID;
  direction: MessageDirection;
  status: MessageStatus;
  subject: string;
  body: string;
  fromEmail: string;
  toEmail: string;
  scheduledAt?: ISODate;
  sentAt?: ISODate;
  openedAt?: ISODate;
  clickedAt?: ISODate;
  repliedAt?: ISODate;
  bounceReason?: string;
  providerMessageId?: string;
  wordCount: number;
  abVariant?: string; // variant key when part of an experiment
  attempts?: number;
  createdAt: ISODate;
}

export type ReplySentiment = "positive" | "neutral" | "negative" | "unclassified";

export type ThreadState = "open" | "snoozed" | "archived";

export interface Thread {
  id: ID;
  contactId: ID;
  companyId: ID;
  campaignId?: ID;
  subject: string;
  ownerId?: ID;
  state: ThreadState;
  sentiment: ReplySentiment;
  interested?: boolean;
  meetingBooked: boolean;
  snoozedUntil?: ISODate;
  lastMessageAt: ISODate;
  unread: boolean;
  messageIds: ID[];
  createdAt: ISODate;
}

export interface InternalComment {
  id: ID;
  entityType: "thread" | "company" | "contact" | "meeting";
  entityId: ID;
  authorId: ID;
  body: string;
  createdAt: ISODate;
}

/* -------------------------------- Meetings -------------------------------- */

export type MeetingOutcome = "scheduled" | "completed" | "no_show" | "cancelled" | "won" | "lost";

export interface Meeting {
  id: ID;
  companyId: ID;
  contactId: ID;
  title: string;
  scheduledAt: ISODate;
  durationMinutes: number;
  attendees: string[];
  agenda?: string;
  notes?: string;
  outcome: MeetingOutcome;
  nextAction?: string;
  ownerId?: ID;
  createdAt: ISODate;
}

/* --------------------------- Notes & attachments -------------------------- */

export type AttachmentKind = "pdf" | "deck" | "one_pager" | "contract" | "meeting_notes" | "other";

export interface Attachment {
  id: ID;
  companyId: ID;
  name: string;
  kind: AttachmentKind;
  sizeBytes: number;
  url: string;
  uploadedById: ID;
  createdAt: ISODate;
}

export interface Note {
  id: ID;
  companyId: ID;
  authorId: ID;
  body: string; // rich text (markdown)
  pinned: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ------------------------------- Activity --------------------------------- */

export type ActivityType =
  | "email_sent"
  | "email_scheduled"
  | "email_delivered"
  | "email_bounced"
  | "reply_received"
  | "positive_reply"
  | "campaign_created"
  | "campaign_paused"
  | "campaign_resumed"
  | "meeting_booked"
  | "meeting_completed"
  | "lead_imported"
  | "lead_created"
  | "template_edited"
  | "stage_changed"
  | "note_added"
  | "crawl_completed"
  | "user_login";

export interface Activity {
  id: ID;
  type: ActivityType;
  actorId?: ID;
  companyId?: ID;
  contactId?: ID;
  campaignId?: ID;
  summary: string;
  meta?: Record<string, string | number | boolean>;
  createdAt: ISODate;
}

/* ------------------------------- Follow-ups ------------------------------- */

export type FollowUpStatus = "due" | "approved" | "skipped" | "sent";

export interface FollowUpTask {
  id: ID;
  contactId: ID;
  companyId: ID;
  campaignId?: ID;
  templateId?: ID;
  dueAt: ISODate;
  status: FollowUpStatus;
  draftSubject: string;
  draftBody: string;
  reason: string; // why this follow-up is due (deterministic)
}

/* ---------------------------- Opportunity scoring ------------------------- */

export type ScoringField =
  | "industry"
  | "employeeEstimate"
  | "aiAdoption"
  | "lendingRelevance"
  | "previousEngagement"
  | "emailValidity"
  | "hasLinkedin"
  | "techStack";

export type ScoringOperator = "equals" | "in" | "gte" | "lte" | "exists" | "contains";

export interface ScoringRule {
  id: ID;
  label: string;
  field: ScoringField;
  operator: ScoringOperator;
  value: string; // comparison target (comma-separated for `in`)
  points: number; // may be negative
  enabled: boolean;
}

export interface ScoringConfig {
  rules: ScoringRule[];
  maxScore: number;
}

/* ------------------------------ A/B testing ------------------------------- */

export type ExperimentDimension =
  | "subject"
  | "body"
  | "cta"
  | "signature"
  | "follow_up_timing"
  | "email_length";

export type ExperimentStatus = "running" | "concluded" | "inconclusive";

export interface ExperimentVariant {
  key: string; // "A", "B", ...
  label: string;
  sent: number;
  replied: number;
  positive: number;
  meetings: number;
}

export interface Experiment {
  id: ID;
  name: string;
  dimension: ExperimentDimension;
  status: ExperimentStatus;
  campaignId?: ID;
  variants: ExperimentVariant[];
  winnerKey?: string;
  confidence?: number; // 0..1
  minSamplePerVariant: number;
  createdAt: ISODate;
}

/* ------------------------------ Saved views ------------------------------- */

export type FilterOperator =
  | "eq"
  | "neq"
  | "in"
  | "contains"
  | "gte"
  | "lte"
  | "before"
  | "after"
  | "is_empty"
  | "not_empty";

export interface FilterClause {
  field: string;
  operator: FilterOperator;
  value: string | number | string[];
}

export interface SavedView {
  id: ID;
  name: string;
  entity: "contacts" | "companies" | "threads" | "meetings";
  filters: FilterClause[];
  sort?: { field: string; dir: "asc" | "desc" };
  system: boolean; // built-in vs user-created
  icon?: string;
}

/* ------------------------------- Crawler ---------------------------------- */

export interface CrawlPage {
  url: string;
  title?: string;
  type: "home" | "about" | "contact" | "careers" | "team" | "product" | "other";
  emails: string[];
  status: number;
}

export interface CrawlResult {
  id: ID;
  companyId: ID;
  domain: string;
  startedAt: ISODate;
  finishedAt?: ISODate;
  status: "queued" | "crawling" | "done" | "error";
  pagesCrawled: number;
  pages: CrawlPage[];
  emailsFound: string[];
  socialLinks: { platform: string; url: string }[];
  techStack: TechDetection[];
  error?: string;
}

/* --------------------------------- Tags ----------------------------------- */

export interface Tag {
  id: ID;
  label: string;
  color: string;
}
