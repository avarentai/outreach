"use client";

import * as React from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import { useStore } from "@/lib/store";
import type {
  ScoringConfig,
  ScoringRule,
  ScoringField,
  ScoringOperator,
  SendingAccount,
  SendingProvider,
  UserRole,
} from "@/lib/types";
import { PageHeader, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Avatar, Switch, Separator, EmptyState, Progress } from "@/components/ui/misc";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { ACTIVITY_META } from "@/lib/constants";
import { cn, formatNumber, relativeTime, titleCase } from "@/lib/utils";
import {
  Settings,
  Building2,
  Users,
  Mail,
  Target,
  Zap,
  History,
  Plus,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Trash2,
  Save,
  Flame,
  Info,
} from "lucide-react";

type TabKey =
  | "workspace"
  | "team"
  | "accounts"
  | "scoring"
  | "snippets"
  | "activity";

const TABS: { value: TabKey; label: string; icon: Icons.LucideIcon }[] = [
  { value: "workspace", label: "Workspace", icon: Building2 },
  { value: "team", label: "Team & Roles", icon: Users },
  { value: "accounts", label: "Sending Accounts", icon: Mail },
  { value: "scoring", label: "Opportunity Scoring", icon: Target },
  { value: "snippets", label: "Snippets", icon: Zap },
  { value: "activity", label: "Activity Log", icon: History },
];

export default function SettingsPage() {
  const [tab, setTab] = React.useState<TabKey>("workspace");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your workspace, team, sending infrastructure, and scoring rules."
        icon={Settings}
      />

      <Tabs
        tabs={TABS.map((t) => ({
          value: t.value,
          label: (
            <span className="flex items-center gap-1.5">
              <t.icon className="size-3.5" />
              {t.label}
            </span>
          ),
        }))}
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
      />

      {tab === "workspace" && <WorkspaceTab />}
      {tab === "team" && <TeamTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "scoring" && <ScoringTab />}
      {tab === "snippets" && <SnippetsTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}

/* ============================ Workspace ============================ */

const TIMEZONES = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Australia/Sydney",
];

function WorkspaceTab() {
  const workspace = useStore((s) => s.workspace);
  const companies = useStore((s) => s.companies);
  const contacts = useStore((s) => s.contacts);
  const users = useStore((s) => s.users);

  // No store setter for workspace — edits live in local component state.
  const [name, setName] = React.useState(workspace.name);
  const [domain, setDomain] = React.useState(workspace.domain);
  const [timezone, setTimezone] = React.useState(workspace.timezone);

  const dirty =
    name !== workspace.name || domain !== workspace.domain || timezone !== workspace.timezone;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-5">
          <SectionTitle>Workspace details</SectionTitle>
          <div className="space-y-4">
            <Field label="Workspace name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Primary domain" hint="Used for default sending identities and tracking.">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </Field>
            <Field label="Default timezone" hint="Sending windows and scheduling honor this timezone.">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {dirty
                ? "Unsaved changes — workspace edits are local in this demo."
                : "All changes saved."}
            </p>
            <Button
              disabled={!dirty}
              onClick={() => {
                toast.success("Workspace settings saved");
              }}
            >
              <Save className="size-4" /> Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <SectionTitle>At a glance</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Members" value={formatNumber(users.length)} />
              <MiniStat label="Companies" value={formatNumber(companies.length)} />
              <MiniStat label="Contacts" value={formatNumber(contacts.length)} />
              <MiniStat label="Created" value={new Date(workspace.createdAt).getFullYear()} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <SectionTitle>Region</SectionTitle>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="muted" dot="var(--info)">
                {timezone.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              All timestamps across the app render in this timezone.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================ Team & Roles ============================ */

const ROLE_META: Record<
  UserRole,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"]; desc: string }
> = {
  owner: {
    label: "Owner",
    variant: "default",
    desc: "Full control including billing, workspace deletion, and role management.",
  },
  admin: {
    label: "Admin",
    variant: "info",
    desc: "Manage campaigns, sending accounts, team members, and all data.",
  },
  member: {
    label: "Member",
    variant: "secondary",
    desc: "Create and run campaigns, manage their own leads and templates.",
  },
  viewer: {
    label: "Viewer",
    variant: "muted",
    desc: "Read-only access to dashboards, analytics, and pipeline.",
  },
};

function TeamTab() {
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <SectionTitle className="mb-1">Team members</SectionTitle>
            <p className="text-xs text-muted-foreground">
              {users.length} {users.length === 1 ? "person" : "people"} in this workspace.
            </p>
          </div>
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <Plus className="size-4" /> Invite
          </Button>
        </div>
        <CardContent className="p-5 pt-4">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} color={u.avatarColor} size={30} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="truncate">{u.name}</span>
                            {u.id === currentUserId && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                You
                              </Badge>
                            )}
                          </div>
                          {u.title && (
                            <div className="truncate text-xs text-muted-foreground">{u.title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_META[u.role].variant}>{ROLE_META[u.role].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular">
                      {relativeTime(u.lastActiveAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <SectionTitle>Roles & permissions</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(ROLE_META) as UserRole[]).map((role) => {
              const meta = ROLE_META[role];
              const count = users.filter((u) => u.role === role).length;
              return (
                <div key={role} className="rounded-lg border border-border p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground tabular">
                      {count} {count === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{meta.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} size="sm">
        <DialogHeader
          title="Invite teammate"
          description="Send an invitation to join this workspace."
          onClose={() => setInviteOpen(false)}
        />
        <DialogBody className="space-y-4">
          <Field label="Email address">
            <Input placeholder="teammate@company.com" type="email" />
          </Field>
          <Field label="Role">
            <Select defaultValue="member">
              {(Object.keys(ROLE_META) as UserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Invitations are visual only in this demo — no email is sent.
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setInviteOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setInviteOpen(false);
              toast.success("Invitation queued");
            }}
          >
            Send invite
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

/* ============================ Sending Accounts ============================ */

function AuthBadge({ label, status }: { label: string; status: "pass" | "fail" | "unknown" }) {
  const map = {
    pass: { variant: "success" as const, Icon: ShieldCheck },
    fail: { variant: "destructive" as const, Icon: ShieldAlert },
    unknown: { variant: "muted" as const, Icon: ShieldQuestion },
  };
  const { variant, Icon } = map[status];
  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

function AccountsTab() {
  const accounts = useStore((s) => s.accounts);
  const updateAccount = useStore((s) => s.updateAccount);
  const addAccount = useStore((s) => s.addAccount);
  const [open, setOpen] = React.useState(false);

  const [label, setLabel] = React.useState("");
  const [fromName, setFromName] = React.useState("");
  const [fromEmail, setFromEmail] = React.useState("");
  const [provider, setProvider] = React.useState<SendingProvider>("resend");
  const [dailyLimit, setDailyLimit] = React.useState(50);

  const reset = () => {
    setLabel("");
    setFromName("");
    setFromEmail("");
    setProvider("resend");
    setDailyLimit(50);
  };

  const canSubmit = label.trim() && fromName.trim() && fromEmail.trim();

  const submit = () => {
    if (!canSubmit) return;
    const account: SendingAccount = {
      id: `acc_${nanoid(8)}`,
      label: label.trim(),
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim(),
      provider,
      dailyLimit: Number(dailyLimit) || 50,
      warmupEnabled: true,
      spf: "unknown",
      dkim: "unknown",
      dmarc: "unknown",
      reputationScore: 75,
      active: true,
      createdAt: new Date().toISOString(),
    };
    addAccount(account);
    setOpen(false);
    reset();
    toast.success(`Sending account "${account.label}" added`);
  };

  const totalCapacity = accounts
    .filter((a) => a.active)
    .reduce((sum, a) => sum + a.dailyLimit, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Accounts" value={formatNumber(accounts.length)} />
        <MiniStat
          label="Active"
          value={formatNumber(accounts.filter((a) => a.active).length)}
          color="var(--success)"
        />
        <MiniStat label="Daily capacity" value={formatNumber(totalCapacity)} />
        <MiniStat
          label="Warming up"
          value={formatNumber(accounts.filter((a) => a.warmupEnabled).length)}
          color="var(--warning)"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between p-5 pb-3">
          <SectionTitle className="mb-0">Sending accounts</SectionTitle>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add account
          </Button>
        </div>
        <CardContent className="p-5 pt-0">
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-8" />}
              title="No sending accounts"
              description="Add a sending identity to start delivering outbound email."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="size-4" /> Add account
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-lg border border-border p-4 transition-opacity",
                    !a.active && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.label}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {a.provider}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {a.fromName} &lt;{a.fromEmail}&gt;
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Active</span>
                        <Switch
                          checked={a.active}
                          onCheckedChange={(v) => updateAccount(a.id, { active: v })}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Flame className="size-3" /> Warmup
                        </span>
                        <Switch
                          checked={a.warmupEnabled}
                          onCheckedChange={(v) => updateAccount(a.id, { warmupEnabled: v })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <AuthBadge label="SPF" status={a.spf} />
                    <AuthBadge label="DKIM" status={a.dkim} />
                    <AuthBadge label="DMARC" status={a.dmarc} />
                    <span className="ml-auto text-xs text-muted-foreground tabular">
                      {formatNumber(a.dailyLimit)}/day limit
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">
                      Reputation
                    </span>
                    <Progress
                      value={a.reputationScore}
                      color={repColor(a.reputationScore)}
                    />
                    <span
                      className="w-8 shrink-0 text-right text-xs font-semibold tabular"
                      style={{ color: repColor(a.reputationScore) }}
                    >
                      {a.reputationScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} size="md">
        <DialogHeader
          title="Add sending account"
          description="Configure a new sending identity for outbound campaigns."
          onClose={() => setOpen(false)}
        />
        <DialogBody className="space-y-4">
          <Field label="Label" hint="An internal name to identify this account.">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Lucas — Primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From name">
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Lucas Nadon"
              />
            </Field>
            <Field label="From email">
              <Input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="lucas@avarent.ai"
                type="email"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider">
              <Select
                value={provider}
                onChange={(e) => setProvider(e.target.value as SendingProvider)}
              >
                <option value="resend">Resend</option>
                <option value="smtp">SMTP</option>
              </Select>
            </Field>
            <Field label="Daily limit">
              <Input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            New accounts start with warmup enabled and a baseline reputation of 75. Authentication
            (SPF/DKIM/DMARC) will verify after DNS records are detected.
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            Add account
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function repColor(score: number) {
  return score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--destructive)";
}

/* ============================ Opportunity Scoring ============================ */

const SCORING_FIELDS: { field: ScoringField; label: string }[] = [
  { field: "industry", label: "Industry" },
  { field: "employeeEstimate", label: "Company size" },
  { field: "aiAdoption", label: "AI adoption signal" },
  { field: "lendingRelevance", label: "Lending relevance" },
  { field: "previousEngagement", label: "Prior engagement" },
  { field: "emailValidity", label: "Email validity" },
  { field: "hasLinkedin", label: "LinkedIn profile" },
  { field: "techStack", label: "Tech stack" },
];

const SCORING_OPERATORS: { operator: ScoringOperator; label: string }[] = [
  { operator: "equals", label: "equals" },
  { operator: "in", label: "is one of" },
  { operator: "gte", label: "≥" },
  { operator: "lte", label: "≤" },
  { operator: "exists", label: "is present" },
  { operator: "contains", label: "contains" },
];

function ScoringTab() {
  const scoring = useStore((s) => s.scoring);
  const updateScoring = useStore((s) => s.updateScoring);

  // Editable draft config held locally; committed via updateScoring (recomputes scores).
  const [draft, setDraft] = React.useState<ScoringConfig>(() => structuredClone(scoring));

  React.useEffect(() => {
    setDraft(structuredClone(scoring));
  }, [scoring]);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(scoring),
    [draft, scoring],
  );

  const enabledTotal = React.useMemo(
    () => draft.rules.filter((r) => r.enabled).reduce((sum, r) => sum + r.points, 0),
    [draft.rules],
  );

  const patchRule = (id: string, patch: Partial<ScoringRule>) =>
    setDraft((d) => ({ ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const removeRule = (id: string) =>
    setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));

  const addRule = () =>
    setDraft((d) => ({
      ...d,
      rules: [
        ...d.rules,
        {
          id: `r_${nanoid(6)}`,
          label: "New rule",
          field: "industry",
          operator: "equals",
          value: "",
          points: 10,
          enabled: true,
        },
      ],
    }));

  const save = () => {
    updateScoring(draft);
    toast.success("Scoring rules saved — scores recomputed");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <Target className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Opportunity scores are <span className="font-medium text-foreground">deterministic and
          fully explainable</span>. Each enabled rule contributes fixed points when it matches; the
          raw total is normalized against the max score to produce a 0–100 score. No AI or hidden
          weighting.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Rules" value={formatNumber(draft.rules.length)} />
        <MiniStat
          label="Enabled"
          value={formatNumber(draft.rules.filter((r) => r.enabled).length)}
          color="var(--success)"
        />
        <MiniStat label="Max points possible" value={formatNumber(draft.maxScore)} />
        <MiniStat label="Enabled points" value={formatNumber(enabledTotal)} />
      </div>

      <Card>
        <div className="flex items-center justify-between p-5 pb-3">
          <SectionTitle className="mb-0">Scoring rules</SectionTitle>
          <Button variant="outline" onClick={addRule}>
            <Plus className="size-4" /> Add rule
          </Button>
        </div>
        <CardContent className="space-y-3 p-5 pt-0">
          {draft.rules.length === 0 ? (
            <EmptyState
              icon={<Target className="size-8" />}
              title="No scoring rules"
              description="Add a rule to start scoring opportunities."
              action={
                <Button variant="outline" onClick={addRule}>
                  <Plus className="size-4" /> Add rule
                </Button>
              }
            />
          ) : (
            draft.rules.map((rule) => {
              const share =
                draft.maxScore > 0 && rule.enabled
                  ? Math.max(0, (rule.points / draft.maxScore) * 100)
                  : 0;
              const needsValue = rule.operator !== "exists";
              return (
                <div
                  key={rule.id}
                  className={cn(
                    "rounded-lg border border-border p-4",
                    !rule.enabled && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => patchRule(rule.id, { enabled: v })}
                    />
                    <Input
                      value={rule.label}
                      onChange={(e) => patchRule(rule.id, { label: e.target.value })}
                      className="h-8 flex-1 font-medium"
                      placeholder="Rule label"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRule(rule.id)}
                      aria-label="Remove rule"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                    <div className="space-y-1">
                      <Label>Field</Label>
                      <Select
                        value={rule.field}
                        onChange={(e) =>
                          patchRule(rule.id, { field: e.target.value as ScoringField })
                        }
                        className="h-8"
                      >
                        {SCORING_FIELDS.map((f) => (
                          <option key={f.field} value={f.field}>
                            {f.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Operator</Label>
                      <Select
                        value={rule.operator}
                        onChange={(e) =>
                          patchRule(rule.id, { operator: e.target.value as ScoringOperator })
                        }
                        className="h-8 w-full min-w-24"
                      >
                        {SCORING_OPERATORS.map((o) => (
                          <option key={o.operator} value={o.operator}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>{needsValue ? "Value" : "Value (n/a)"}</Label>
                      <Input
                        value={rule.value}
                        onChange={(e) => patchRule(rule.id, { value: e.target.value })}
                        className="h-8"
                        disabled={!needsValue}
                        placeholder={needsValue ? "Comparison target" : "—"}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Points</Label>
                      <Input
                        type="number"
                        value={rule.points}
                        onChange={(e) => patchRule(rule.id, { points: Number(e.target.value) })}
                        className="h-8 w-20 tabular"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">
                      Contribution
                    </span>
                    <Progress value={share} color="var(--primary)" />
                    <span className="w-12 shrink-0 text-right text-xs font-medium tabular">
                      {rule.enabled ? `${Math.round(share)}%` : "off"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes — saving recomputes all contact scores." : "All rules saved."}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => setDraft(structuredClone(scoring))}
          >
            Discard
          </Button>
          <Button disabled={!dirty} onClick={save}>
            <Save className="size-4" /> Save & recompute
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================ Snippets ============================ */

function SnippetsTab() {
  const snippets = useStore((s) => s.snippets);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4">
        <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">
          Snippets expand a short trigger into reusable content while composing emails. Type the
          trigger (e.g. <code className="rounded bg-muted px-1 py-0.5 font-mono">/demo</code>) in the
          editor to insert the snippet.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between p-5 pb-3">
          <SectionTitle className="mb-0">Snippets</SectionTitle>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add snippet
          </Button>
        </div>
        <CardContent className="p-5 pt-0">
          {snippets.length === 0 ? (
            <EmptyState
              icon={<Zap className="size-8" />}
              title="No snippets yet"
              description="Create a snippet to speed up repetitive typing."
            />
          ) : (
            <div className="space-y-2">
              {snippets.map((sn) => (
                <div
                  key={sn.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <Badge variant="muted" className="font-mono">
                    {sn.trigger}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{sn.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{sn.content}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} size="sm">
        <DialogHeader
          title="Add snippet"
          description="Snippets have no dedicated setter in this demo — this is a preview."
          onClose={() => setOpen(false)}
        />
        <DialogBody className="space-y-4">
          <Field label="Trigger" hint="Start with a slash, e.g. /pricing.">
            <Input placeholder="/pricing" className="font-mono" />
          </Field>
          <Field label="Label">
            <Input placeholder="Pricing page" />
          </Field>
          <Field label="Content">
            <Textarea placeholder="https://avarent.ai/pricing" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              toast.success("Snippet preview created");
            }}
          >
            Add snippet
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

/* ============================ Activity Log ============================ */

function ActivityTab() {
  const activities = useStore((s) => s.activities);
  const users = useStore((s) => s.users);
  const recent = React.useMemo(() => activities.slice(0, 30), [activities]);
  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  return (
    <Card>
      <CardContent className="p-5">
        <SectionTitle>Audit log</SectionTitle>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Last {recent.length} events across the workspace.
        </p>
        {recent.length === 0 ? (
          <EmptyState
            icon={<History className="size-8" />}
            title="No activity yet"
            description="Actions across the workspace will appear here."
          />
        ) : (
          <div className="space-y-0.5">
            {recent.map((a) => {
              const meta = ACTIVITY_META[a.type];
              const Icon = (Icons[meta.icon as keyof typeof Icons] ??
                Zap) as React.ComponentType<{ className?: string }>;
              const actor = a.actorId ? userById.get(a.actorId) : undefined;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/60"
                >
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)`,
                    }}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="truncate">{a.summary}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {titleCase(a.type.replace(/_/g, " "))}
                    </span>
                  </div>
                  {actor && (
                    <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                      <Avatar name={actor.name} color={actor.avatarColor} size={18} />
                      {actor.name}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {relativeTime(a.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================ Shared field wrapper ============================ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
