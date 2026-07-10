import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------- formatting ------------------------------- */

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return part / total;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/* ---------------------------------- dates --------------------------------- */

export function relativeTime(iso?: string, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = then - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const fmt = (v: number, unit: string) => `${v} ${unit}${v === 1 ? "" : "s"}`;
  let label: string;
  if (abs < 60000) label = "just now";
  else if (mins < 60) label = fmt(mins, "min");
  else if (hours < 24) label = fmt(hours, "hour");
  else if (days < 30) label = fmt(days, "day");
  else if (days < 365) label = fmt(Math.round(days / 30), "month");
  else label = fmt(Math.round(days / 365), "year");
  if (label === "just now") return label;
  return diff < 0 ? `${label} ago` : `in ${label}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function addDays(d: string | Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/* --------------------------------- strings -------------------------------- */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function wordCount(s: string): number {
  const stripped = s.replace(/<[^>]*>/g, " ").replace(/\{\{[^}]+\}\}/g, "word");
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/* deterministic hue from a string (for avatars / chips) */
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function avatarColor(seed: string): string {
  return `oklch(0.62 0.15 ${hueFromString(seed)})`;
}
