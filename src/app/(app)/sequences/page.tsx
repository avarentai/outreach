"use client";

import * as React from "react";
import { nanoid } from "nanoid";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore } from "@/lib/store";
import { sequenceDurationDays } from "@/lib/engines/scheduler";
import type { Sequence, SequenceStep, StopCondition } from "@/lib/types";
import { PageHeader, SectionTitle } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { TEMPLATE_CATEGORY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Workflow,
  Mail,
  Clock,
  GitBranch,
  ListChecks,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  CircleStop,
  CalendarDays,
  Layers,
  FileText,
  AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Step presentation metadata
 * ------------------------------------------------------------------ */

const STEP_META: Record<
  SequenceStep["type"],
  { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }
> = {
  email: { label: "Email", icon: Mail, color: "var(--chart-1)" },
  wait: { label: "Wait", icon: Clock, color: "var(--chart-4)" },
  condition: { label: "Condition", icon: GitBranch, color: "var(--warning)" },
  manual_task: { label: "Manual task", icon: ListChecks, color: "var(--chart-5)" },
};

const STOP_META: Record<StopCondition, string> = {
  on_reply: "Stop on reply",
  on_meeting_booked: "Stop when meeting booked",
  on_click: "Stop on link click",
  never: "Never stop",
};

const STOP_OPTIONS: StopCondition[] = ["on_reply", "on_meeting_booked", "on_click", "never"];

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function SequencesPage() {
  const sequences = useStore((s) => s.sequences);
  const templates = useStore((s) => s.templates);
  const campaigns = useStore((s) => s.campaigns);
  const addSequence = useStore((s) => s.addSequence);
  const updateSequence = useStore((s) => s.updateSequence);

  const [selectedId, setSelectedId] = React.useState<string | null>(sequences[0]?.id ?? null);

  // Keep a valid selection when the list changes.
  React.useEffect(() => {
    if (sequences.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !sequences.some((s) => s.id === selectedId)) {
      setSelectedId(sequences[0].id);
    }
  }, [sequences, selectedId]);

  const selected = sequences.find((s) => s.id === selectedId) ?? null;

  const activeTemplates = React.useMemo(
    () => templates.filter((t) => !t.archived),
    [templates],
  );

  const templateById = React.useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  // How many campaigns run each sequence — shown as usage.
  const usageBySequence = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of campaigns) map.set(c.sequenceId, (map.get(c.sequenceId) ?? 0) + 1);
    return map;
  }, [campaigns]);

  function handleNewSequence() {
    const now = new Date().toISOString();
    const seq: Sequence = {
      id: `seq_${nanoid(8)}`,
      name: `Untitled sequence ${sequences.length + 1}`,
      steps: [
        { id: `step_${nanoid(8)}`, type: "email", templateId: activeTemplates[0]?.id },
        { id: `step_${nanoid(8)}`, type: "wait", waitDays: 3 },
        { id: `step_${nanoid(8)}`, type: "condition", stopOn: "on_reply" },
      ],
      createdAt: now,
      updatedAt: now,
    };
    addSequence(seq);
    setSelectedId(seq.id);
  }

  /* -------- step mutation helpers (all persist via updateSequence) -------- */

  function commitSteps(seq: Sequence, steps: SequenceStep[]) {
    updateSequence(seq.id, { steps });
  }

  function addStep(seq: Sequence, type: SequenceStep["type"]) {
    const base: SequenceStep = { id: `step_${nanoid(8)}`, type };
    const step: SequenceStep =
      type === "email"
        ? { ...base, templateId: activeTemplates[0]?.id }
        : type === "wait"
          ? { ...base, waitDays: 3 }
          : type === "condition"
            ? { ...base, stopOn: "on_reply" }
            : { ...base, taskLabel: "New task" };
    commitSteps(seq, [...seq.steps, step]);
  }

  function deleteStep(seq: Sequence, stepId: string) {
    commitSteps(seq, seq.steps.filter((s) => s.id !== stepId));
  }

  function patchStep(seq: Sequence, stepId: string, patch: Partial<SequenceStep>) {
    commitSteps(
      seq,
      seq.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    );
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!selected) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selected.steps.findIndex((s) => s.id === active.id);
    const newIndex = selected.steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commitSteps(selected, arrayMove(selected.steps, oldIndex, newIndex));
  }

  const duration = selected ? sequenceDurationDays(selected) : 0;
  const emailCount = selected ? selected.steps.filter((s) => s.type === "email").length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sequences"
        description="Design multi-step outbound flows. Drag to reorder, tune waits, and branch on replies."
        icon={Workflow}
        actions={
          <Button onClick={handleNewSequence}>
            <Plus className="size-4" /> New sequence
          </Button>
        }
      />

      {sequences.length === 0 ? (
        <EmptyState
          icon={<Workflow className="size-8" />}
          title="No sequences yet"
          description="Sequences chain emails, waits, and conditions into an automated outbound cadence."
          action={
            <Button onClick={handleNewSequence}>
              <Plus className="size-4" /> Create your first sequence
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* -------------------------- Left: sequence list ------------------------- */}
          <div className="space-y-2">
            <SectionTitle>All sequences</SectionTitle>
            <div className="space-y-1.5">
              {sequences.map((seq) => {
                const isActive = seq.id === selectedId;
                const days = sequenceDurationDays(seq);
                const usage = usageBySequence.get(seq.id) ?? 0;
                return (
                  <button
                    key={seq.id}
                    onClick={() => setSelectedId(seq.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium">{seq.name}</span>
                      {usage > 0 && (
                        <Badge variant="muted" className="shrink-0">
                          {usage} {usage === 1 ? "campaign" : "campaigns"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3" />
                        <span className="tabular">{seq.steps.length}</span> steps
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        <span className="tabular">{formatDays(days)}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* -------------------------- Right: flow builder ------------------------- */}
          {selected ? (
            <Card className="overflow-hidden">
              {/* Builder header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0 flex-1">
                  <Input
                    value={selected.name}
                    onChange={(e) => updateSequence(selected.id, { name: e.target.value })}
                    className="h-9 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:border-ring/50"
                    placeholder="Sequence name"
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      <span className="tabular">{emailCount}</span> emails
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      Spans <span className="tabular">{formatDays(duration)}</span>
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => addStep(selected, "email")}>
                    <Mail className="size-3.5" /> Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep(selected, "wait")}>
                    <Clock className="size-3.5" /> Wait
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep(selected, "condition")}>
                    <GitBranch className="size-3.5" /> Condition
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep(selected, "manual_task")}>
                    <ListChecks className="size-3.5" /> Task
                  </Button>
                </div>
              </div>

              <CardContent className="bg-muted/20 p-6 pt-6">
                {selected.steps.length === 0 ? (
                  <EmptyState
                    icon={<Workflow className="size-8" />}
                    title="This sequence is empty"
                    description="Add an email, wait, or condition step to start building the flow."
                    className="border-border/60 bg-card"
                  />
                ) : (
                  <div className="mx-auto max-w-xl">
                    {/* Enrollment start marker */}
                    <FlowMarker label="Contact enrolled" accent="var(--chart-2)" start />

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={selected.steps.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {selected.steps.map((step, i) => (
                          <React.Fragment key={step.id}>
                            <Connector />
                            <StepNode
                              step={step}
                              index={i}
                              templates={activeTemplates}
                              templateById={templateById}
                              onDelete={() => deleteStep(selected, step.id)}
                              onPatch={(patch) => patchStep(selected, step.id, patch)}
                            />
                          </React.Fragment>
                        ))}
                      </SortableContext>
                    </DndContext>

                    <Connector />
                    <FlowMarker label="Sequence complete" accent="var(--muted-foreground)" />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <EmptyState title="Select a sequence" description="Pick a sequence on the left to edit its flow." />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Connectors & flow markers
 * ------------------------------------------------------------------ */

function Connector() {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <div className="h-4 w-px bg-border" />
      <ChevronDown className="-my-1.5 size-4 text-muted-foreground/60" />
      <div className="h-4 w-px bg-border" />
    </div>
  );
}

function FlowMarker({
  label,
  accent,
  start,
}: {
  label: string;
  accent: string;
  start?: boolean;
}) {
  return (
    <div className="flex justify-center">
      <div
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
        style={{ borderColor: `color-mix(in oklch, ${accent} 40%, var(--border))` }}
      >
        <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
        {start ? label : <CircleStop className="-ml-0.5 size-3.5" style={{ color: accent }} />}
        {!start && label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sortable step node
 * ------------------------------------------------------------------ */

function StepNode({
  step,
  index,
  templates,
  templateById,
  onDelete,
  onPatch,
}: {
  step: SequenceStep;
  index: number;
  templates: { id: string; name: string; category: keyof typeof TEMPLATE_CATEGORY_META }[];
  templateById: Map<string, { id: string; name: string; subject: string }>;
  onDelete: () => void;
  onPatch: (patch: Partial<SequenceStep>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const meta = STEP_META[step.type];
  const Icon = meta.icon;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tpl = step.templateId ? templateById.get(step.templateId) : undefined;
  const missingTemplate = step.type === "email" && !tpl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border border-border bg-card shadow-sm transition-shadow",
        isDragging ? "z-10 shadow-lg ring-1 ring-primary/30" : "hover:shadow-md",
      )}
    >
      {/* accent rail */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />

      <div className="flex items-start gap-3 p-3.5 pl-4">
        {/* drag handle */}
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        {/* icon chip */}
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 16%, transparent)` }}
        >
          <Icon className="size-4.5" style={{ color: meta.color }} />
        </div>

        {/* body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tabular text-muted-foreground">
              Step {index + 1}
            </span>
            <span className="text-sm font-semibold">{meta.label}</span>
            {step.type === "email" && tpl && (
              <Badge variant="muted" className="hidden sm:inline-flex">
                {TEMPLATE_CATEGORY_META[
                  (templates.find((t) => t.id === tpl.id)?.category ?? "custom") as keyof typeof TEMPLATE_CATEGORY_META
                ].label}
              </Badge>
            )}
          </div>

          {/* Type-specific controls */}
          <div className="mt-2">
            {step.type === "email" && (
              <EmailStepBody
                templateId={step.templateId}
                templates={templates}
                subject={tpl?.subject}
                missing={missingTemplate}
                onPick={(id) => onPatch({ templateId: id })}
              />
            )}

            {step.type === "wait" && (
              <WaitStepBody
                waitDays={step.waitDays ?? 0}
                onChange={(days) => onPatch({ waitDays: days })}
              />
            )}

            {step.type === "condition" && (
              <ConditionStepBody
                stopOn={step.stopOn ?? "on_reply"}
                onChange={(v) => onPatch({ stopOn: v })}
              />
            )}

            {step.type === "manual_task" && (
              <Input
                value={step.taskLabel ?? ""}
                onChange={(e) => onPatch({ taskLabel: e.target.value })}
                placeholder="Describe the manual task (e.g. connect on LinkedIn)"
                className="h-8 text-sm"
              />
            )}
          </div>
        </div>

        {/* delete */}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete step"
          className="mt-0.5 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Step bodies ------------------------------ */

function EmailStepBody({
  templateId,
  templates,
  subject,
  missing,
  onPick,
}: {
  templateId?: string;
  templates: { id: string; name: string }[];
  subject?: string;
  missing: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
        <Select
          value={templateId ?? ""}
          onChange={(e) => onPick(e.target.value)}
          className="h-8 max-w-xs text-sm"
        >
          <option value="" disabled>
            Choose a template…
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      {subject && (
        <p className="truncate pl-5.5 text-xs text-muted-foreground">
          Subject: <span className="text-foreground">{subject}</span>
        </p>
      )}
      {missing && (
        <p className="inline-flex items-center gap-1 pl-5.5 text-xs text-warning">
          <AlertTriangle className="size-3.5" /> No template selected
        </p>
      )}
    </div>
  );
}

function WaitStepBody({
  waitDays,
  onChange,
}: {
  waitDays: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Wait for</span>
      <Input
        type="number"
        min={0}
        max={90}
        value={waitDays}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(90, n)) : 0);
        }}
        className="h-8 w-16 text-center tabular"
      />
      <span>{waitDays === 1 ? "day" : "days"} before the next step</span>
    </div>
  );
}

function ConditionStepBody({
  stopOn,
  onChange,
}: {
  stopOn: StopCondition;
  onChange: (v: StopCondition) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CircleStop className="size-3.5 shrink-0 text-warning" />
      <Select
        value={stopOn}
        onChange={(e) => onChange(e.target.value as StopCondition)}
        className="h-8 max-w-xs text-sm"
      >
        {STOP_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {STOP_META[opt]}
          </option>
        ))}
      </Select>
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

function formatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  const clean = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${clean} ${rounded === 1 ? "day" : "days"}`;
}
