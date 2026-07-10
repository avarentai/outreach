"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Contact, PipelineStage, SavedView, FilterClause } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/types";
import { STAGE_META, INDUSTRIES } from "@/lib/constants";
import { PageHeader } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Avatar, EmptyState, Separator } from "@/components/ui/misc";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { cn, formatNumber, relativeTime, avatarColor } from "@/lib/utils";
import {
  Users,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Download,
  Trash2,
  UserCheck,
  GitBranch,
  Tag as TagIcon,
  Megaphone,
  X,
  Bookmark,
} from "lucide-react";

/* --------------------------- validity presentation --------------------------- */

const VALIDITY_COLOR: Record<Contact["emailValidity"], string> = {
  valid: "var(--success)",
  risky: "var(--warning)",
  invalid: "var(--destructive)",
  unknown: "var(--muted-foreground)",
};

const VALIDITY_LABEL: Record<Contact["emailValidity"], string> = {
  valid: "Valid",
  risky: "Risky",
  invalid: "Invalid",
  unknown: "Unknown",
};

function stageVariant(stage: PipelineStage): "success" | "destructive" | "info" | "warning" | "muted" | "secondary" {
  if (stage === "customer") return "success";
  if (stage === "closed_lost") return "destructive";
  if (stage === "qualified") return "info";
  if (stage === "proposal_sent") return "warning";
  if (stage === "new") return "muted";
  return "secondary";
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 40) return "var(--warning)";
  if (score > 0) return "var(--muted-foreground)";
  return "var(--muted-foreground)";
}

type SortKey =
  | "name"
  | "company"
  | "jobTitle"
  | "email"
  | "stage"
  | "score"
  | "owner"
  | "lastContactedAt"
  | "nextFollowUpAt";

const MAX_ROWS = 200;

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const campaigns = useStore((s) => s.campaigns);
  const savedViews = useStore((s) => s.savedViews);
  const currentUserId = useStore((s) => s.currentUserId);

  const addContact = useStore((s) => s.addContact);
  const addCompany = useStore((s) => s.addCompany);
  const bulkUpdateContacts = useStore((s) => s.bulkUpdateContacts);
  const deleteContacts = useStore((s) => s.deleteContacts);
  const moveStage = useStore((s) => s.moveStage);

  const companyById = React.useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const contactViews = React.useMemo(
    () => savedViews.filter((v) => v.entity === "contacts"),
    [savedViews],
  );

  /* ------------------------------- toolbar state ------------------------------ */
  const [query, setQuery] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<string>("all");
  const [industryFilter, setIndustryFilter] = React.useState<string>("all");
  const [ownerFilter, setOwnerFilter] = React.useState<string>("all");
  const [activeView, setActiveView] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "score",
    dir: "desc",
  });
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* --------------------------------- add lead -------------------------------- */
  const [addOpen, setAddOpen] = React.useState(false);
  React.useEffect(() => {
    if (searchParams.get("new") === "1") setAddOpen(true);
  }, [searchParams]);

  /* --------------------------- saved-view application ------------------------- */
  function applyView(view: SavedView) {
    if (activeView === view.id) {
      // toggle off
      setActiveView(null);
      setStageFilter("all");
      return;
    }
    setActiveView(view.id);
    // reset simple filters then apply the view's clauses we understand
    setStageFilter("all");
    for (const f of view.filters) {
      if (f.field === "stage" && f.operator === "eq" && typeof f.value === "string") {
        setStageFilter(f.value);
      }
    }
  }

  function viewMatches(contact: Contact, view: SavedView): boolean {
    return view.filters.every((f: FilterClause) => {
      if (f.field === "nextFollowUpAt" && f.operator === "not_empty")
        return Boolean(contact.nextFollowUpAt);
      if (f.field === "score" && f.operator === "gte")
        return contact.score >= Number(f.value);
      if (f.field === "stage" && f.operator === "eq")
        return contact.stage === f.value;
      return true;
    });
  }

  /* ------------------------------- filtered rows ------------------------------ */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const view = activeView ? contactViews.find((v) => v.id === activeView) : null;
    return contacts.filter((c) => {
      const company = companyById.get(c.companyId);
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (ownerFilter !== "all" && c.ownerId !== ownerFilter) return false;
      if (industryFilter !== "all" && company?.industry !== industryFilter) return false;
      if (view && !viewMatches(c, view)) return false;
      if (q) {
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${company?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, query, stageFilter, ownerFilter, industryFilter, activeView, contactViews, companyById]);

  /* -------------------------------- sorted rows ------------------------------- */
  const sorted = React.useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (c: Contact): string | number => {
      const company = companyById.get(c.companyId);
      switch (sort.key) {
        case "name":
          return `${c.firstName} ${c.lastName}`.toLowerCase();
        case "company":
          return (company?.name ?? "").toLowerCase();
        case "jobTitle":
          return (c.jobTitle ?? "").toLowerCase();
        case "email":
          return c.email.toLowerCase();
        case "stage":
          return PIPELINE_STAGES.indexOf(c.stage);
        case "score":
          return c.score;
        case "owner":
          return (userById.get(c.ownerId ?? "")?.name ?? "").toLowerCase();
        case "lastContactedAt":
          return c.lastContactedAt ? new Date(c.lastContactedAt).getTime() : 0;
        case "nextFollowUpAt":
          return c.nextFollowUpAt ? new Date(c.nextFollowUpAt).getTime() : 0;
        default:
          return 0;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, companyById, userById]);

  const rows = sorted.slice(0, MAX_ROWS);
  const truncated = sorted.length > MAX_ROWS;

  // prune selection to visible rows
  const visibleIds = React.useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const selectedVisible = React.useMemo(
    () => [...selected].filter((id) => visibleIds.has(id)),
    [selected, visibleIds],
  );
  const allSelected = rows.length > 0 && selectedVisible.length === rows.length;

  function toggleAll() {
    setSelected(() => (allSelected ? new Set() : new Set(rows.map((r) => r.id))));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function setSortKey(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const hasFilters =
    query.trim() !== "" ||
    stageFilter !== "all" ||
    industryFilter !== "all" ||
    ownerFilter !== "all" ||
    activeView !== null;

  function resetFilters() {
    setQuery("");
    setStageFilter("all");
    setIndustryFilter("all");
    setOwnerFilter("all");
    setActiveView(null);
  }

  /* ------------------------------ bulk operations ----------------------------- */
  function bulkAssignOwner(ownerId: string) {
    bulkUpdateContacts(selectedVisible, { ownerId });
    toast.success(`Assigned ${selectedVisible.length} leads to ${userById.get(ownerId)?.name ?? "owner"}`);
  }
  function bulkAssignCampaign(campaignId: string) {
    bulkUpdateContacts(selectedVisible, { campaignId });
    toast.success(`Moved ${selectedVisible.length} leads to campaign`);
  }
  function bulkStage(stage: PipelineStage) {
    selectedVisible.forEach((id) => moveStage(id, stage));
    toast.success(`Updated stage for ${selectedVisible.length} leads`);
  }
  function bulkDelete() {
    const n = selectedVisible.length;
    deleteContacts(selectedVisible);
    clearSelection();
    toast.success(`Deleted ${n} lead${n === 1 ? "" : "s"}`);
  }

  const [tagOpen, setTagOpen] = React.useState(false);
  const [tagValue, setTagValue] = React.useState("");
  function applyTag() {
    const tag = tagValue.trim();
    if (!tag) return;
    selectedVisible.forEach((id) => {
      const c = contacts.find((x) => x.id === id);
      if (c && !c.tags.includes(tag)) {
        bulkUpdateContacts([id], { tags: [...c.tags, tag] });
      }
    });
    toast.success(`Tagged ${selectedVisible.length} leads "${tag}"`);
    setTagValue("");
    setTagOpen(false);
  }

  function exportCsv() {
    const targetIds = selectedVisible.length ? new Set(selectedVisible) : null;
    const list = targetIds ? rows.filter((r) => targetIds.has(r.id)) : rows;
    const headers = [
      "First name",
      "Last name",
      "Email",
      "Email validity",
      "Company",
      "Job title",
      "Stage",
      "Score",
      "Owner",
      "Last contacted",
      "Next follow-up",
    ];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(",")];
    for (const c of list) {
      const company = companyById.get(c.companyId);
      lines.push(
        [
          c.firstName,
          c.lastName,
          c.email,
          c.emailValidity,
          company?.name ?? "",
          c.jobTitle ?? "",
          STAGE_META[c.stage].label,
          String(c.score),
          userById.get(c.ownerId ?? "")?.name ?? "",
          c.lastContactedAt ?? "",
          c.nextFollowUpAt ?? "",
        ]
          .map(esc)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} lead${list.length === 1 ? "" : "s"} to CSV`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`${formatNumber(contacts.length)} contacts across ${formatNumber(companies.length)} companies`}
        icon={Users}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add lead
            </Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or company…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setActiveView(null);
            }}
            className="w-auto min-w-36"
          >
            <option value="all">All stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_META[s].label}
              </option>
            ))}
          </Select>
          <Select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="w-auto min-w-36"
          >
            <option value="all">All industries</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
          <Select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="w-auto min-w-32"
          >
            <option value="all">All owners</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>

        {/* Saved views */}
        {contactViews.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bookmark className="size-3.5" /> Views
            </span>
            {contactViews.map((v) => (
              <button
                key={v.id}
                onClick={() => applyView(v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  activeView === v.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedVisible.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2 border-primary/40 bg-primary/5 p-2.5">
          <span className="px-1.5 text-sm font-medium tabular">
            {selectedVisible.length} selected
          </span>
          <Separator orientation="vertical" className="h-5" />

          <Dropdown
            align="start"
            trigger={
              <Button variant="outline" size="sm">
                <UserCheck className="size-3.5" /> Assign owner
              </Button>
            }
          >
            <DropdownLabel>Assign owner</DropdownLabel>
            {users.map((u) => (
              <DropdownItem key={u.id} onClick={() => bulkAssignOwner(u.id)}>
                <Avatar name={u.name} color={u.avatarColor} size={18} /> {u.name}
              </DropdownItem>
            ))}
          </Dropdown>

          <Dropdown
            align="start"
            trigger={
              <Button variant="outline" size="sm">
                <Megaphone className="size-3.5" /> Campaign
              </Button>
            }
          >
            <DropdownLabel>Add to campaign</DropdownLabel>
            {campaigns.length === 0 && <DropdownItem disabled>No campaigns</DropdownItem>}
            {campaigns.map((c) => (
              <DropdownItem key={c.id} onClick={() => bulkAssignCampaign(c.id)}>
                {c.name}
              </DropdownItem>
            ))}
          </Dropdown>

          <Dropdown
            align="start"
            trigger={
              <Button variant="outline" size="sm">
                <GitBranch className="size-3.5" /> Stage
              </Button>
            }
          >
            <DropdownLabel>Update stage</DropdownLabel>
            {PIPELINE_STAGES.map((s) => (
              <DropdownItem key={s} onClick={() => bulkStage(s)}>
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: STAGE_META[s].color }}
                />
                {STAGE_META[s].label}
              </DropdownItem>
            ))}
          </Dropdown>

          <Button variant="outline" size="sm" onClick={() => setTagOpen(true)}>
            <TagIcon className="size-3.5" /> Add tag
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5" /> Export
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Deselect
            </Button>
            <Button variant="destructive" size="sm" onClick={bulkDelete}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title={hasFilters ? "No leads match your filters" : "No leads yet"}
          description={
            hasFilters
              ? "Try adjusting your search or filters to find leads."
              : "Add your first lead to start building your pipeline."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> Add lead
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="size-3.5 cursor-pointer accent-[var(--primary)]"
                      aria-label="Select all"
                    />
                  </th>
                  <SortHeader label="Name" k="name" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Company" k="company" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Title" k="jobTitle" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Email" k="email" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Stage" k="stage" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Score" k="score" sort={sort} onSort={setSortKey} align="right" />
                  <SortHeader label="Owner" k="owner" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Last contacted" k="lastContactedAt" sort={sort} onSort={setSortKey} />
                  <SortHeader label="Next follow-up" k="nextFollowUpAt" sort={sort} onSort={setSortKey} />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const company = companyById.get(c.companyId);
                  const owner = userById.get(c.ownerId ?? "");
                  const isSel = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-border/60 transition-colors last:border-0 hover:bg-accent/50",
                        isSel && "bg-primary/5",
                      )}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(c.id)}
                          className="size-3.5 cursor-pointer accent-[var(--primary)]"
                          aria-label={`Select ${c.firstName} ${c.lastName}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/leads/${c.id}`}
                          className="flex items-center gap-2 font-medium hover:text-primary"
                        >
                          <Avatar
                            name={`${c.firstName} ${c.lastName}`}
                            color={avatarColor(`${c.firstName} ${c.lastName}`)}
                            size={26}
                          />
                          <span className="truncate">
                            {c.firstName} {c.lastName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {company ? (
                          <Link
                            href={`/companies/${company.id}`}
                            className="truncate hover:text-primary hover:underline"
                          >
                            {company.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-40 truncate px-3 py-2 text-muted-foreground">
                        {c.jobTitle ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: VALIDITY_COLOR[c.emailValidity] }}
                            title={VALIDITY_LABEL[c.emailValidity]}
                          />
                          <span className="max-w-48 truncate text-muted-foreground">{c.email}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={stageVariant(c.stage)}>{STAGE_META[c.stage].short}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className="font-semibold tabular"
                          style={{ color: scoreColor(c.score) }}
                        >
                          {c.score}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {owner ? (
                          <span
                            className="flex items-center gap-1.5 text-muted-foreground"
                            title={owner.name}
                          >
                            <Avatar name={owner.name} color={owner.avatarColor} size={20} />
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground tabular">
                        {c.lastContactedAt ? relativeTime(c.lastContactedAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular">
                        {c.nextFollowUpAt ? (
                          <span className="text-foreground">{relativeTime(c.nextFollowUpAt)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span className="tabular">
              Showing {formatNumber(rows.length)} of {formatNumber(sorted.length)} leads
            </span>
            {truncated && (
              <span className="tabular">
                Capped at {MAX_ROWS} rows — refine filters to see more
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Add-tag dialog */}
      <Dialog open={tagOpen} onClose={() => setTagOpen(false)} size="sm">
        <DialogHeader
          title="Add tag"
          description={`Apply a tag to ${selectedVisible.length} selected leads.`}
          onClose={() => setTagOpen(false)}
        />
        <DialogBody>
          <Label htmlFor="tag-input">Tag</Label>
          <Input
            id="tag-input"
            autoFocus
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyTag()}
            placeholder="e.g. hot-lead, q3-target"
            className="mt-1.5"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTagOpen(false)}>
            Cancel
          </Button>
          <Button onClick={applyTag} disabled={!tagValue.trim()}>
            Apply tag
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add-lead dialog */}
      <AddLeadDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          if (searchParams.get("new")) router.replace("/leads");
        }}
        addContact={addContact}
        addCompany={addCompany}
        companies={companies}
        defaultOwnerId={currentUserId}
      />
    </div>
  );
}

/* -------------------------------- sort header -------------------------------- */

function SortHeader({
  label,
  k,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === k;
  return (
    <th className={cn("px-3 py-2.5 font-medium", align === "right" && "text-right")}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

/* ------------------------------- add-lead dialog ------------------------------ */

function AddLeadDialog({
  open,
  onClose,
  addContact,
  addCompany,
  companies,
  defaultOwnerId,
}: {
  open: boolean;
  onClose: () => void;
  addContact: ReturnType<typeof useStore.getState>["addContact"];
  addCompany: ReturnType<typeof useStore.getState>["addCompany"];
  companies: ReturnType<typeof useStore.getState>["companies"];
  defaultOwnerId: string;
}) {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [companyMode, setCompanyMode] = React.useState<"existing" | "new">(
    companies.length ? "existing" : "new",
  );
  const [companyId, setCompanyId] = React.useState<string>(companies[0]?.id ?? "");
  const [newCompanyName, setNewCompanyName] = React.useState("");
  const [newCompanyDomain, setNewCompanyDomain] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setJobTitle("");
      setCompanyMode(companies.length ? "existing" : "new");
      setCompanyId(companies[0]?.id ?? "");
      setNewCompanyName("");
      setNewCompanyDomain("");
    }
  }, [open, companies]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    emailValid &&
    (companyMode === "existing"
      ? Boolean(companyId)
      : newCompanyName.trim() && newCompanyDomain.trim());

  function submit() {
    if (!canSubmit) return;
    let targetCompanyId = companyId;
    if (companyMode === "new") {
      const domain = newCompanyDomain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
      const co = addCompany({ name: newCompanyName.trim(), domain });
      targetCompanyId = co.id;
    }
    addContact({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      companyId: targetCompanyId,
      jobTitle: jobTitle.trim() || undefined,
      ownerId: defaultOwnerId,
      emailValidity: "unknown",
    });
    toast.success(`Added ${firstName.trim()} ${lastName.trim()}`);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader
        title="Add lead"
        description="Create a new contact and attach it to a company."
        onClose={onClose}
      />
      <DialogBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="al-first">First name</Label>
            <Input
              id="al-first"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="al-last">Last name</Label>
            <Input
              id="al-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Cooper"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="al-email">Email</Label>
          <Input
            id="al-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="mt-1.5"
          />
          {email && !emailValid && (
            <p className="mt-1 text-xs text-destructive">Enter a valid email address.</p>
          )}
        </div>

        <div>
          <Label htmlFor="al-title">Job title</Label>
          <Input
            id="al-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="VP of Lending"
            className="mt-1.5"
          />
        </div>

        <Separator />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Company</Label>
            <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
              <button
                onClick={() => setCompanyMode("existing")}
                disabled={companies.length === 0}
                className={cn(
                  "px-2.5 py-1 transition-colors disabled:opacity-40",
                  companyMode === "existing"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                Existing
              </button>
              <button
                onClick={() => setCompanyMode("new")}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  companyMode === "new"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                New
              </button>
            </div>
          </div>

          {companyMode === "existing" ? (
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.domain}
                </option>
              ))}
            </Select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Company name"
              />
              <Input
                value={newCompanyDomain}
                onChange={(e) => setNewCompanyDomain(e.target.value)}
                placeholder="company.com"
              />
            </div>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          Add lead
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
