"use client";

import * as React from "react";
import Link from "next/link";
import { cn, formatPercent } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/charts";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

/* ------------------------------- PageHeader ------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <Icon className="size-4.5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------- StatCard -------------------------------- */

export function StatCard({
  label,
  value,
  sublabel,
  delta,
  trend,
  icon: Icon,
  accent = "var(--primary)",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  delta?: number; // fraction change vs previous period
  trend?: number[];
  icon?: LucideIcon;
  accent?: string;
  href?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  const inner = (
    <Card className="group relative overflow-hidden p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {Icon && <Icon className="size-3.5" style={{ color: accent }} />}
            {label}
          </div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{value}</div>
          {sublabel && <div className="mt-0.5 text-xs text-muted-foreground">{sublabel}</div>}
        </div>
        {trend && trend.length > 1 && <Sparkline data={trend} color={accent} width={72} height={34} />}
      </div>
      {delta !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatPercent(Math.abs(delta), 0)}
          </span>
          <span className="text-muted-foreground">vs last week</span>
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* ------------------------------ Section title ----------------------------- */

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------- Stat pill -------------------------------- */

export function MiniStat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
