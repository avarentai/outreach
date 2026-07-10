/* =========================================================================
 * Analytics engine — deterministic. NO AI.
 * Computes every metric surfaced across the dashboard, analytics, pipeline,
 * deliverability, and reports from the raw domain collections.
 * ========================================================================= */

import type {
  EmailMessage,
  Thread,
  Contact,
  Campaign,
  EmailTemplate,
  Meeting,
  SendingAccount,
  PipelineStage,
} from "../types";
import { PIPELINE_STAGES } from "../types";
import { rate, wilsonLowerBound } from "./stats";
import { isSameDay, daysBetween, wordCount } from "../utils";

export interface DataSnapshot {
  messages: EmailMessage[];
  threads: Thread[];
  contacts: Contact[];
  campaigns: Campaign[];
  templates: EmailTemplate[];
  meetings: Meeting[];
  accounts: SendingAccount[];
}

const OUT = (m: EmailMessage) => m.direction === "outbound";
const SENT_STATES = new Set(["sent", "delivered", "opened", "replied"]);

export function isSent(m: EmailMessage): boolean {
  return OUT(m) && SENT_STATES.has(m.status);
}
export function isDelivered(m: EmailMessage): boolean {
  return OUT(m) && (m.status === "delivered" || m.status === "opened" || m.status === "replied");
}

/* ------------------------------- dashboard -------------------------------- */

export interface DashboardMetrics {
  sentToday: number;
  scheduled: number;
  repliesReceived: number;
  positiveReplies: number;
  meetingsBooked: number;
  campaignsRunning: number;
  bounceRate: number;
  replyRate: number;
  positiveReplyRate: number;
  deliverabilityHealth: number; // 0..100
  followUpsDueToday: number;
  totalSent: number;
  delivered: number;
}

export function dashboardMetrics(d: DataSnapshot, now = new Date()): DashboardMetrics {
  const outbound = d.messages.filter(OUT);
  const sent = outbound.filter(isSent);
  const sentToday = sent.filter((m) => m.sentAt && isSameDay(m.sentAt, now)).length;
  const scheduled = outbound.filter((m) => m.status === "scheduled" || m.status === "queued").length;
  const bounced = outbound.filter((m) => m.status === "bounced").length;
  const delivered = outbound.filter(isDelivered).length;
  const replies = d.threads.filter((t) => t.messageIds.length > 1 || t.sentiment !== "unclassified");
  const repliesReceived = d.messages.filter((m) => m.direction === "inbound").length;
  const positiveReplies = d.threads.filter((t) => t.sentiment === "positive").length;
  const meetingsBooked = d.meetings.filter((m) => m.outcome !== "cancelled").length;
  const campaignsRunning = d.campaigns.filter((c) => c.status === "active").length;

  const totalSent = sent.length;
  const bounceRate = rate(bounced, totalSent + bounced).rate;
  const replyRate = rate(repliesReceived, totalSent).rate;
  const positiveReplyRate = rate(positiveReplies, totalSent).rate;

  const followUpsDueToday = d.contacts.filter(
    (c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt) <= now && !c.bounced && !c.unsubscribed,
  ).length;

  const deliverabilityHealth = deliverabilityScore(d);

  void replies;
  return {
    sentToday,
    scheduled,
    repliesReceived,
    positiveReplies,
    meetingsBooked,
    campaignsRunning,
    bounceRate,
    replyRate,
    positiveReplyRate,
    deliverabilityHealth,
    followUpsDueToday,
    totalSent,
    delivered,
  };
}

/* -------------------------- time-series (charts) -------------------------- */

export interface DayPoint {
  date: string; // ISO day
  label: string;
  sent: number;
  replies: number;
  positive: number;
  meetings: number;
}

export function dailySeries(d: DataSnapshot, days: number, now = new Date()): DayPoint[] {
  const out: DayPoint[] = [];
  const sent = d.messages.filter(isSent);
  const inbound = d.messages.filter((m) => m.direction === "inbound");
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const sameDay = (iso?: string) => iso && isSameDay(iso, day);
    out.push({
      date: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sent: sent.filter((m) => sameDay(m.sentAt)).length,
      replies: inbound.filter((m) => sameDay(m.sentAt ?? m.createdAt)).length,
      positive: d.threads.filter((t) => t.sentiment === "positive" && sameDay(t.lastMessageAt)).length,
      meetings: d.meetings.filter((m) => sameDay(m.createdAt)).length,
    });
  }
  return out;
}

/* ---------------------------- campaign analytics -------------------------- */

export interface CampaignStat {
  campaignId: string;
  name: string;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  positive: number;
  meetings: number;
  customers: number;
  bounced: number;
  bounceRate: number;
  replyRate: number;
  positiveRate: number;
  revenue: number;
}

export function campaignStats(d: DataSnapshot): CampaignStat[] {
  return d.campaigns.map((c) => {
    const msgs = d.messages.filter((m) => m.campaignId === c.id);
    const sent = msgs.filter(isSent).length;
    const delivered = msgs.filter(isDelivered).length;
    const opened = msgs.filter((m) => m.status === "opened" || m.openedAt).length;
    const bounced = msgs.filter((m) => m.status === "bounced").length;
    const threads = d.threads.filter((t) => t.campaignId === c.id);
    const replied = threads.filter((t) => t.messageIds.length > 1).length;
    const positive = threads.filter((t) => t.sentiment === "positive").length;
    const meetings = d.meetings.filter((m) =>
      d.contacts.some((ct) => ct.id === m.contactId && ct.campaignId === c.id),
    ).length;
    const customers = d.contacts.filter((ct) => ct.campaignId === c.id && ct.stage === "customer").length;
    return {
      campaignId: c.id,
      name: c.name,
      sent,
      delivered,
      opened,
      replied,
      positive,
      meetings,
      customers,
      bounced,
      bounceRate: rate(bounced, sent + bounced).rate,
      replyRate: rate(replied, sent).rate,
      positiveRate: rate(positive, sent).rate,
      revenue: customers * 12000,
    };
  });
}

/* ---------------------------- template analytics -------------------------- */

export interface TemplateStat {
  templateId: string;
  name: string;
  category: string;
  sent: number;
  replied: number;
  positive: number;
  meetings: number;
  customers: number;
  replyRate: number;
  positiveRate: number;
  meetingRate: number;
  customerRate: number;
  score: number; // wilson lower bound on positive rate (fair ranking)
  words: number;
}

export function templateStats(d: DataSnapshot): TemplateStat[] {
  return d.templates
    .filter((t) => !t.archived)
    .map((t) => {
      // messages that used this template (attributed by real templateId)
      const used = d.messages.filter((m) => m.templateId === t.id && isSent(m));
      const sent = used.length;
      const threadIds = new Set(used.map((m) => m.threadId));
      const threads = d.threads.filter((th) => threadIds.has(th.id));
      const replied = threads.filter((th) => th.messageIds.length > 1).length;
      const positive = threads.filter((th) => th.sentiment === "positive").length;
      const meetings = threads.filter((th) => th.meetingBooked).length;
      const customers = d.contacts.filter(
        (c) => threads.some((th) => th.contactId === c.id) && c.stage === "customer",
      ).length;
      return {
        templateId: t.id,
        name: t.name,
        category: t.category,
        sent,
        replied,
        positive,
        meetings,
        customers,
        replyRate: rate(replied, sent).rate,
        positiveRate: rate(positive, sent).rate,
        meetingRate: rate(meetings, sent).rate,
        customerRate: rate(customers, sent).rate,
        score: wilsonLowerBound(positive, sent),
        words: wordCount(t.body),
      };
    });
}

/* --------------------------- subject-line analytics ----------------------- */

export interface SubjectStat {
  subject: string;
  sent: number;
  replied: number;
  replyRate: number;
  words: number;
  hasQuestion: boolean;
  hasPersonalization: boolean;
}

export function subjectStats(d: DataSnapshot): SubjectStat[] {
  const bySubject = new Map<string, { sent: number; replied: number }>();
  for (const m of d.messages.filter(isSent)) {
    const key = m.subject.trim();
    if (!key) continue;
    const cur = bySubject.get(key) ?? { sent: 0, replied: 0 };
    cur.sent++;
    if (m.status === "replied" || m.repliedAt) cur.replied++;
    bySubject.set(key, cur);
  }
  return [...bySubject.entries()]
    .map(([subject, v]) => ({
      subject,
      sent: v.sent,
      replied: v.replied,
      replyRate: rate(v.replied, v.sent).rate,
      words: wordCount(subject),
      hasQuestion: subject.includes("?"),
      hasPersonalization: /\{\{|\b(you|your)\b/i.test(subject),
    }))
    .sort((a, b) => b.sent - a.sent);
}

/* ------------------------- time-of-day / day-of-week ---------------------- */

export interface BucketStat {
  bucket: string;
  index: number;
  sent: number;
  replied: number;
  replyRate: number;
}

export function timeOfDayStats(d: DataSnapshot): BucketStat[] {
  const buckets: BucketStat[] = Array.from({ length: 24 }, (_, h) => ({
    bucket: `${h}:00`,
    index: h,
    sent: 0,
    replied: 0,
    replyRate: 0,
  }));
  for (const m of d.messages.filter(isSent)) {
    if (!m.sentAt) continue;
    const h = new Date(m.sentAt).getHours();
    buckets[h].sent++;
    if (m.status === "replied" || m.repliedAt) buckets[h].replied++;
  }
  buckets.forEach((b) => (b.replyRate = rate(b.replied, b.sent).rate));
  return buckets;
}

export function dayOfWeekStats(d: DataSnapshot): BucketStat[] {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const buckets: BucketStat[] = names.map((n, i) => ({
    bucket: n,
    index: i,
    sent: 0,
    replied: 0,
    replyRate: 0,
  }));
  for (const m of d.messages.filter(isSent)) {
    if (!m.sentAt) continue;
    const day = new Date(m.sentAt).getDay();
    buckets[day].sent++;
    if (m.status === "replied" || m.repliedAt) buckets[day].replied++;
  }
  buckets.forEach((b) => (b.replyRate = rate(b.replied, b.sent).rate));
  return buckets;
}

/* ------------------------------- email length ----------------------------- */

export interface LengthBucketStat {
  label: string;
  min: number;
  max: number;
  sent: number;
  replied: number;
  replyRate: number;
}

export function emailLengthStats(d: DataSnapshot): LengthBucketStat[] {
  const ranges: [string, number, number][] = [
    ["< 50 words", 0, 50],
    ["50–100 words", 50, 100],
    ["100–150 words", 100, 150],
    ["150–200 words", 150, 200],
    ["200+ words", 200, Infinity],
  ];
  const buckets: LengthBucketStat[] = ranges.map(([label, min, max]) => ({
    label,
    min,
    max,
    sent: 0,
    replied: 0,
    replyRate: 0,
  }));
  for (const m of d.messages.filter(isSent)) {
    const wc = m.wordCount || wordCount(m.body);
    const b = buckets.find((x) => wc >= x.min && wc < x.max);
    if (!b) continue;
    b.sent++;
    if (m.status === "replied" || m.repliedAt) b.replied++;
  }
  buckets.forEach((b) => (b.replyRate = rate(b.replied, b.sent).rate));
  return buckets;
}

/* ------------------------------ sender analytics -------------------------- */

export interface SenderStat {
  accountId: string;
  label: string;
  sent: number;
  bounced: number;
  replied: number;
  bounceRate: number;
  replyRate: number;
  reputationScore: number;
}

export function senderStats(d: DataSnapshot): SenderStat[] {
  return d.accounts.map((a) => {
    const msgs = d.messages.filter((m) => m.sendingAccountId === a.id);
    const sent = msgs.filter(isSent).length;
    const bounced = msgs.filter((m) => m.status === "bounced").length;
    const replied = msgs.filter((m) => m.status === "replied" || m.repliedAt).length;
    return {
      accountId: a.id,
      label: a.label,
      sent,
      bounced,
      replied,
      bounceRate: rate(bounced, sent + bounced).rate,
      replyRate: rate(replied, sent).rate,
      reputationScore: a.reputationScore,
    };
  });
}

/* ------------------------------ industry analytics ------------------------ */

export interface IndustryStat {
  industry: string;
  contacts: number;
  sent: number;
  replied: number;
  meetings: number;
  customers: number;
  replyRate: number;
  conversionRate: number;
}

export function industryStats(d: DataSnapshot, companies: { id: string; industry?: string }[]): IndustryStat[] {
  const industryOf = new Map(companies.map((c) => [c.id, c.industry ?? "Unknown"]));
  const map = new Map<string, IndustryStat>();
  const ensure = (ind: string) => {
    if (!map.has(ind))
      map.set(ind, {
        industry: ind,
        contacts: 0,
        sent: 0,
        replied: 0,
        meetings: 0,
        customers: 0,
        replyRate: 0,
        conversionRate: 0,
      });
    return map.get(ind)!;
  };
  for (const c of d.contacts) {
    const ind = industryOf.get(c.companyId) ?? "Unknown";
    const s = ensure(ind);
    s.contacts++;
    if (c.stage === "customer") s.customers++;
  }
  for (const m of d.messages.filter(isSent)) {
    const ind = industryOf.get(m.companyId) ?? "Unknown";
    const s = ensure(ind);
    s.sent++;
    if (m.status === "replied" || m.repliedAt) s.replied++;
  }
  for (const m of d.meetings) {
    const ind = industryOf.get(m.companyId) ?? "Unknown";
    ensure(ind).meetings++;
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      replyRate: rate(s.replied, s.sent).rate,
      conversionRate: rate(s.customers, s.contacts).rate,
    }))
    .sort((a, b) => b.contacts - a.contacts);
}

/* ------------------------------- pipeline --------------------------------- */

export interface StageStat {
  stage: PipelineStage;
  count: number;
  avgDaysInStage: number;
  conversionToNext: number;
  dropOff: number;
}

export function pipelineStats(d: DataSnapshot, now = new Date()): StageStat[] {
  const byStage = new Map<PipelineStage, Contact[]>();
  for (const s of PIPELINE_STAGES) byStage.set(s, []);
  for (const c of d.contacts) byStage.get(c.stage)?.push(c);

  return PIPELINE_STAGES.map((stage, i) => {
    const contacts = byStage.get(stage)!;
    const avgDays =
      contacts.length === 0
        ? 0
        : contacts.reduce((acc, c) => acc + daysBetween(c.stageEnteredAt, now), 0) / contacts.length;
    const nextStage = PIPELINE_STAGES[i + 1];
    const nextCount = nextStage ? (byStage.get(nextStage)?.length ?? 0) : 0;
    const conversionToNext = contacts.length ? nextCount / (contacts.length + nextCount) : 0;
    return {
      stage,
      count: contacts.length,
      avgDaysInStage: Math.round(avgDays * 10) / 10,
      conversionToNext,
      dropOff: 1 - conversionToNext,
    };
  });
}

/* --------------------------------- funnel --------------------------------- */

export interface FunnelStep {
  label: string;
  value: number;
  rate: number; // relative to top of funnel
}

export function funnel(d: DataSnapshot): FunnelStep[] {
  const contacts = d.contacts.length;
  const sent = d.messages.filter(isSent).length;
  const delivered = d.messages.filter(isDelivered).length;
  const replied = d.threads.filter((t) => t.messageIds.length > 1).length;
  const positive = d.threads.filter((t) => t.sentiment === "positive").length;
  const meetings = d.meetings.length;
  const customers = d.contacts.filter((c) => c.stage === "customer").length;
  const top = contacts || 1;
  const steps: [string, number][] = [
    ["Leads", contacts],
    ["Emails Sent", sent],
    ["Delivered", delivered],
    ["Replied", replied],
    ["Positive", positive],
    ["Meetings", meetings],
    ["Customers", customers],
  ];
  return steps.map(([label, value]) => ({ label, value, rate: value / top }));
}

/* ----------------------------- deliverability ----------------------------- */

export function deliverabilityScore(d: DataSnapshot): number {
  const sent = d.messages.filter(isSent).length;
  const bounced = d.messages.filter((m) => m.direction === "outbound" && m.status === "bounced").length;
  const bounceRate = rate(bounced, sent + bounced).rate;
  const authScore =
    d.accounts.reduce((acc, a) => {
      let s = 0;
      if (a.spf === "pass") s += 1;
      if (a.dkim === "pass") s += 1;
      if (a.dmarc === "pass") s += 1;
      return acc + s / 3;
    }, 0) / (d.accounts.length || 1);
  const repAvg = d.accounts.reduce((a, x) => a + x.reputationScore, 0) / (d.accounts.length || 1);
  // Weighted blend: 40% bounce (inverted), 30% auth, 30% reputation.
  const bounceComponent = (1 - Math.min(bounceRate / 0.05, 1)) * 40;
  const authComponent = authScore * 30;
  const repComponent = (repAvg / 100) * 30;
  return Math.round(bounceComponent + authComponent + repComponent);
}
