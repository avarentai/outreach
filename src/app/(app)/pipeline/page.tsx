"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useStore, useSnapshot } from "@/lib/store";
import { pipelineStats, type StageStat } from "@/lib/engines/analytics";
import { PageHeader } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, Switch } from "@/components/ui/misc";
import { STAGE_META } from "@/lib/constants";
import { PIPELINE_STAGES, type PipelineStage, type Contact, type Company } from "@/lib/types";
import { cn, formatNumber, formatPercent, daysBetween, titleCase } from "@/lib/utils";
import { Kanban, Users, GripVertical, Building2, ArrowRight } from "lucide-react";

/* ========================================================================= */

export default function PipelinePage() {
  const snap = useSnapshot();
  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const moveStage = useStore((s) => s.moveStage);

  const [now] = React.useState(() => new Date());
  const [hideEmpty, setHideEmpty] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const companyById = React.useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies) map.set(c.id, c);
    return map;
  }, [companies]);

  const allStats = React.useMemo(() => pipelineStats(snap), [snap]);
  const statByStage = React.useMemo(() => {
    const map = new Map<PipelineStage, StageStat>();
    for (const s of allStats) map.set(s.stage, s);
    return map;
  }, [allStats]);

  const contactsByStage = React.useMemo(() => {
    const map = new Map<PipelineStage, Contact[]>();
    for (const stage of PIPELINE_STAGES) map.set(stage, []);
    for (const c of contacts) map.get(c.stage)?.push(c);
    // Highest score first within each column.
    for (const stage of PIPELINE_STAGES) {
      map.get(stage)!.sort((a, b) => b.score - a.score);
    }
    return map;
  }, [contacts]);

  const totalContacts = contacts.length;
  const activeContact = activeId ? contacts.find((c) => c.id === activeId) ?? null : null;

  const visibleStages = React.useMemo(
    () => (hideEmpty ? PIPELINE_STAGES.filter((s) => (contactsByStage.get(s)?.length ?? 0) > 0) : PIPELINE_STAGES),
    [hideEmpty, contactsByStage],
  );

  // Stats strip mirrors the board: only show cards for currently visible stages.
  const stats = React.useMemo(() => {
    const visible = new Set(visibleStages);
    return allStats.filter((s) => visible.has(s.stage));
  }, [allStats, visibleStages]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const stage = String(overId) as PipelineStage;
    if (!PIPELINE_STAGES.includes(stage)) return;
    moveStage(String(e.active.id), stage);
  }

  if (totalContacts === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pipeline"
          description="Drag leads across stages to move deals forward."
          icon={Kanban}
        />
        <EmptyState
          icon={<Users className="size-8" />}
          title="No leads in the pipeline yet"
          description="Import leads or create a campaign to start filling your pipeline."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description={`${formatNumber(totalContacts)} leads across ${PIPELINE_STAGES.length} stages · drag cards to move stages`}
        icon={Kanban}
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={hideEmpty} onCheckedChange={setHideEmpty} />
            Hide empty stages
          </label>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {stats.map((s) => (
          <StageStatCard key={s.stage} stat={s} total={totalContacts} />
        ))}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3 px-1">
            {visibleStages.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                contacts={contactsByStage.get(stage) ?? []}
                companyById={companyById}
                now={now}
                activeId={activeId}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeContact ? (
            <ContactCard
              contact={activeContact}
              company={companyById.get(activeContact.companyId)}
              now={now}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ------------------------------ stats strip ------------------------------- */

function StageStatCard({ stat, total }: { stat: StageStat; total: number }) {
  const meta = STAGE_META[stat.stage];
  const share = total ? stat.count / total : 0;
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
        <span className="truncate text-xs font-medium text-muted-foreground">{meta.label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular">{formatNumber(stat.count)}</span>
        <span className="text-xs text-muted-foreground tabular">{formatPercent(share, 0)}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, backgroundColor: meta.color }} />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <StatLine label="Avg days" value={<span className="tabular text-foreground">{stat.avgDaysInStage}</span>} />
        <StatLine
          label="To next"
          value={<span className="tabular text-foreground">{formatPercent(stat.conversionToNext, 0)}</span>}
        />
      </div>
    </Card>
  );
}

function StatLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span>{label}</span>
      {value}
    </div>
  );
}

/* -------------------------------- column ---------------------------------- */

function StageColumn({
  stage,
  contacts,
  companyById,
  now,
  activeId,
}: {
  stage: PipelineStage;
  contacts: Contact[];
  companyById: Map<string, Company>;
  now: Date;
  activeId: string | null;
}) {
  const meta = STAGE_META[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const stat = React.useMemo(
    () => ({
      avg:
        contacts.length === 0
          ? 0
          : Math.round(
              (contacts.reduce((a, c) => a + daysBetween(c.stageEnteredAt, now), 0) / contacts.length) * 10,
            ) / 10,
    }),
    [contacts, now],
  );

  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
        <h3 className="truncate text-sm font-semibold tracking-tight">{meta.label}</h3>
        <Badge variant="muted" className="ml-auto tabular">
          {contacts.length}
        </Badge>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[140px] flex-1 flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 transition-colors",
          isOver && "border-primary/50 bg-primary/5 ring-2 ring-primary/20",
        )}
      >
        {contacts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">
            {isOver ? "Drop here" : "No leads"}
          </div>
        ) : (
          contacts.map((c) => (
            <DraggableCard
              key={c.id}
              contact={c}
              company={companyById.get(c.companyId)}
              now={now}
              dimmed={activeId === c.id}
            />
          ))
        )}
      </div>

      {/* Column footer */}
      {contacts.length > 0 && (
        <div className="mt-2 px-1 text-[11px] text-muted-foreground">
          avg <span className="tabular text-foreground">{stat.avg}</span> days in stage
        </div>
      )}
    </div>
  );
}

/* ------------------------------ draggable --------------------------------- */

function DraggableCard({
  contact,
  company,
  now,
  dimmed,
}: {
  contact: Contact;
  company?: Company;
  now: Date;
  dimmed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id });
  return (
    <div ref={setNodeRef} className={cn((isDragging || dimmed) && "opacity-40")}>
      <ContactCard
        contact={contact}
        company={company}
        now={now}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/* --------------------------------- card ----------------------------------- */

function ContactCard({
  contact,
  company,
  now,
  overlay,
  dragHandleProps,
}: {
  contact: Contact;
  company?: Company;
  now: Date;
  overlay?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const days = daysBetween(contact.stageEnteredAt, now);
  const scoreVariant = contact.score >= 70 ? "success" : contact.score >= 40 ? "info" : "muted";

  return (
    <Card
      className={cn(
        "group relative p-3 transition-shadow",
        overlay ? "rotate-2 shadow-lg ring-1 ring-primary/30" : "hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag lead"
          className={cn(
            "mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing",
            overlay && "cursor-grabbing",
          )}
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>

        <Avatar name={name || "?"} size={30} />

        <div className="min-w-0 flex-1">
          <Link
            href={`/leads/${contact.id}`}
            className="block truncate text-sm font-medium hover:text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {name || "Unnamed lead"}
          </Link>
          {contact.jobTitle && (
            <div className="truncate text-xs text-muted-foreground">{contact.jobTitle}</div>
          )}
        </div>

        <Badge variant={scoreVariant} className="shrink-0 tabular">
          {contact.score}
        </Badge>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3.5 shrink-0" />
        <span className="truncate">{company?.name ?? "Unknown company"}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className="text-[11px] text-muted-foreground">
          <span className="tabular">{days}</span> {days === 1 ? "day" : "days"} in stage
        </span>
        {company?.industry && (
          <span className="truncate text-[11px] text-muted-foreground">{titleCase(company.industry)}</span>
        )}
      </div>

      {!overlay && (
        <Link
          href={`/leads/${contact.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:bg-accent"
          aria-label="Open lead"
        >
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </Card>
  );
}
