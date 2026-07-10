"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { simulateCrawl } from "@/lib/engines/crawl-sim";
import { normalizeDomain } from "@/lib/engines/crawler";
import type { CrawlResult, CrawlPage } from "@/lib/types";
import { PageHeader, SectionTitle, StatCard } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState, Separator, Avatar } from "@/components/ui/misc";
import { formatNumber, relativeTime, cn } from "@/lib/utils";
import {
  Globe,
  Search,
  Mail,
  Radar,
  Building2,
  Link2,
  Cpu,
  FileText,
  ShieldCheck,
  Users,
  Briefcase,
  Info,
  Contact as ContactIcon,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";

/* ------------------------------- meta maps -------------------------------- */

const PAGE_TYPE_META: Record<
  CrawlPage["type"],
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  home: { label: "Home", variant: "muted" },
  about: { label: "About", variant: "info" },
  contact: { label: "Contact", variant: "success" },
  careers: { label: "Careers", variant: "warning" },
  team: { label: "Team", variant: "secondary" },
  product: { label: "Product", variant: "default" },
  other: { label: "Other", variant: "outline" },
};

const CRAWL_STATUS_META: Record<
  NonNullable<import("@/lib/types").CompanyEnrichment["crawlStatus"]>,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"]; dot: string }
> = {
  never: { label: "Never crawled", variant: "muted", dot: "var(--muted-foreground)" },
  queued: { label: "Queued", variant: "info", dot: "var(--info)" },
  crawling: { label: "Crawling", variant: "warning", dot: "var(--warning)" },
  done: { label: "Crawled", variant: "success", dot: "var(--success)" },
  error: { label: "Error", variant: "destructive", dot: "var(--destructive)" },
};

const TECH_CATEGORY_COLOR: Record<string, string> = {
  Framework: "var(--chart-1)",
  CMS: "var(--chart-2)",
  Analytics: "var(--chart-3)",
  Marketing: "var(--chart-4)",
  CRM: "var(--chart-5)",
  Support: "var(--chart-6)",
  Infra: "var(--info)",
  Ecommerce: "var(--warning)",
  Payments: "var(--success)",
  AI: "var(--primary)",
};

/* ================================ page =================================== */

export default function CrawlerPage() {
  const companies = useStore((s) => s.companies);
  const runCrawl = useStore((s) => s.runCrawl);

  const [domainInput, setDomainInput] = React.useState("");
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("");
  const [result, setResult] = React.useState<CrawlResult | null>(null);
  const [crawling, setCrawling] = React.useState(false);

  const crawledCompanies = React.useMemo(
    () =>
      companies
        .filter((c) => c.enrichment.lastCrawledAt)
        .sort(
          (a, b) =>
            new Date(b.enrichment.lastCrawledAt!).getTime() -
            new Date(a.enrichment.lastCrawledAt!).getTime(),
        ),
    [companies],
  );

  const totalEmailsDiscovered = React.useMemo(
    () => companies.reduce((sum, c) => sum + (c.enrichment.discoveredEmails?.length ?? 0), 0),
    [companies],
  );

  function handleCrawlDomain(e?: React.FormEvent) {
    e?.preventDefault();
    const domain = normalizeDomain(domainInput);
    if (!domain || !domain.includes(".")) {
      toast.error("Enter a valid domain, e.g. acme.com");
      return;
    }
    setCrawling(true);
    // Defer so the loading spinner paints; the crawl itself stays synchronous.
    setTimeout(() => {
      // Deterministic — regex + HTML-signature parsing. No network, no LLM.
      const res = simulateCrawl(domain);
      setResult(res);
      setCrawling(false);
      toast.success(
        `Crawled ${domain} — ${res.emailsFound.length} emails across ${res.pagesCrawled} pages`,
      );
    }, 300);
  }

  function handleCrawlCompany() {
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (!company) {
      toast.error("Select a company to enrich");
      return;
    }
    runCrawl(company.id);
    const res = simulateCrawl(company.domain);
    setResult(res);
    setDomainInput(company.domain);
    toast.success(`Enriched ${company.name} — ${res.emailsFound.length} emails found`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website Crawler"
        description="Discover emails, tech stack, and key pages from any domain."
        icon={Radar}
        actions={
          <Badge variant="muted" className="gap-1.5">
            <ShieldCheck className="size-3.5 text-success" />
            100% deterministic · no LLM
          </Badge>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Companies enriched"
          value={formatNumber(crawledCompanies.length)}
          sublabel={`of ${companies.length} total`}
          icon={Building2}
          accent="var(--chart-1)"
        />
        <StatCard
          label="Emails discovered"
          value={formatNumber(totalEmailsDiscovered)}
          icon={Mail}
          accent="var(--success)"
        />
        <StatCard
          label="Last crawl"
          value={
            crawledCompanies[0]?.enrichment.lastCrawledAt
              ? relativeTime(crawledCompanies[0].enrichment.lastCrawledAt)
              : "—"
          }
          sublabel={crawledCompanies[0]?.name}
          icon={Globe}
          accent="var(--chart-4)"
        />
        <StatCard
          label="This crawl"
          value={result ? formatNumber(result.emailsFound.length) : "—"}
          sublabel={result ? `${result.pagesCrawled} pages parsed` : "no active crawl"}
          icon={Search}
          accent="var(--primary)"
        />
      </div>

      {/* Crawl controls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <SectionTitle>Crawl a domain</SectionTitle>
            <form onSubmit={handleCrawlDomain} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="domain">Domain or URL</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="domain"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="acme.com"
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                  <Button type="submit" disabled={crawling}>
                    {crawling ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    Crawl
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Fetches home, about, contact, careers &amp; team pages, then extracts emails via
                regex and detects tech from HTML signatures.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <SectionTitle>Enrich an existing company</SectionTitle>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <div className="flex gap-2">
                  <Select
                    id="company"
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Select a company…</option>
                    {companies
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.domain}
                        </option>
                      ))}
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={handleCrawlCompany}
                    disabled={!selectedCompanyId}
                  >
                    <Radar className="size-4" />
                    Enrich
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Writes discovered emails, tech stack, social links and key page URLs back onto the
                company record.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results panel */}
      {result ? (
        <CrawlResultPanel result={result} />
      ) : (
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={<Radar className="size-8" />}
              title="No crawl yet"
              description="Enter a domain above or pick a company to see discovered pages, emails, social links and detected tech."
            />
          </CardContent>
        </Card>
      )}

      {/* Recent crawls across companies */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle
            action={
              <Link href="/companies" className="text-xs text-primary hover:underline">
                All companies
              </Link>
            }
          >
            Recent crawls
          </SectionTitle>
          {crawledCompanies.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-7" />}
              title="No companies enriched yet"
              description="Enrich a company above to build up crawl history here."
              className="py-10"
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Emails</th>
                    <th className="px-3 py-2 text-right font-medium">Tech</th>
                    <th className="px-3 py-2 text-right font-medium">Crawled</th>
                  </tr>
                </thead>
                <tbody>
                  {crawledCompanies.map((c) => {
                    const status = CRAWL_STATUS_META[c.enrichment.crawlStatus ?? "done"];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-accent/50"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.name} size={26} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{c.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {c.domain}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={status.variant} dot={status.dot}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">
                          {formatNumber(c.enrichment.discoveredEmails?.length ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">
                          {formatNumber(c.enrichment.techStack?.length ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                          {c.enrichment.lastCrawledAt
                            ? relativeTime(c.enrichment.lastCrawledAt)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------- result panel ------------------------------- */

function CrawlResultPanel({ result }: { result: CrawlResult }) {
  const findings = React.useMemo(() => {
    const byType = (t: CrawlPage["type"]) => result.pages.find((p) => p.type === t);
    return {
      emails: [...new Set(result.emailsFound)],
      contact: byType("contact"),
      about: byType("about"),
      careers: byType("careers"),
      team: byType("team"),
    };
  }, [result]);

  const techByCategory = React.useMemo(() => {
    const groups = new Map<string, typeof result.techStack>();
    for (const t of result.techStack) {
      const arr = groups.get(t.category) ?? [];
      arr.push(t);
      groups.set(t.category, arr);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [result]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-primary">
              <Globe className="size-4.5" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                {result.domain}
                <a
                  href={`https://${result.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </h2>
              <p className="text-xs text-muted-foreground">
                {result.pagesCrawled} pages parsed · {result.emailsFound.length} emails ·{" "}
                {result.techStack.length} technologies
              </p>
            </div>
          </div>
          <Badge variant="success" className="gap-1.5">
            <Sparkles className="size-3.5" />
            Crawl complete
          </Badge>
        </div>

        {/* Findings summary */}
        <SectionTitle>Findings</SectionTitle>
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <FindingTile
            icon={ContactIcon}
            label="Contact page"
            found={!!findings.contact}
            href={findings.contact?.url}
          />
          <FindingTile icon={Info} label="About page" found={!!findings.about} href={findings.about?.url} />
          <FindingTile
            icon={Briefcase}
            label="Careers page"
            found={!!findings.careers}
            href={findings.careers?.url}
          />
          <FindingTile icon={Users} label="Team page" found={!!findings.team} href={findings.team?.url} />
          <FindingTile
            icon={Mail}
            label="Emails found"
            found={findings.emails.length > 0}
            value={formatNumber(findings.emails.length)}
          />
        </div>

        {/* Discovered pages table */}
        <SectionTitle>Discovered pages</SectionTitle>
        <div className="mb-5 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">URL</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Emails</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.pages.map((p) => {
                const meta = PAGE_TYPE_META[p.type];
                return (
                  <tr
                    key={p.url}
                    className="border-b border-border last:border-0 transition-colors hover:bg-accent/50"
                  >
                    <td className="px-3 py-2.5">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 font-medium hover:text-primary hover:underline"
                      >
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.title ?? p.url}</span>
                      </a>
                      <div className="ml-5 truncate text-xs text-muted-foreground">{p.url}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.emails.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.emails.map((em) => (
                            <span
                              key={em}
                              className="rounded bg-muted px-1.5 py-0.5 text-xs tabular"
                            >
                              {em}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "tabular text-xs font-medium",
                          p.status >= 200 && p.status < 300
                            ? "text-success"
                            : p.status >= 400
                              ? "text-destructive"
                              : "text-warning",
                        )}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Emails deduped */}
          <div>
            <SectionTitle>Emails found ({findings.emails.length})</SectionTitle>
            {findings.emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No email addresses discovered.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {findings.emails.map((em) => (
                  <a
                    key={em}
                    href={`mailto:${em}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs tabular transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Mail className="size-3" />
                    {em}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Social links */}
          <div>
            <SectionTitle>Social links ({result.socialLinks.length})</SectionTitle>
            {result.socialLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No social profiles detected.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {result.socialLinks.map((s) => (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs capitalize transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <Link2 className="size-3" />
                    {s.platform}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <Separator className="my-5" />

        {/* Tech stack */}
        <SectionTitle>Detected tech stack ({result.techStack.length})</SectionTitle>
        {result.techStack.length === 0 ? (
          <p className="text-sm text-muted-foreground">No technologies detected.</p>
        ) : (
          <div className="space-y-3">
            {techByCategory.map(([category, techs]) => {
              const color = TECH_CATEGORY_COLOR[category] ?? "var(--muted-foreground)";
              return (
                <div key={category}>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Cpu className="size-3.5" style={{ color }} />
                    {category}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {techs.map((t) => (
                      <Badge key={t.name} variant="outline" dot={color}>
                        {t.name}
                        <span className="ml-1 text-muted-foreground tabular">
                          {Math.round(t.confidence * 100)}%
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Deterministic note */}
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span>
            <span className="font-medium text-foreground">100% deterministic.</span> Emails are
            extracted with regex, pages are classified by URL patterns, and the tech stack is
            inferred from HTML signatures — no LLM or AI is used anywhere in this crawl.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- finding tile ----------------------------- */

function FindingTile({
  icon: Icon,
  label,
  found,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  found: boolean;
  value?: string;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-lg border p-3 transition-colors",
        found ? "border-border bg-card" : "border-dashed border-border bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon
          className="size-4"
          style={{ color: found ? "var(--primary)" : "var(--muted-foreground)" }}
        />
        {value !== undefined ? (
          <span className="text-lg font-semibold tabular">{value}</span>
        ) : (
          <span
            className={cn(
              "size-2 rounded-full",
              found ? "bg-success" : "bg-muted-foreground/40",
            )}
          />
        )}
      </div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("text-xs", found ? "text-success" : "text-muted-foreground/70")}>
        {found ? "Identified" : "Not found"}
      </div>
    </div>
  );
  return found && href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-90">
      {inner}
    </a>
  ) : (
    inner
  );
}
