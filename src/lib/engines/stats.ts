/* =========================================================================
 * Deterministic statistics engine — NO AI.
 * Powers analytics rates, A/B significance, and learning-center insights.
 * ========================================================================= */

export interface RateResult {
  count: number;
  total: number;
  rate: number; // 0..1
}

export function rate(count: number, total: number): RateResult {
  return { count, total, rate: total > 0 ? count / total : 0 };
}

/* Standard normal CDF via Abramowitz & Stegun 7.1.26 approximation. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export interface TwoProportionTest {
  z: number;
  pValue: number; // two-tailed
  confidence: number; // 1 - pValue
  significant: boolean; // at alpha
  lift: number; // relative lift of b over a
  rateA: number;
  rateB: number;
  enoughData: boolean;
}

/**
 * Two-proportion z-test. Compares conversion of variant A vs variant B.
 * `alpha` default 0.05 (95% confidence). `minSample` guards tiny samples.
 */
export function twoProportionTest(
  successA: number,
  totalA: number,
  successB: number,
  totalB: number,
  alpha = 0.05,
  minSample = 30,
): TwoProportionTest {
  const pA = totalA > 0 ? successA / totalA : 0;
  const pB = totalB > 0 ? successB / totalB : 0;
  const pooled = totalA + totalB > 0 ? (successA + successB) / (totalA + totalB) : 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / (totalA || 1) + 1 / (totalB || 1)));
  const z = se > 0 ? (pB - pA) / se : 0;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const enoughData = totalA >= minSample && totalB >= minSample;
  return {
    z,
    pValue,
    confidence: 1 - pValue,
    significant: enoughData && pValue < alpha,
    lift: pA > 0 ? (pB - pA) / pA : pB > 0 ? Infinity : 0,
    rateA: pA,
    rateB: pB,
    enoughData,
  };
}

/**
 * Wilson score lower bound — a robust way to rank items by a rate while
 * penalizing small samples. Used to pick "best performing" items fairly.
 */
export function wilsonLowerBound(success: number, total: number, z = 1.96): number {
  if (total === 0) return 0;
  const p = success / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return (centre - margin) / denom;
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Simple linear regression slope (trend direction) over evenly spaced points. */
export function trendSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Percentage change from a to b, guarded against zero. */
export function pctChange(a: number, b: number): number {
  if (a === 0) return b === 0 ? 0 : 1;
  return (b - a) / a;
}
