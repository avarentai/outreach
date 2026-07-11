"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { twoProportionTest } from "@/lib/engines/stats";
import type {
  Experiment,
  ExperimentVariant,
  ExperimentDimension,
} from "@/lib/types";
import { PageHeader, StatCard, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Input, Label, Select } from "@/components/ui/input";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { AreaChart } from "@/components/ui/charts";
import { formatPercent, formatNumber, cn } from "@/lib/utils";
import {
  FlaskConical,
  Trophy,
  Sigma,
  Beaker,
  Plus,
  Crown,
  Info,
  Type,
  AlignLeft,
  MousePointerClick,
  PenTool,
  Timer,
  Ruler,
} from "lucide-react";

/* --------------------------- deterministic meta --------------------------- */

const DIMENSION_META: Record<
  ExperimentDimension,
  { label: string; short: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  subject: { label: "Subject line", short: "Subject", icon: Type, color: "var(--chart-1)" },
  body: { label: "Email body", short: "Body", icon: AlignLeft, color: "var(--chart-2)" },
  cta: { label: "Call to action", short: "CTA", icon: MousePointerClick, color: "var(--chart-3)" },
  signature: { label: "Signature", short: "Signature", icon: PenTool, color: "var(--chart-4)" },
  follow_up_timing: { label: "Follow-up timing", short: "Timing", icon: Timer, color: "var(--chart-5)" },
  email_length: { label: "Email length", short: "Length", icon: Ruler, color: "var(--chart-6)" },
};

const DIMENSION_OPTIONS: ExperimentDimension[] = [
  "subject",
  "body",
  "cta",
  "signature",
  "follow_up_timing",
  "email_length",
];

const STATUS_META: Record<
  Experiment["status"],
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  running: { label: "Running", variant: "info" },
  concluded: { label: "Concluded", variant: "success" },
  inconclusive: { label: "Inconclusive", variant: "muted" },
};

export default function AbTestingPage() {
  const experiments = useStore((s) => s.experiments);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const summary = React.useMemo(() => {
    let running = 0;
    let winners = 0;
    let sent = 0;
    let positive = 0;
    for (const exp of experiments) {
      if (exp.status === "running") running++;
      const [a, b] = exp.variants;
      if (a && b) {
        const test = twoProportionTest(a.positive, a.sent, b.positive, b.sent, 0.05, exp.minSamplePerVariant);
        if (test.significant) winners++;
      }
      for (const v of exp.variants) {
        sent += v.sent;
        positive += v.positive;
      }
    }
    return { total: experiments.length, running, winners, sent, positive };
  }, [experiments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="A/B testing"
        description="Split-test your outbound and let statistics — not hunches — pick the winner."
        icon={FlaskConical}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> New experiment
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Experiments" value={formatNumber(summary.total)} icon={Beaker} accent="var(--primary)" />
        <StatCard label="Running" value={formatNumber(summary.running)} icon={FlaskConical} accent="var(--info)" />
        <StatCard label="Significant winners" value={formatNumber(summary.winners)} icon={Trophy} accent="var(--success)" />
        <StatCard label="Emails tested" value={formatNumber(summary.sent)} icon={Sigma} accent="var(--chart-2)" />
      </div>

      {/* Method explainer */}
      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4">
          <div
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "color-mix(in oklch, var(--primary) 14%, transparent)" }}
          >
            <Sigma className="size-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium">Winners are decided by a two-proportion z-test — pure statistics, no AI.</p>
            <p className="mt-0.5 text-muted-foreground">
              We compare each variant&apos;s positive-reply rate, pool the samples, and compute a z-score and two-tailed
              p-value. A variant is only crowned when we have at least the minimum sample per arm and confidence
              exceeds 95%. Everything below is deterministic and reproducible.
            </p>
          </div>
        </CardContent>
      </Card>

      {experiments.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={<FlaskConical className="size-8" />}
              title="No experiments yet"
              description="Create a split-test to compare two subject lines, CTAs, or email lengths side by side."
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" /> New experiment
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {experiments.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}

      <NewExperimentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

/* ------------------------------ experiment card --------------------------- */

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const [a, b] = experiment.variants;
  const dim = DIMENSION_META[experiment.dimension];
  const DimIcon = dim.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  const status = STATUS_META[experiment.status];

  const test = React.useMemo(() => {
    if (!a || !b) return null;
    return twoProportionTest(a.positive, a.sent, b.positive, b.sent, 0.05, experiment.minSamplePerVariant);
  }, [a, b, experiment.minSamplePerVariant]);

  // Winner: prefer statistical verdict; the higher positive rate is the winning arm.
  const winnerKey = React.useMemo(() => {
    if (!test || !a || !b) return undefined;
    if (!test.significant) return undefined;
    return test.rateB > test.rateA ? b.key : a.key;
  }, [test, a, b]);

  const maxRate = Math.max(test?.rateA ?? 0, test?.rateB ?? 0, 0.0001);

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `color-mix(in oklch, ${dim.color} 16%, transparent)` }}
              >
                <DimIcon className="size-3.5" style={{ color: dim.color }} />
              </span>
              <h3 className="truncate text-sm font-semibold tracking-tight">{experiment.name}</h3>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" dot={dim.color}>
                {dim.label}
              </Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </div>
          <VerdictBadge experiment={experiment} test={test} winnerKey={winnerKey} />
        </div>

        {/* variants side by side */}
        {a && b ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <VariantPanel variant={a} rate={test?.rateA ?? 0} isWinner={winnerKey === a.key} accent={dim.color} />
              <VariantPanel variant={b} rate={test?.rateB ?? 0} isWinner={winnerKey === b.key} accent={dim.color} />
            </div>

            {/* comparative bar of positive rates */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Positive-reply rate</span>
                <span>{winnerKey ? `Winner: Variant ${winnerKey}` : "Head to head"}</span>
              </div>
              <RateBar
                label={`A · ${a.label}`}
                rate={test?.rateA ?? 0}
                maxRate={maxRate}
                color={winnerKey === a.key ? "var(--success)" : dim.color}
                highlight={winnerKey === a.key}
              />
              <div className="h-2" />
              <RateBar
                label={`B · ${b.label}`}
                rate={test?.rateB ?? 0}
                maxRate={maxRate}
                color={winnerKey === b.key ? "var(--success)" : "var(--muted-foreground)"}
                highlight={winnerKey === b.key}
              />
            </div>

            {/* stats strip */}
            {test && (
              <div className="grid grid-cols-4 gap-2">
                <MiniStat
                  label="Confidence"
                  value={formatPercent(test.confidence)}
                  color={test.significant ? "var(--success)" : undefined}
                />
                <MiniStat label="p-value" value={test.pValue.toFixed(3)} />
                <MiniStat
                  label="Lift (B vs A)"
                  value={
                    test.lift === Infinity ? "∞" : `${test.lift >= 0 ? "+" : ""}${formatPercent(test.lift)}`
                  }
                  color={test.lift > 0 ? "var(--success)" : test.lift < 0 ? "var(--destructive)" : undefined}
                />
                <MiniStat label="z-score" value={test.z.toFixed(2)} />
              </div>
            )}
          </>
        ) : (
          <EmptyState title="Needs two variants" description="This experiment has fewer than two arms to compare." />
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------- verdict -------------------------------- */

function VerdictBadge({
  experiment,
  test,
  winnerKey,
}: {
  experiment: Experiment;
  test: ReturnType<typeof twoProportionTest> | null;
  winnerKey?: string;
}) {
  if (!test) return null;
  if (!test.enoughData) {
    return (
      <Badge variant="warning">
        <Info className="size-3" /> Collecting data · need {formatNumber(experiment.minSamplePerVariant)}/variant
      </Badge>
    );
  }
  if (test.significant && winnerKey) {
    return (
      <Badge variant="success">
        <Crown className="size-3" /> Winner: Variant {winnerKey} ({formatPercent(test.confidence, 0)} confident)
      </Badge>
    );
  }
  return <Badge variant="muted">No significant difference yet</Badge>;
}

/* ------------------------------- variant panel ---------------------------- */

function VariantPanel({
  variant,
  rate,
  isWinner,
  accent,
}: {
  variant: ExperimentVariant;
  rate: number;
  isWinner: boolean;
  accent: string;
}) {
  const replyRate = variant.sent > 0 ? variant.replied / variant.sent : 0;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        isWinner ? "border-success/50 bg-success/5" : "border-border bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span
            className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white"
            style={{ backgroundColor: isWinner ? "var(--success)" : accent }}
          >
            {variant.key}
          </span>
          {isWinner && <Crown className="size-3.5 text-success" />}
        </span>
        <span className="text-lg font-semibold tabular" style={isWinner ? { color: "var(--success)" } : undefined}>
          {formatPercent(rate)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={variant.label}>
        {variant.label}
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
        <Metric label="Sent" value={formatNumber(variant.sent)} />
        <Metric label="Replied" value={formatNumber(variant.replied)} sub={formatPercent(replyRate, 0)} />
        <Metric label="Positive" value={formatNumber(variant.positive)} />
      </div>
      {variant.meetings > 0 && (
        <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <Trophy className="size-3" /> {formatNumber(variant.meetings)} meetings booked
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-background/60 py-1.5">
      <div className="text-sm font-semibold tabular leading-none">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {label}
        {sub ? ` · ${sub}` : ""}
      </div>
    </div>
  );
}

/* --------------------------------- rate bar ------------------------------- */

function RateBar({
  label,
  rate,
  maxRate,
  color,
  highlight,
}: {
  label: string;
  rate: number;
  maxRate: number;
  color: string;
  highlight: boolean;
}) {
  const width = Math.max(2, Math.min(100, (rate / maxRate) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-28 shrink-0 truncate text-[11px]", highlight ? "font-medium text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-medium tabular">{formatPercent(rate)}</span>
    </div>
  );
}

/* ----------------------------- new experiment ----------------------------- */

function NewExperimentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addExperiment = useStore((s) => s.addExperiment);
  const [name, setName] = React.useState("");
  const [dimension, setDimension] = React.useState<ExperimentDimension>("subject");
  const [labelA, setLabelA] = React.useState("");
  const [labelB, setLabelB] = React.useState("");
  const [minSample, setMinSample] = React.useState(30);

  const previewLabels = React.useMemo(() => Array.from({ length: 7 }, (_, i) => `D${i + 1}`), []);

  function reset() {
    setName("");
    setDimension("subject");
    setLabelA("");
    setLabelB("");
    setMinSample(30);
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogHeader
        title="New experiment"
        description="Configure a two-arm split test. Winners are scored automatically by a two-proportion z-test."
        onClose={onClose}
      />
      <DialogBody className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="exp-name">Experiment name</Label>
          <Input
            id="exp-name"
            placeholder="e.g. Q3 subject line — question vs. stat"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="exp-dim">Dimension under test</Label>
          <Select id="exp-dim" value={dimension} onChange={(e) => setDimension(e.target.value as ExperimentDimension)}>
            {DIMENSION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DIMENSION_META[d].label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="exp-a">Variant A label</Label>
            <Input id="exp-a" placeholder="Control" value={labelA} onChange={(e) => setLabelA(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp-b">Variant B label</Label>
            <Input id="exp-b" placeholder="Challenger" value={labelB} onChange={(e) => setLabelB(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="exp-min">Minimum sample per variant</Label>
          <Input
            id="exp-min"
            type="number"
            min={10}
            value={minSample}
            onChange={(e) => setMinSample(Math.max(0, Number(e.target.value) || 0))}
          />
          <p className="text-[11px] text-muted-foreground">
            No verdict is declared until each arm has at least this many sends. Larger samples detect smaller lifts.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Beaker className="size-3.5" /> Once live, results accrue like this
          </div>
          <AreaChart
            labels={previewLabels}
            series={[
              { key: "a", label: labelA || "Variant A", color: "var(--chart-1)", values: [2, 5, 9, 14, 20, 27, 35] },
              { key: "b", label: labelB || "Variant B", color: "var(--chart-2)", values: [3, 7, 12, 19, 28, 39, 51] },
            ]}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => {
            reset();
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button disabled={!name.trim() || !labelA.trim() || !labelB.trim() || minSample < 10} onClick={() => {
          addExperiment({
            name: name.trim(),
            dimension,
            status: "running",
            minSamplePerVariant: minSample,
            variants: [
              { key: "A", label: labelA.trim(), sent: 0, replied: 0, positive: 0, meetings: 0 },
              { key: "B", label: labelB.trim(), sent: 0, replied: 0, positive: 0, meetings: 0 },
            ],
          });
          reset();
          onClose();
        }}>
          <Plus className="size-4" /> Launch experiment
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
