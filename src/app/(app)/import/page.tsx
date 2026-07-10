"use client";

import * as React from "react";
import Link from "next/link";
import Papa from "papaparse";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import {
  IMPORT_FIELDS,
  guessField,
  normalizeRows,
  parseWebsiteList,
  summarizeImport,
  type ImportField,
  type NormalizedRow,
} from "@/lib/engines/import";
import { PageHeader, StatCard } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea, Label, Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import type { EmailValidity } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  Globe,
  ClipboardPaste,
  Check,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Users,
  FileUp,
  RotateCcw,
  Table2,
} from "lucide-react";

/* ------------------------------- constants -------------------------------- */

type SourceMode = "paste-csv" | "upload" | "website" | "paste-rows";

const SOURCE_TABS: { value: SourceMode; label: string }[] = [
  { value: "paste-csv", label: "Paste CSV/TSV" },
  { value: "upload", label: "Upload file" },
  { value: "website", label: "Website list" },
  { value: "paste-rows", label: "Paste rows" },
];

const STEPS = [
  { key: "source", label: "Source", icon: ClipboardPaste },
  { key: "map", label: "Map columns", icon: Table2 },
  { key: "preview", label: "Preview & validate", icon: FileSpreadsheet },
  { key: "import", label: "Import", icon: Upload },
] as const;

const VALIDITY_META: Record<EmailValidity, { label: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
  valid: { label: "Valid", variant: "success" },
  risky: { label: "Risky", variant: "warning" },
  invalid: { label: "Invalid", variant: "destructive" },
  unknown: { label: "Unknown", variant: "muted" },
};

const SAMPLE_CSV = `first_name,last_name,email,company,title,website,industry
Jordan,Reyes,jordan@northbeam.io,Northbeam,VP Sales,northbeam.io,Software
Priya,Nair,priya.nair@lattice.dev,Lattice,Head of Growth,https://lattice.dev,Software
Marco,Silva,marco@,Silva Logistics,COO,silvalogistics.com,Logistics`;

/* --------------------------------- page ----------------------------------- */

export default function ImportPage() {
  const importContacts = useStore((s) => s.importContacts);

  const [step, setStep] = React.useState(0);
  const [mode, setMode] = React.useState<SourceMode>("paste-csv");

  // raw input
  const [pasteText, setPasteText] = React.useState("");
  const [websiteText, setWebsiteText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);

  // parsed tabular data (CSV/TSV/upload/paste-rows)
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<ImportField[]>([]);

  // website-list normalized rows (skip mapping step)
  const [siteRows, setSiteRows] = React.useState<NormalizedRow[]>([]);

  // import result
  const [result, setResult] = React.useState<{ created: number; duplicates: number; companiesCreated: number } | null>(null);

  const isWebsite = mode === "website";

  const resetSource = React.useCallback(() => {
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setSiteRows([]);
    setResult(null);
  }, []);

  /* ---- parsing ---- */

  function parseTabular(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      resetSource();
      return;
    }
    const parsed = Papa.parse<string[]>(trimmed, {
      skipEmptyLines: "greedy",
      delimiter: "", // auto-detect (handles comma + tab)
    });
    const data = (parsed.data as string[][]).filter((r) => r.some((c) => c && c.trim()));
    if (data.length === 0) {
      resetSource();
      return;
    }
    const hdrs = data[0].map((h) => (h ?? "").trim());
    const body = data.slice(1);
    setHeaders(hdrs);
    setRows(body);
    setMapping(hdrs.map((h) => guessField(h)));
    setSiteRows([]);
    setResult(null);
  }

  function handlePasteChange(v: string) {
    setPasteText(v);
    parseTabular(v);
  }

  function handleWebsiteChange(v: string) {
    setWebsiteText(v);
    const normalized = parseWebsiteList(v);
    setSiteRows(normalized);
    setResult(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      setPasteText(text);
      parseTabular(text);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error("Could not read file");
    }
    // allow re-selecting the same file
    e.target.value = "";
  }

  function loadSample() {
    setPasteText(SAMPLE_CSV);
    parseTabular(SAMPLE_CSV);
    toast.success("Sample data loaded");
  }

  /* ---- derived ---- */

  const normalized = React.useMemo<NormalizedRow[]>(() => {
    if (isWebsite) return siteRows;
    if (headers.length === 0) return [];
    return normalizeRows(headers, rows, mapping);
  }, [isWebsite, siteRows, headers, rows, mapping]);

  const summary = React.useMemo(() => summarizeImport(normalized), [normalized]);

  const hasEmailMapped = isWebsite ? false : mapping.includes("email");
  const sourceReady = normalized.length > 0;

  /* ---- navigation ---- */

  function goToStep(target: number) {
    // website mode skips step 1 (map columns)
    setStep(target);
  }

  function nextFromSource() {
    if (!sourceReady) return;
    if (isWebsite) goToStep(2);
    else goToStep(1);
  }

  function backFromPreview() {
    if (isWebsite) goToStep(0);
    else goToStep(1);
  }

  function runImport() {
    if (normalized.length === 0) return;
    const res = importContacts(
      normalized
        .filter((r) => (r.email && r.emailValidity !== "invalid") || r.domain)
        .map((r) => ({
          contact: {
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            emailValidity: r.emailValidity,
            jobTitle: r.jobTitle || undefined,
            linkedinUrl: r.linkedinUrl || undefined,
            phone: r.phone || undefined,
          },
          company: {
            name: r.company || undefined,
            domain: r.domain,
            website: r.website || undefined,
            industry: r.industry || undefined,
          },
        })),
    );
    setResult(res);
    goToStep(3);
    const parts: string[] = [];
    if (res.created > 0 || res.companiesCreated === 0) {
      parts.push(`${res.created} lead${res.created === 1 ? "" : "s"}`);
    }
    if (res.companiesCreated > 0) {
      parts.push(`${res.companiesCreated} compan${res.companiesCreated === 1 ? "y" : "ies"}`);
    }
    toast.success(`Imported ${parts.join(" · ")}`);
  }

  function startOver() {
    setStep(0);
    setPasteText("");
    setWebsiteText("");
    setFileName(null);
    resetSource();
  }

  const stepsForMode = React.useMemo(
    () => (isWebsite ? STEPS.filter((s) => s.key !== "map") : STEPS),
    [isWebsite],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import leads"
        description="Bring contacts into Avarent from a CSV, a file, or a list of company websites."
        icon={FileUp}
        actions={
          step > 0 && !result ? (
            <Button variant="ghost" onClick={startOver}>
              <RotateCcw className="size-4" /> Start over
            </Button>
          ) : undefined
        }
      />

      {/* Stepper */}
      <Stepper steps={stepsForMode} activeKey={STEPS[step].key} />

      {/* Step 1 — Source */}
      {step === 0 && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <Tabs
                tabs={SOURCE_TABS}
                value={mode}
                variant="pills"
                onValueChange={(v) => {
                  setMode(v as SourceMode);
                  resetSource();
                }}
              />
              {sourceReady && (
                <Badge variant="info" dot="var(--info)">
                  {formatNumber(normalized.length)} row{normalized.length === 1 ? "" : "s"} detected
                </Badge>
              )}
            </div>

            {mode === "paste-csv" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Paste comma- or tab-separated data (first row = headers)</Label>
                  <button
                    onClick={loadSample}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Load sample
                  </button>
                </div>
                <Textarea
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder={"first_name,last_name,email,company\nAda,Lovelace,ada@analytical.io,Analytical Engines"}
                  className="min-h-[220px] font-mono text-xs"
                />
              </div>
            )}

            {mode === "upload" && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-14 text-center transition-colors hover:bg-muted/50">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {fileName ? fileName : "Click to upload a CSV file"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fileName && sourceReady
                      ? `${formatNumber(rows.length)} rows · ${headers.length} columns`
                      : ".csv, .tsv or .txt — parsed locally, nothing leaves your browser"}
                  </p>
                </div>
                <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={handleFile} />
                <span className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium">
                  Choose file
                </span>
              </label>
            )}

            {mode === "website" && (
              <div className="space-y-2">
                <Label>One company website or domain per line</Label>
                <Textarea
                  value={websiteText}
                  onChange={(e) => handleWebsiteChange(e.target.value)}
                  placeholder={"acme.com\nhttps://stripe.com\nnorthbeam.io"}
                  className="min-h-[220px] font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll create a company record per domain. You can enrich and add contacts later.
                </p>
              </div>
            )}

            {mode === "paste-rows" && (
              <div className="space-y-2">
                <Label>Paste rows (tab-separated works great from a spreadsheet — first row = headers)</Label>
                <Textarea
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder={"first_name\tlast_name\temail\tcompany"}
                  className="min-h-[220px] font-mono text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {sourceReady
                  ? isWebsite
                    ? "Ready — continue to preview."
                    : "Ready — continue to map columns."
                  : "Add some data to continue."}
              </p>
              <Button onClick={nextFromSource} disabled={!sourceReady}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Map columns (tabular only) */}
      {step === 1 && !isWebsite && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Map columns</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We guessed a field for each column. Adjust anything that looks off. Set columns you don&apos;t need to
                &ldquo;Ignore&rdquo;.
              </p>
            </div>

            {headers.length === 0 ? (
              <EmptyState title="No columns detected" description="Go back and add data." />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {headers.map((h, i) => {
                  const sample = rows.find((r) => r[i] && r[i].trim())?.[i]?.trim();
                  return (
                    <div
                      key={`${h}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" title={h}>
                          {h || <span className="text-muted-foreground">Column {i + 1}</span>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground" title={sample}>
                          {sample ? `e.g. ${sample}` : "empty"}
                        </div>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                      <Select
                        value={mapping[i]}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = e.target.value as ImportField;
                          setMapping(next);
                        }}
                        className={cn(
                          "h-8 w-40 shrink-0 text-xs",
                          mapping[i] === "ignore" && "text-muted-foreground",
                        )}
                      >
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.field} value={f.field}>
                            {f.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasEmailMapped && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span>
                  No column is mapped to <span className="font-medium">Email</span>. Rows without an email can&apos;t be
                  imported as contacts.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button variant="outline" onClick={() => goToStep(0)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button onClick={() => goToStep(2)}>
                Preview <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Preview & validate */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total rows" value={formatNumber(summary.total)} icon={Table2} accent="var(--chart-2)" />
            <StatCard label="Valid" value={formatNumber(summary.valid)} icon={CheckCircle2} accent="var(--success)" />
            <StatCard label="Invalid" value={formatNumber(summary.invalid)} icon={AlertTriangle} accent="var(--destructive)" />
            <StatCard label="Dupes in file" value={formatNumber(summary.duplicatesInFile)} icon={Copy} accent="var(--warning)" />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">Preview</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Rows with errors are highlighted and skipped on import.
                  </p>
                </div>
                <Badge variant={summary.invalid > 0 ? "warning" : "success"}>
                  {formatNumber(summary.valid)} importable
                </Badge>
              </div>

              {normalized.length === 0 ? (
                <EmptyState
                  className="m-4"
                  title="Nothing to preview"
                  description="Go back and add some data to import."
                />
              ) : (
                <div className="max-h-[440px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Email</th>
                        <th className="px-4 py-2 font-medium">Company</th>
                        <th className="px-4 py-2 font-medium">Domain</th>
                        <th className="px-4 py-2 font-medium">Title</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalized.slice(0, 200).map((r, i) => {
                        const bad = r.errors.length > 0;
                        const vm = VALIDITY_META[r.emailValidity];
                        const name = `${r.firstName} ${r.lastName}`.trim();
                        return (
                          <tr
                            key={i}
                            className={cn(
                              "border-b border-border/60 last:border-0",
                              bad && "bg-destructive/5",
                            )}
                          >
                            <td className="px-4 py-2">
                              {name || <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span className={cn("tabular", bad && "text-destructive")}>
                                  {r.email || <span className="text-muted-foreground">missing</span>}
                                </span>
                                {r.email && (
                                  <Badge variant={vm.variant} className="text-[10px]">
                                    {vm.label}
                                  </Badge>
                                )}
                              </div>
                              {bad && (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
                                  <AlertTriangle className="size-3" />
                                  {r.errors.join(" · ")}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {r.company || <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2 tabular text-muted-foreground">
                              {r.domain || "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {r.jobTitle || "—"}
                            </td>
                            <td className="px-4 py-2">
                              {bad ? (
                                <Badge variant="destructive">Skip</Badge>
                              ) : (
                                <Badge variant="success" dot="var(--success)">
                                  Ready
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {normalized.length > 200 && (
                    <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
                      Showing first 200 of {formatNumber(normalized.length)} rows
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={backFromPreview}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button onClick={runImport} disabled={summary.valid === 0} variant="success">
              <Upload className="size-4" /> Import {formatNumber(summary.valid)} lead
              {summary.valid === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Import result */}
      {step === 3 && result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Import complete</h2>
              <p className="text-sm text-muted-foreground">
                Your leads are in the pipeline and scored.
              </p>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 text-left">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users className="size-3.5 text-success" /> Created
                </div>
                <div className="mt-1 text-2xl font-semibold tabular text-success">
                  {formatNumber(result.created)}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    lead{result.created === 1 ? "" : "s"}
                  </span>
                </div>
                {result.companiesCreated > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    · {formatNumber(result.companiesCreated)} compan
                    {result.companiesCreated === 1 ? "y" : "ies"}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-left">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Copy className="size-3.5 text-warning" /> Duplicates skipped
                </div>
                <div className="mt-1 text-2xl font-semibold tabular text-muted-foreground">
                  {formatNumber(result.duplicates)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" onClick={startOver}>
                <FileUp className="size-4" /> Import more
              </Button>
              <Link href="/leads">
                <Button>
                  View leads <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------- Stepper --------------------------------- */

function Stepper({
  steps,
  activeKey,
}: {
  steps: readonly { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  activeKey: string;
}) {
  const activeIndex = steps.findIndex((s) => s.key === activeKey);
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-success bg-success/15 text-success",
                  !active && !done && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className="whitespace-nowrap">
                <div className="text-[11px] font-medium text-muted-foreground">Step {i + 1}</div>
                <div
                  className={cn(
                    "-mt-0.5 text-sm font-medium",
                    active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px min-w-6 flex-1 sm:min-w-10",
                  done ? "bg-success" : "bg-border",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
