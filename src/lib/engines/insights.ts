/* =========================================================================
 * Learning Center — deterministic statistical insights. NO AI.
 * Turns analytics into ranked, human-readable findings with confidence.
 * ========================================================================= */

import type { DataSnapshot } from "./analytics";
import {
  templateStats,
  subjectStats,
  timeOfDayStats,
  dayOfWeekStats,
  emailLengthStats,
  industryStats,
  campaignStats,
} from "./analytics";
import { wilsonLowerBound, pctChange } from "./stats";
import { formatPercent } from "../utils";

export type InsightKind =
  | "best_template"
  | "best_subject"
  | "best_time"
  | "best_day"
  | "best_length"
  | "best_industry"
  | "best_campaign"
  | "best_followup_delay"
  | "trend";

export interface Insight {
  kind: InsightKind;
  title: string;
  detail: string;
  metric: string;
  confidence: "high" | "medium" | "low";
  sampleSize: number;
}

function confidenceFor(sample: number): Insight["confidence"] {
  if (sample >= 100) return "high";
  if (sample >= 30) return "medium";
  return "low";
}

export function generateInsights(
  d: DataSnapshot,
  companies: { id: string; industry?: string }[],
): Insight[] {
  const insights: Insight[] = [];

  /* Best template by fair (Wilson) positive-reply ranking */
  const templates = templateStats(d)
    .filter((t) => t.sent >= 10)
    .sort((a, b) => b.score - a.score);
  if (templates.length) {
    const best = templates[0];
    const runnerUp = templates[1];
    let detail = `${best.name} leads with a ${formatPercent(best.positiveRate)} positive-reply rate across ${best.sent} sends.`;
    if (runnerUp && runnerUp.positiveRate > 0) {
      const lift = pctChange(runnerUp.positiveRate, best.positiveRate);
      detail += ` It outperforms ${runnerUp.name} by ${formatPercent(lift, 0)}.`;
    }
    insights.push({
      kind: "best_template",
      title: `Best template: ${best.name}`,
      detail,
      metric: formatPercent(best.positiveRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  /* Best subject line */
  const subjects = subjectStats(d)
    .filter((s) => s.sent >= 8)
    .sort((a, b) => wilsonLowerBound(b.replied, b.sent) - wilsonLowerBound(a.replied, a.sent));
  if (subjects.length) {
    const best = subjects[0];
    insights.push({
      kind: "best_subject",
      title: "Highest-replying subject line",
      detail: `"${best.subject}" replies at ${formatPercent(best.replyRate)}${
        best.hasQuestion ? " — questions in subjects tend to lift replies." : "."
      }`,
      metric: formatPercent(best.replyRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  /* Best time of day */
  const times = timeOfDayStats(d).filter((t) => t.sent >= 8);
  if (times.length) {
    const best = [...times].sort((a, b) => b.replyRate - a.replyRate)[0];
    const hour12 = ((best.index + 11) % 12) + 1;
    const ampm = best.index < 12 ? "AM" : "PM";
    insights.push({
      kind: "best_time",
      title: `Best time to send: ${hour12}:00 ${ampm}`,
      detail: `Emails sent around ${hour12}:00 ${ampm} reply at ${formatPercent(best.replyRate)}, the highest of any hour.`,
      metric: formatPercent(best.replyRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  /* Best day of week */
  const days = dayOfWeekStats(d).filter((t) => t.sent >= 8);
  if (days.length) {
    const best = [...days].sort((a, b) => b.replyRate - a.replyRate)[0];
    const full: Record<string, string> = {
      Sun: "Sunday",
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
    };
    insights.push({
      kind: "best_day",
      title: `${full[best.bucket]} has the highest reply rate`,
      detail: `${full[best.bucket]} sends reply at ${formatPercent(best.replyRate)} — schedule your heaviest volume then.`,
      metric: formatPercent(best.replyRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  /* Best email length */
  const lengths = emailLengthStats(d).filter((l) => l.sent >= 8);
  if (lengths.length) {
    const best = [...lengths].sort((a, b) => b.replyRate - a.replyRate)[0];
    insights.push({
      kind: "best_length",
      title: `${best.label} perform best`,
      detail: `Emails in the ${best.label.toLowerCase()} range reply at ${formatPercent(best.replyRate)}. Shorter is usually stronger.`,
      metric: formatPercent(best.replyRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  /* Highest-converting industry */
  const industries = industryStats(d, companies).filter((i) => i.sent >= 8);
  if (industries.length) {
    const best = [...industries].sort((a, b) => b.replyRate - a.replyRate)[0];
    insights.push({
      kind: "best_industry",
      title: `${best.industry} converts best`,
      detail: `${best.industry} prospects reply at ${formatPercent(best.replyRate)} across ${best.sent} sends and account for ${best.customers} customer(s).`,
      metric: formatPercent(best.replyRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  /* Best campaign */
  const camps = campaignStats(d).filter((c) => c.sent >= 8);
  if (camps.length) {
    const best = [...camps].sort((a, b) => b.positiveRate - a.positiveRate)[0];
    insights.push({
      kind: "best_campaign",
      title: `Top campaign: ${best.name}`,
      detail: `${best.name} drives a ${formatPercent(best.positiveRate)} positive-reply rate and ${best.meetings} meeting(s).`,
      metric: formatPercent(best.positiveRate),
      confidence: confidenceFor(best.sent),
      sampleSize: best.sent,
    });
  }

  return insights.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });
}
