/* =========================================================================
 * Deterministic reply classifier — NO AI (the default path).
 * Keyword/heuristic scoring of inbound replies into a sentiment + intent.
 * This is what runs by default; the optional AI adapter (lib/ai) can be
 * enabled to override low-confidence cases only.
 * ========================================================================= */

import type { ReplySentiment } from "../types";

export type ReplyIntent =
  | "interested"
  | "meeting_request"
  | "referral"
  | "not_interested"
  | "unsubscribe"
  | "out_of_office"
  | "question"
  | "neutral";

export interface Classification {
  sentiment: ReplySentiment;
  intent: ReplyIntent;
  confidence: number; // 0..1
  matched: string[]; // signals that fired (explainable)
}

const SIGNALS: { intent: ReplyIntent; sentiment: ReplySentiment; weight: number; patterns: RegExp[] }[] = [
  {
    intent: "meeting_request",
    sentiment: "positive",
    weight: 3,
    patterns: [/\b(book|schedule|set up|find (a )?time|calendar|call|demo|meet(ing)?)\b/i, /\bnext week\b/i, /\bavailab(le|ility)\b/i],
  },
  {
    intent: "interested",
    sentiment: "positive",
    weight: 2.5,
    patterns: [/\b(interested|sounds good|tell me more|learn more|keen|let'?s (talk|chat)|timely|worth a)\b/i, /\bhappy to\b/i, /\byes\b/i],
  },
  {
    intent: "referral",
    sentiment: "neutral",
    weight: 2,
    patterns: [/\b(right person|reach out to|loop in|forward(ed)? (this )?to|colleague|the person who|owns)\b/i],
  },
  {
    intent: "question",
    sentiment: "neutral",
    weight: 1.5,
    patterns: [/\?\s*$/m, /\b(how|what|can you|could you|pricing|cost|how much)\b/i],
  },
  {
    intent: "not_interested",
    sentiment: "negative",
    weight: 3,
    patterns: [/\b(not interested|no thanks|no thank you|not (a )?(good )?(fit|time)|already (have|use)|pass|not looking|not right now|remove me)\b/i],
  },
  {
    intent: "unsubscribe",
    sentiment: "negative",
    weight: 4,
    patterns: [/\b(unsubscribe|opt.?out|stop (emailing|contacting)|take me off|do not (email|contact))\b/i],
  },
  {
    intent: "out_of_office",
    sentiment: "unclassified",
    weight: 5,
    patterns: [/\b(out of (the )?office|ooo|on (vacation|leave|pto)|away until|automatic reply|auto.?reply)\b/i],
  },
];

/** Classify an inbound reply deterministically. */
export function classifyReply(body: string, subject = ""): Classification {
  const text = `${subject}\n${body}`;
  const matched: string[] = [];
  const scores = new Map<ReplyIntent, number>();
  const sentimentVote = { positive: 0, negative: 0, neutral: 0 };

  for (const sig of SIGNALS) {
    let hits = 0;
    for (const p of sig.patterns) {
      if (p.test(text)) {
        hits++;
        matched.push(sig.intent);
      }
    }
    if (hits > 0) {
      scores.set(sig.intent, (scores.get(sig.intent) ?? 0) + hits * sig.weight);
      if (sig.sentiment === "positive") sentimentVote.positive += hits * sig.weight;
      else if (sig.sentiment === "negative") sentimentVote.negative += hits * sig.weight;
      else if (sig.sentiment === "neutral") sentimentVote.neutral += hits * sig.weight;
    }
  }

  // pick top intent
  let intent: ReplyIntent = "neutral";
  let top = 0;
  for (const [i, s] of scores) if (s > top) ((top = s), (intent = i));

  // OOO overrides everything
  if (scores.has("out_of_office")) {
    return { sentiment: "unclassified", intent: "out_of_office", confidence: 0.9, matched: [...new Set(matched)] };
  }

  let sentiment: ReplySentiment;
  const { positive, negative, neutral } = sentimentVote;
  const total = positive + negative + neutral;
  if (total === 0) {
    sentiment = "neutral";
  } else if (negative > positive) {
    sentiment = "negative";
  } else if (positive > negative) {
    sentiment = "positive";
  } else {
    sentiment = "neutral";
  }

  const confidence = total === 0 ? 0.3 : Math.min(0.95, 0.4 + top / (total + 4));
  return { sentiment, intent, confidence, matched: [...new Set(matched)] };
}

/** Should the (optional) AI classifier be consulted? Only for low confidence. */
export function shouldEscalateToAI(c: Classification): boolean {
  return c.confidence < 0.5 && c.intent !== "out_of_office";
}
