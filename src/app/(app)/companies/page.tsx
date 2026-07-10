"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { COMPANY_STATUS_META, INDUSTRIES } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/utils";
import {
  Building2,
  Search,
  Globe,
  Users,
  ExternalLink,
  Radar,
  LayoutGrid,
  Rows3,
  MapPin,
  CheckCircle2,
  CircleDashed,
  Loader2,
} from "lucide-react";
import type { Company, CompanyStatus } from "@/lib/types";

/* ---- crawl status presentation -------------------------------------------- */
const CRAWL_META: Record<
  NonNullable<Company["enrichment"]["crawlStatus"]>,
  { label: string; variant: "success" | "warning" | "muted" | "info" | "destructive"; icon: React.ComponentType<{ className?: string }> }
> = {
  never: { label: "Not crawled", variant: "muted", icon: CircleDashed },
  queued: { label: "Queued", variant: "info", icon: Loader2 },
  crawling: { label: "Crawling", variant: "warning", icon: Loader2 },
  done: { label: "Crawled", variant: "success", icon: CheckCircle2 },
  error: { label: "Error", variant: "destructive", icon: CircleDashed },
};

type ViewMode = "grid" | "table";

export default function CompaniesPage() {
  const companies = useStore((s) => s.companies);
  const contacts = useStore((s) => s.contacts);
  const users = useStore((s) => s.users);
  const runCrawl = useStore((s) => s.runCrawl);

  const [query, setQuery] = React.useState("");
  const [industry, setIndustry] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [view, setView] = React.useState<ViewMode>("grid");

  // contacts count by company
  const contactCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contacts) map.set(c.companyId, (map.get(c.companyId) ?? 0) + 1);
    return map;
  }, [contacts]);

  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // saved-view chips (status quick filters + a "crawled" set) computed deterministically
  const savedViewChips = React.useMemo(() => {
    const statuses: CompanyStatus[] = ["prospect", "engaged", "opportunity", "customer", "lost"];
    return [
      { key: "all", label: "All companies", count: companies.length },
      ...statuses.map((st) => ({
        key: st,
        label: COMPANY_STATUS_META[st].label,
        count: companies.filter((c) => c.status === st).length,
      })),
    ];
  }, [companies]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies
      .filter((c) => {
        if (industry !== "all" && (c.industry ?? "") !== industry) return false;
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.domain.toLowerCase().includes(q) ||
          (c.industry ?? "").toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (contactCounts.get(b.id) ?? 0) - (contactCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [companies, query, industry, statusFilter, contactCounts]);

  // headline stats
  const stats = React.useMemo(() => {
    const crawled = companies.filter((c) => c.enrichment.crawlStatus === "done").length;
    const opportunities = companies.filter((c) => c.status === "opportunity").length;
    const customers = companies.filter((c) => c.status === "customer").length;
    return { total: companies.length, crawled, opportunities, customers };
  }, [companies]);

  const handleCrawl = (c: Company) => {
    runCrawl(c.id);
    toast.success(`Crawling ${c.domain}…`, { description: "Enrichment updated from the latest crawl." });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Every account in your book — enrichment, contacts, and pipeline at a glance."
        icon={Building2}
        actions={
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" /> Grid
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Rows3 className="size-3.5" /> Table
            </button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Companies" value={formatNumber(stats.total)} icon={Building2} accent="var(--primary)" />
        <StatCard label="Crawled" value={formatNumber(stats.crawled)} sublabel="enriched" icon={Radar} accent="var(--info)" />
        <StatCard label="Opportunities" value={formatNumber(stats.opportunities)} icon={Users} accent="var(--chart-1)" />
        <StatCard label="Customers" value={formatNumber(stats.customers)} icon={CheckCircle2} accent="var(--success)" />
      </div>

      {/* Saved-view chips */}
      <div className="flex flex-wrap items-center gap-2">
        {savedViewChips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setStatusFilter(chip.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === chip.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {chip.label}
            <span className="tabular opacity-70">{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Search + industry filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, domains, tags…"
            className="pl-9"
          />
        </div>
        <Select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-52">
          <option value="all">All industries</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground tabular">
          {formatNumber(filtered.length)} of {formatNumber(companies.length)}
        </span>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-8" />}
          title="No companies match"
          description="Try clearing filters or adjusting your search."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setIndustry("all");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const owner = c.ownerId ? userById.get(c.ownerId) : undefined;
            const count = contactCounts.get(c.id) ?? 0;
            const crawl = CRAWL_META[c.enrichment.crawlStatus ?? "never"];
            const CrawlIcon = crawl.icon;
            const statusMeta = COMPANY_STATUS_META[c.status];
            return (
              <Card key={c.id} className="group relative overflow-hidden p-4 transition-shadow hover:shadow-md">
                <Link href={`/companies/${c.id}`} className="absolute inset-0 z-10" aria-label={c.name} />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold tracking-tight">{c.name}</div>
                    <a
                      href={c.website ?? `https://${c.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="relative z-20 mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                    >
                      <Globe className="size-3" />
                      {c.domain}
                    </a>
                  </div>
                  <Badge variant="outline" dot={statusMeta.color}>
                    {statusMeta.label}
                  </Badge>
                </div>

                <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
                  {c.industry && <Badge variant="secondary">{c.industry}</Badge>}
                  {c.enrichment.employeeEstimate && (
                    <Badge variant="muted">
                      <Users className="size-3" />
                      {c.enrichment.employeeEstimate}
                    </Badge>
                  )}
                  {c.enrichment.hq && (
                    <Badge variant="muted">
                      <MapPin className="size-3" />
                      {c.enrichment.hq}
                    </Badge>
                  )}
                </div>

                <div className="relative mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {owner ? (
                      <>
                        <Avatar name={owner.name} color={owner.avatarColor} size={22} />
                        <span className="truncate">{owner.name}</span>
                      </>
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <Users className="size-3" />
                      {count}
                    </Badge>
                    <Badge variant={crawl.variant}>
                      <CrawlIcon className="size-3" />
                      {crawl.label}
                    </Badge>
                  </div>
                </div>

                <div className="relative z-20 mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCrawl(c);
                    }}
                  >
                    <Radar className="size-3.5" /> Crawl
                  </Button>
                  <Link href={`/companies/${c.id}`} className="relative z-20">
                    <Button variant="ghost" size="sm">
                      Open <ExternalLink className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Industry</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Size</th>
                  <th className="px-4 py-2.5 text-right font-medium">Contacts</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Crawl</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const owner = c.ownerId ? userById.get(c.ownerId) : undefined;
                  const count = contactCounts.get(c.id) ?? 0;
                  const crawl = CRAWL_META[c.enrichment.crawlStatus ?? "never"];
                  const CrawlIcon = crawl.icon;
                  const statusMeta = COMPANY_STATUS_META[c.status];
                  return (
                    <tr key={c.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/companies/${c.id}`} className="font-medium hover:text-primary hover:underline">
                          {c.name}
                        </Link>
                        <a
                          href={c.website ?? `https://${c.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          <Globe className="size-3" />
                          {c.domain}
                        </a>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.industry ? <Badge variant="secondary">{c.industry}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" dot={statusMeta.color}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular">{c.enrichment.employeeEstimate ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular">{count}</td>
                      <td className="px-4 py-2.5">
                        {owner ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={owner.name} color={owner.avatarColor} size={22} />
                            <span className="truncate text-xs">{owner.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={crawl.variant}>
                          <CrawlIcon className="size-3" />
                          {crawl.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="outline" size="sm" onClick={() => handleCrawl(c)}>
                          <Radar className="size-3.5" /> Crawl
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
