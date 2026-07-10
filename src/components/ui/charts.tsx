"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* =========================================================================
 * Lightweight, dependency-free SVG charts. Themed via CSS variables.
 * ========================================================================= */

/* ------------------------------- Sparkline -------------------------------- */

export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--primary)",
  fill = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
}) {
  const gid = React.useId();
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------- Area chart ------------------------------- */

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export function AreaChart({
  labels,
  series,
  height = 240,
  className,
  yFormat = (n) => String(n),
}: {
  labels: string[];
  series: Series[];
  height?: number;
  className?: string;
  yFormat?: (n: number) => string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const width = 720;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(...allValues, 1);
  const n = labels.length;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const gid = React.useId();

  const gridLines = 4;

  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
          const rx = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((rx - padL) / plotW) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, idx)));
        }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {/* grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = padT + (i / gridLines) * plotH;
          const val = max - (i / gridLines) * max;
          return (
            <g key={i}>
              <line x1={padL} y1={gy} x2={width - padR} y2={gy} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
              <text x={padL - 6} y={gy + 3} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                {yFormat(Math.round(val))}
              </text>
            </g>
          );
        })}
        {/* series */}
        {series.map((s) => {
          const line = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
          const area = `${line} L${x(n - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`;
          return (
            <g key={s.key}>
              <path d={area} fill={`url(#${gid}-${s.key})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {/* x labels */}
        {labels.map((l, i) =>
          i % Math.ceil(n / 8) === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {l}
            </text>
          ) : null,
        )}
        {/* hover */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + plotH} stroke="var(--muted-foreground)" strokeWidth={1} strokeOpacity={0.4} />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={3.5} fill="var(--card)" stroke={s.color} strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(x(hover) / width) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="mb-1 font-medium">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 tabular">
              <span className="size-1.5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto font-medium">{s.values[hover]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Bar chart ------------------------------- */

export function BarChart({
  data,
  height = 200,
  color = "var(--primary)",
  valueFormat = (n) => String(n),
  className,
  horizontal = false,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  color?: string;
  valueFormat?: (n: number) => string;
  className?: string;
  horizontal?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (horizontal) {
    return (
      <div className={cn("space-y-2.5", className)}>
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={d.label}>
              {d.label}
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? color }}
              />
            </div>
            <div className="w-12 shrink-0 text-right text-xs font-medium tabular">
              {valueFormat(d.value)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("flex items-end gap-1.5", className)} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="group relative w-full rounded-t-md transition-all duration-500 hover:opacity-80"
              style={{ height: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? color, minHeight: d.value > 0 ? 2 : 0 }}
              title={`${d.label}: ${valueFormat(d.value)}`}
            />
          </div>
          <span className="truncate text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- Donut --------------------------------- */

export function Donut({
  segments,
  size = 160,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="space-y-1.5">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto font-medium tabular">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Progress ring ----------------------------- */

export function ProgressRing({
  value,
  size = 72,
  thickness = 7,
  color = "var(--primary)",
  label,
}: {
  value: number; // 0..100
  size?: number;
  thickness?: number;
  color?: string;
  label?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular">
        {label ?? `${Math.round(value)}`}
      </div>
    </div>
  );
}

/* --------------------------------- Funnel --------------------------------- */

export function Funnel({
  steps,
  className,
}: {
  steps: { label: string; value: number; rate: number }[];
  className?: string;
}) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--success)"];
  return (
    <div className={cn("space-y-1.5", className)}>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">{s.label}</div>
          <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="flex h-full items-center rounded-md px-2.5 text-xs font-semibold text-white transition-all duration-500"
              style={{ width: `${Math.max((s.value / max) * 100, 6)}%`, backgroundColor: colors[i % colors.length] }}
            >
              {s.value}
            </div>
          </div>
          <div className="w-12 shrink-0 text-right text-xs font-medium tabular text-muted-foreground">
            {(s.rate * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Heatmap --------------------------------- */

export function Heatmap({
  rows,
  cols,
  values,
  colorFor,
  className,
}: {
  rows: string[];
  cols: string[];
  values: number[][]; // [row][col]
  colorFor: (v: number, max: number) => string;
  className?: string;
}) {
  const max = Math.max(...values.flat(), 0.0001);
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
        <div />
        {cols.map((c) => (
          <div key={c} className="px-1 text-center text-[9px] text-muted-foreground">{c}</div>
        ))}
        {rows.map((r, ri) => (
          <React.Fragment key={r}>
            <div className="pr-2 text-right text-[10px] text-muted-foreground leading-6">{r}</div>
            {cols.map((_, ci) => (
              <div
                key={ci}
                className="aspect-square min-w-4 rounded-[3px]"
                style={{ backgroundColor: colorFor(values[ri]?.[ci] ?? 0, max) }}
                title={`${r} · ${cols[ci]}: ${(values[ri]?.[ci] ?? 0).toFixed(0)}`}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
