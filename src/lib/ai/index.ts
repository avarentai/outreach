/* =========================================================================
 * OPTIONAL AI adapter — OFF BY DEFAULT.
 * Per Avarent's philosophy, nearly all functionality is deterministic.
 * AI is used ONLY where it has clear ROI and is explicitly enabled:
 *   1. Reply classification for LOW-CONFIDENCE cases (the deterministic
 *      classifier in engines/classify.ts handles everything else).
 *   2. Draft/personalization writing assistance (never auto-sends).
 * If AI_ENABLED !== "true" or no key is set, every function falls back to
 * deterministic behavior. This module is server-only.
 * ========================================================================= */

import type { ReplySentiment } from "../types";
import { classifyReply, type Classification } from "../engines/classify";

export function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

const MODEL = "claude-haiku-4-5-20251001"; // cheapest capable model — cost-conscious by design

/**
 * Classify a reply. Deterministic first; only escalates to the model when
 * the deterministic classifier is unsure AND AI is enabled. This keeps AI
 * spend to a tiny fraction of replies.
 */
export async function classifyReplyMaybeAI(body: string, subject = ""): Promise<Classification & { usedAI: boolean }> {
  const deterministic = classifyReply(body, subject);
  if (!isAiEnabled() || deterministic.confidence >= 0.5) {
    return { ...deterministic, usedAI: false };
  }
  try {
    const text = await callClaude(
      `Classify this sales email reply. Respond with ONLY one word from: positive, negative, neutral.\n\nSubject: ${subject}\nReply: ${body}`,
      8,
    );
    const word = text.trim().toLowerCase();
    const sentiment: ReplySentiment =
      word.includes("positive") ? "positive" : word.includes("negative") ? "negative" : "neutral";
    return { ...deterministic, sentiment, confidence: 0.85, usedAI: true };
  } catch {
    return { ...deterministic, usedAI: false };
  }
}

/**
 * Writing assistance: rewrite/personalize a draft. Returns the ORIGINAL text
 * unchanged when AI is disabled — assistance is opt-in and never blocks sends.
 */
export async function assistDraft(
  draft: string,
  instruction: string,
  context?: { firstName?: string; company?: string; industry?: string },
): Promise<{ text: string; usedAI: boolean }> {
  if (!isAiEnabled()) return { text: draft, usedAI: false };
  try {
    const ctx = context
      ? `Recipient: ${context.firstName ?? ""} at ${context.company ?? ""} (${context.industry ?? ""}).`
      : "";
    const text = await callClaude(
      `You are a sales copy editor. ${instruction}\n${ctx}\nReturn only the revised email body, no preamble.\n\n---\n${draft}`,
      600,
    );
    return { text: text.trim() || draft, usedAI: true };
  } catch {
    return { text: draft, usedAI: false };
  }
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}
