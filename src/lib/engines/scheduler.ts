/* =========================================================================
 * Sending scheduler — deterministic. NO AI.
 * Computes business-hour send times, natural spread, daily-limit throttling,
 * and sequence step due-dates. Deterministic given a seed (so previews are
 * stable and reproducible).
 * ========================================================================= */

import type { SendingWindow, Sequence, SequenceStep } from "../types";

/** Deterministic PRNG (mulberry32) so schedules are reproducible per seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isWithinWindow(d: Date, w: SendingWindow): boolean {
  const day = d.getDay();
  const hour = d.getHours();
  return w.daysOfWeek.includes(day) && hour >= w.startHour && hour < w.endHour;
}

/** Advance a date to the next valid business-hour slot inside the window. */
export function nextBusinessSlot(from: Date, w: SendingWindow): Date {
  const d = new Date(from);
  // step in 15-minute increments up to 2 weeks ahead
  for (let i = 0; i < 4 * 24 * 14; i++) {
    if (isWithinWindow(d, w)) return d;
    d.setMinutes(d.getMinutes() + 15);
    if (d.getHours() >= w.endHour || !w.daysOfWeek.includes(d.getDay())) {
      // jump to start hour next day
      d.setDate(d.getDate() + 1);
      d.setHours(w.startHour, 0, 0, 0);
    }
  }
  return d;
}

export interface PlannedSend {
  index: number;
  scheduledAt: string;
  accountId: string;
}

/**
 * Plan a batch of sends across accounts respecting daily limits, minimum gap,
 * and natural jitter. Spreads sends across the window instead of bursting.
 */
export function planSends(
  count: number,
  accountIds: string[],
  window: SendingWindow,
  startFrom: Date,
  seed = 1,
): PlannedSend[] {
  const rng = seededRandom(seed);
  const plans: PlannedSend[] = [];
  const perAccountToday = new Map<string, number>();
  let cursor = nextBusinessSlot(startFrom, window);
  const accounts = accountIds.length ? accountIds : ["default"];

  for (let i = 0; i < count; i++) {
    const account = accounts[i % accounts.length];
    const key = `${account}:${cursor.toDateString()}`;
    const used = perAccountToday.get(key) ?? 0;

    if (used >= window.dailyLimitPerAccount && i % accounts.length === accounts.length - 1) {
      // all accounts hit their daily cap — advance to next business day
      cursor = nextBusinessSlot(
        new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, window.startHour),
        window,
      );
    }

    const gapMin =
      window.minMinutesBetweenSends + Math.floor(rng() * (window.jitterMinutes + 1));
    cursor = nextBusinessSlot(new Date(cursor.getTime() + gapMin * 60000), window);

    perAccountToday.set(key, used + 1);
    plans.push({ index: i, scheduledAt: cursor.toISOString(), accountId: account });
  }
  return plans;
}

/** Total calendar days a sequence spans (sum of waits). */
export function sequenceDurationDays(seq: Sequence): number {
  return seq.steps.reduce((acc, s) => acc + (s.waitDays ?? 0) + (s.waitHours ?? 0) / 24, 0);
}

export interface StepSchedule {
  step: SequenceStep;
  index: number;
  dueAt: string;
}

/** Given an enrollment start, compute the due date of each email step. */
export function scheduleSequence(seq: Sequence, enrolledAt: Date, window?: SendingWindow): StepSchedule[] {
  const out: StepSchedule[] = [];
  let cursor = new Date(enrolledAt);
  seq.steps.forEach((step, index) => {
    if (step.type === "wait") {
      cursor = new Date(
        cursor.getTime() + (step.waitDays ?? 0) * 86400000 + (step.waitHours ?? 0) * 3600000,
      );
      return;
    }
    if (step.type === "email") {
      const due = window ? nextBusinessSlot(cursor, window) : cursor;
      out.push({ step, index, dueAt: due.toISOString() });
    }
  });
  return out;
}

export const DEFAULT_SENDING_WINDOW: SendingWindow = {
  timezone: "America/Toronto",
  daysOfWeek: [1, 2, 3, 4, 5],
  startHour: 8,
  endHour: 17,
  dailyLimitPerAccount: 50,
  minMinutesBetweenSends: 6,
  jitterMinutes: 9,
};
