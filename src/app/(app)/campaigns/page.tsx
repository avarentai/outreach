"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore, useSnapshot } from "@/lib/store";
import { campaignStats, isSent, type CampaignStat } from "@/lib/engines/analytics";
import { DEFAULT_SENDING_WINDOW } from "@/lib/engines/scheduler";
import { PageHeader, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, Switch } from "@/components/ui/misc";
import { Input, Label, Select } from "@/components/ui/input";
import { Sparkline } from "@/components/ui/charts";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Tabs } from "@/components/ui/tabs";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { CAMPAIGN_STATUS_META } from "@/lib/constants";
import { formatNumber, formatPercent, cn, isSameDay } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/lib/types";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Users,
  Send,
  Reply,
  ThumbsUp,
  CalendarCheck,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_BADGE: Record<CampaignStatus, "success" | "warning" | "info" | "muted"> = {
  draft: "muted",
  active: "success",
  paused: "warning",
  completed: "info",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
];

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const snap = useSnapshot();
  const campaigns = useStore((s) => s.campaigns);
  const contacts = useStore((s) => s.contacts);
  const users = useStore((s) => s.users);
  const sequences = useStore((s) => s.sequences);
  const accounts = useStore((s) => s.accounts);
  const setCampaignStatus = useStore((s) => s.setCampaignStatus);
  const addCampaign = useStore((s) => s.addCampaign);

  const [filter, setFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const statsById = React.useMemo(() => {
    const map = new Map<string, CampaignStat>();
    for (const s of campaignStats(snap)) map.set(s.campaignId, s);
    return map;
  }, [snap]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: campaigns.length };
    for (const camp of campaigns) c[camp.status] = (c[camp.status] ?? 0) + 1;
    return c;
  }, [campaigns]);

  const filtered = React.useMemo(
    () => (filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter)),
    [campaigns, filter],
  );

  const totals = React.useMemo(() => {
    const all = [...statsById.values()];
    return {
      sent: all.reduce((a, s) => a + s.sent, 0),
      replied: all.reduce((a, s) => a + s.replied, 0),
      positive: all.reduce((a, s) => a + s.positive, 0),
      meetings: all.reduce((a, s) => a + s.meetings, 0),
    };
  }, [statsById]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Automated outbound sequences across your prospect list."
        icon={Megaphone}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Total sent" value={formatNumber(totals.sent)} />
        <MiniStat label="Replies" value={formatNumber(totals.replied)} color="var(--chart-1)" />
        <MiniStat label="Positive" value={formatNumber(totals.positive)} color="var(--success)" />
        <MiniStat label="Meetings" value={formatNumber(totals.meetings)} color="var(--chart-5)" />
      </div>

      <Tabs
        tabs={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] ?? 0 }))}
        value={filter}
        onValueChange={setFilter}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-8" />}
          title={filter === "all" ? "No campaigns yet" : `No ${filter} campaigns`}
          description="Create a campaign to enroll prospects into an automated sequence."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New campaign
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const trend: number[] = [];
            for (let i = 13; i >= 0; i--) {
              const day = new Date();
              day.setDate(day.getDate() - i);
              trend.push(
                snap.messages.filter(
                  (m) =>
                    m.campaignId === c.id &&
                    isSent(m) &&
                    m.sentAt &&
                    isSameDay(new Date(m.sentAt), day),
                ).length,
              );
            }
            return (
              <CampaignCard
                key={c.id}
                campaign={c}
                stat={statsById.get(c.id)}
                owner={users.find((u) => u.id === c.ownerId)}
                prospectCount={contacts.filter((ct) => ct.campaignId === c.id).length}
                trend={trend}
                onStatus={setCampaignStatus}
              />
            );
          })}
        </div>
      )}

      <CreateCampaignDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sequences={sequences}
        accounts={accounts}
        onCreate={(input) => {
          const camp = addCampaign(input);
          toast.success(`Campaign "${camp.name}" created`);
          setCreateOpen(false);
          router.push(`/campaigns/${camp.id}`);
        }}
      />
    </div>
  );
}

/* -------------------------------- Card ------------------------------------ */

function CampaignCard({
  campaign,
  stat,
  owner,
  prospectCount,
  trend,
  onStatus,
}: {
  campaign: Campaign;
  stat?: CampaignStat;
  owner?: { name: string; avatarColor: string };
  prospectCount: number;
  trend: number[];
  onStatus: (id: string, status: CampaignStatus) => void;
}) {
  const meta = CAMPAIGN_STATUS_META[campaign.status];
  const canRun = campaign.status !== "completed";

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/campaigns/${campaign.id}`} className="block">
              <h3 className="truncate text-sm font-semibold tracking-tight hover:underline">
                {campaign.name}
              </h3>
            </Link>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge variant={STATUS_BADGE[campaign.status]} dot={meta.color}>
                {meta.label}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                <span className="tabular">{formatNumber(prospectCount)}</span> prospects
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {owner && <Avatar name={owner.name} color={owner.avatarColor} size={26} />}
            <Dropdown
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Campaign actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            >
              {canRun &&
                (campaign.status === "active" ? (
                  <DropdownItem icon={<Pause />} onClick={() => onStatus(campaign.id, "paused")}>
                    Pause campaign
                  </DropdownItem>
                ) : (
                  <DropdownItem icon={<Play />} onClick={() => onStatus(campaign.id, "active")}>
                    {campaign.status === "paused" ? "Resume campaign" : "Activate campaign"}
                  </DropdownItem>
                ))}
              <Link href={`/campaigns/${campaign.id}`}>
                <DropdownItem icon={<ArrowRight />}>Open details</DropdownItem>
              </Link>
            </Dropdown>
          </div>
        </div>

        {/* Sparkline */}
        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold tabular">{formatNumber(stat?.sent ?? 0)}</div>
            <div className="text-xs text-muted-foreground">emails sent</div>
          </div>
          <Sparkline data={trend.length ? trend : [0, 0]} color="var(--chart-2)" width={96} height={38} />
        </div>

        {/* Stat row */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
          <StatCell
            icon={<Reply className="size-3.5" />}
            label="Reply"
            value={formatPercent(stat?.replyRate ?? 0)}
          />
          <StatCell
            icon={<ThumbsUp className="size-3.5" />}
            label="Positive"
            value={formatPercent(stat?.positiveRate ?? 0)}
            accent="var(--success)"
          />
          <StatCell
            icon={<CalendarCheck className="size-3.5" />}
            label="Meetings"
            value={formatNumber(stat?.meetings ?? 0)}
          />
        </div>

        {/* Footer control */}
        <div className="mt-4 flex items-center gap-2">
          {canRun && campaign.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onStatus(campaign.id, "paused")}
            >
              <Pause className="size-3.5" /> Pause
            </Button>
          ) : canRun ? (
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => onStatus(campaign.id, "active")}
            >
              <Play className="size-3.5" /> {campaign.status === "paused" ? "Resume" : "Activate"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1" disabled>
              Completed
            </Button>
          )}
          <Link href={`/campaigns/${campaign.id}`} className="shrink-0">
            <Button variant="ghost" size="sm">
              Details <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

/* --------------------------- Create dialog -------------------------------- */

function CreateCampaignDialog({
  open,
  onClose,
  sequences,
  accounts,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  sequences: { id: string; name: string; steps: unknown[] }[];
  accounts: { id: string; label: string; fromEmail: string; active: boolean }[];
  onCreate: (input: Partial<Campaign> & { name: string; sequenceId: string }) => void;
}) {
  const [name, setName] = React.useState("");
  const [sequenceId, setSequenceId] = React.useState("");
  const [accountIds, setAccountIds] = React.useState<string[]>([]);
  const [requireApproval, setRequireApproval] = React.useState(false);
  const [stopOnReply, setStopOnReply] = React.useState(true);

  // Seed defaults whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setSequenceId(sequences[0]?.id ?? "");
    setAccountIds(accounts.filter((a) => a.active).map((a) => a.id));
    setRequireApproval(false);
    setStopOnReply(true);
  }, [open, sequences, accounts]);

  const toggleAccount = (id: string) =>
    setAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const valid = name.trim().length > 0 && sequenceId.length > 0;

  const submit = () => {
    if (!valid) return;
    onCreate({
      name: name.trim(),
      sequenceId,
      sendingAccountIds: accountIds,
      requireApproval,
      stopOnReply,
      sendingWindow: DEFAULT_SENDING_WINDOW,
      status: "draft",
    });
  };

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader
        title="New campaign"
        description="Enroll prospects into an automated sequence."
        onClose={onClose}
      />
      <DialogBody className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            autoFocus
            placeholder="Q3 Credit Unions — Auto Lending"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaign-sequence">Sequence</Label>
          {sequences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sequences available. Create one first.
            </p>
          ) : (
            <Select
              id="campaign-sequence"
              value={sequenceId}
              onChange={(e) => setSequenceId(e.target.value)}
            >
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.steps.length} steps
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Sending accounts</Label>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sending accounts connected.</p>
          ) : (
            <div className="grid gap-1.5">
              {accounts.map((a) => {
                const on = accountIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      on ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.fromEmail}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <ToggleRow
            label="Require approval before send"
            description="Manually review each email before it goes out."
            checked={requireApproval}
            onChange={setRequireApproval}
          />
          <div className="h-px bg-border" />
          <ToggleRow
            label="Stop on reply"
            description="Pause the sequence for a prospect once they respond."
            checked={stopOnReply}
            onChange={setStopOnReply}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid}>
          Create campaign
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
