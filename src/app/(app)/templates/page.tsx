"use client";

import * as React from "react";
import { useStore, useSnapshot } from "@/lib/store";
import { templateStats, type TemplateStat } from "@/lib/engines/analytics";
import { renderTemplate, extractVariables, type MergeContext } from "@/lib/engines/merge";
import { PageHeader, SectionTitle, MiniStat } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, Avatar, Separator } from "@/components/ui/misc";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { TEMPLATE_CATEGORY_META, TEMPLATE_VARIABLES } from "@/lib/constants";
import type { EmailTemplate, TemplateCategory, Snippet } from "@/lib/types";
import { cn, formatPercent, formatNumber, relativeTime, wordCount } from "@/lib/utils";
import {
  FileText,
  Plus,
  MoreVertical,
  Archive,
  Copy,
  Save,
  Eye,
  Braces,
  Hash,
  AlertTriangle,
  Check,
  Reply,
  CalendarCheck,
  Sparkles,
  Type,
  Send,
} from "lucide-react";

const CATEGORY_ORDER: TemplateCategory[] = [
  "initial",
  "follow_up",
  "breakup",
  "referral",
  "meeting_confirmation",
  "custom",
];

export default function TemplatesPage() {
  const snap = useSnapshot();
  const templates = useStore((s) => s.templates);
  const snippets = useStore((s) => s.snippets);
  const contacts = useStore((s) => s.contacts);
  const companies = useStore((s) => s.companies);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);

  const sender = users.find((u) => u.id === currentUserId);

  const active = React.useMemo(() => templates.filter((t) => !t.archived), [templates]);

  const stats = React.useMemo(() => {
    const map = new Map<string, TemplateStat>();
    for (const s of templateStats(snap)) map.set(s.templateId, s);
    return map;
  }, [snap]);

  const [category, setCategory] = React.useState<string>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);

  // Keep a valid selection.
  React.useEffect(() => {
    if (active.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !active.some((t) => t.id === selectedId)) {
      setSelectedId(active[0].id);
    }
  }, [active, selectedId]);

  const selected = active.find((t) => t.id === selectedId) ?? null;

  const filtered = React.useMemo(() => {
    const list = category === "all" ? active : active.filter((t) => t.category === category);
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [active, category]);

  const grouped = React.useMemo(() => {
    const g = new Map<TemplateCategory, EmailTemplate[]>();
    for (const t of filtered) {
      const arr = g.get(t.category) ?? [];
      arr.push(t);
      g.set(t.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => g.has(c)).map((c) => [c, g.get(c)!] as const);
  }, [filtered]);

  const tabs = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of active) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    return [
      { value: "all", label: "All", count: active.length },
      ...CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
        value: c,
        label: TEMPLATE_CATEGORY_META[c].label,
        count: counts.get(c) ?? 0,
      })),
    ];
  }, [active]);

  // Sample merge context: first contact + its company + current user as sender.
  const sampleCtx = React.useMemo<MergeContext>(() => {
    const contact = contacts[0];
    const company = contact ? companies.find((c) => c.id === contact.companyId) : companies[0];
    return {
      contact: contact
        ? {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            jobTitle: contact.jobTitle,
          }
        : { firstName: "Alex", lastName: "Rivera", email: "alex@example.com", jobTitle: "VP of Lending" },
      company: company
        ? { name: company.name, industry: company.industry, website: company.website, domain: company.domain }
        : { name: "Northgate Credit Union", industry: "Credit Union", website: undefined, domain: "northgatecu.com" },
      sender: sender ? { name: sender.name } : undefined,
    };
  }, [contacts, companies, sender]);

  const sampleLabel = React.useMemo(() => {
    const contact = contacts[0];
    const company = contact ? companies.find((c) => c.id === contact.companyId) : undefined;
    if (!contact) return "Sample contact";
    return `${contact.firstName} ${contact.lastName}${company ? ` · ${company.name}` : ""}`;
  }, [contacts, companies]);

  function createTemplate(name: string, cat: TemplateCategory) {
    const tpl = addTemplate({ name, category: cat, subject: "", body: "" });
    setSelectedId(tpl.id);
    setNewOpen(false);
    setCategory("all");
  }

  function duplicate(t: EmailTemplate) {
    const tpl = addTemplate({
      name: `${t.name} (copy)`,
      category: t.category,
      subject: t.subject,
      body: t.body,
      tags: t.tags,
    });
    setSelectedId(tpl.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Reusable email copy with merge variables and snippets — ranked by reply rate."
        icon={FileText}
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> New template
          </Button>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-8" />}
          title="No templates yet"
          description="Create your first email template to reuse across campaigns and sequences."
          action={
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New template
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ------------------------------ Left: list ------------------------------ */}
          <div className="space-y-3">
            <Tabs tabs={tabs} value={category} onValueChange={setCategory} variant="pills" className="flex-wrap" />
            <div className="space-y-4">
              {grouped.map(([cat, list]) => (
                <div key={cat}>
                  <div className="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">
                    {TEMPLATE_CATEGORY_META[cat].label}
                  </div>
                  <div className="space-y-1.5">
                    {list.map((t) => {
                      const st = stats.get(t.id);
                      const selectedRow = t.id === selectedId;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedId(t.id)}
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition-colors",
                            selectedRow
                              ? "border-primary/50 bg-accent"
                              : "border-border bg-card hover:bg-accent/60",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-sm font-medium">{t.name}</span>
                            {st && st.sent > 0 && (
                              <Badge variant={replyVariant(st.replyRate)} className="shrink-0">
                                <Reply className="size-3" />
                                {formatPercent(st.replyRate, 0)}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{t.subject || "No subject"}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="tabular">{st ? formatNumber(st.sent) : 0} sent</span>
                            <span aria-hidden>·</span>
                            <span className="tabular">{wordCount(t.body)} words</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------------------------- Right: editor ---------------------------- */}
          {selected ? (
            <TemplateEditor
              key={selected.id}
              template={selected}
              stat={stats.get(selected.id)}
              snippets={snippets}
              sampleCtx={sampleCtx}
              sampleLabel={sampleLabel}
              onSave={(patch) => updateTemplate(selected.id, patch)}
              onArchive={() => deleteTemplate(selected.id)}
              onDuplicate={() => duplicate(selected)}
            />
          ) : (
            <EmptyState title="Select a template" description="Pick a template from the list to edit it." />
          )}
        </div>
      )}

      {/* ------------------------------ Snippets ------------------------------ */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle>Snippets</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">
            Type a trigger inside a template body to expand it into the full content on send.
          </p>
          {snippets.length === 0 ? (
            <EmptyState title="No snippets" className="py-8" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snippets.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                      {s.trigger}
                    </code>
                    <span className="truncate text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="mt-2 truncate text-xs text-muted-foreground">{s.content}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewTemplateDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={createTemplate} />
    </div>
  );
}

/* ============================== Editor ============================== */

function TemplateEditor({
  template,
  stat,
  snippets,
  sampleCtx,
  sampleLabel,
  onSave,
  onArchive,
  onDuplicate,
}: {
  template: EmailTemplate;
  stat?: TemplateStat;
  snippets: Snippet[];
  sampleCtx: MergeContext;
  sampleLabel: string;
  onSave: (patch: Partial<EmailTemplate>) => void;
  onArchive: () => void;
  onDuplicate: () => void;
}) {
  const [name, setName] = React.useState(template.name);
  const [category, setCategory] = React.useState<TemplateCategory>(template.category);
  const [subject, setSubject] = React.useState(template.subject);
  const [body, setBody] = React.useState(template.body);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const dirty =
    name !== template.name ||
    category !== template.category ||
    subject !== template.subject ||
    body !== template.body;

  function save() {
    if (!name.trim() || !dirty) return;
    onSave({ name: name.trim(), category, subject, body });
  }

  function appendToBody(text: string) {
    setBody((prev) => {
      const needsSpace = prev.length > 0 && !/\s$/.test(prev);
      return prev + (needsSpace ? " " : "") + text;
    });
    // Keep focus on the body so users can keep typing.
    requestAnimationFrame(() => bodyRef.current?.focus());
  }

  // Live preview (snippets first, then variables) — deterministic.
  const preview = React.useMemo(() => renderTemplate(body, sampleCtx, snippets), [body, sampleCtx, snippets]);
  const subjectPreview = React.useMemo(
    () => renderTemplate(subject, sampleCtx, snippets),
    [subject, sampleCtx, snippets],
  );

  const usedVars = React.useMemo(
    () => [...new Set([...extractVariables(subject), ...extractVariables(body)])],
    [subject, body],
  );
  const validTokens = new Set(TEMPLATE_VARIABLES.map((v) => v.token.replace(/[{}]/g, "")));
  const unknownVars = usedVars.filter((v) => !validTokens.has(v));
  const missing = React.useMemo(
    () => [...new Set([...preview.missing, ...subjectPreview.missing])],
    [preview.missing, subjectPreview.missing],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{TEMPLATE_CATEGORY_META[template.category].label}</Badge>
          <span className="text-xs text-muted-foreground">
            v{template.version} · updated {relativeTime(template.updatedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={save} disabled={!dirty || !name.trim()}>
            <Save className="size-4" /> {dirty ? "Save" : "Saved"}
          </Button>
          <Dropdown
            trigger={
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <MoreVertical className="size-4" />
              </Button>
            }
          >
            <DropdownItem icon={<Copy />} onClick={onDuplicate}>
              Duplicate
            </DropdownItem>
            <DropdownItem icon={<Archive />} destructive onClick={onArchive}>
              Archive
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <CardContent className="p-4 pt-4">
        {/* Performance mini stats */}
        {stat && stat.sent > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Sent" value={formatNumber(stat.sent)} />
            <MiniStat label="Reply rate" value={formatPercent(stat.replyRate, 1)} color="var(--chart-1)" />
            <MiniStat label="Positive" value={formatPercent(stat.positiveRate, 1)} color="var(--success)" />
            <MiniStat label="Meetings" value={formatPercent(stat.meetingRate, 1)} color="var(--chart-5)" />
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {/* -------- Left: form -------- */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Name</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-cat">Category</Label>
                <Select
                  id="tpl-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {TEMPLATE_CATEGORY_META[c].label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input
                id="tpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Quick question about {{company}}"
              />
            </div>

            {/* Toolbar */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Braces className="size-3.5" /> Variables
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => appendToBody(v.token)}
                    className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:bg-accent"
                    title={v.label}
                  >
                    {v.token}
                  </button>
                ))}
              </div>
              {snippets.length > 0 && (
                <>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Hash className="size-3.5" /> Snippets
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {snippets.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => appendToBody(s.trigger)}
                        className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:bg-accent"
                        title={s.content}
                      >
                        {s.trigger}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Body</Label>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Hi {{first_name}},&#10;&#10;Write your message here…"
                className="min-h-[220px] font-[inherit] leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tabular">{wordCount(body)} words</span>
                <span>Type a snippet like {snippets[0]?.trigger ?? "/demo"} to expand it</span>
              </div>
            </div>

            {/* Used / missing variables */}
            <div className="flex flex-wrap items-center gap-1.5">
              {usedVars.length === 0 ? (
                <span className="text-xs text-muted-foreground">No variables used</span>
              ) : (
                usedVars.map((v) => {
                  const isMissing = missing.includes(v);
                  const isUnknown = unknownVars.includes(v);
                  return (
                    <Badge
                      key={v}
                      variant={isUnknown ? "destructive" : isMissing ? "warning" : "muted"}
                      title={
                        isUnknown
                          ? "Unknown variable — will render literally"
                          : isMissing
                            ? "No value in sample data — uses a fallback"
                            : "Resolved from sample data"
                      }
                    >
                      {isUnknown ? (
                        <AlertTriangle className="size-3" />
                      ) : isMissing ? (
                        <AlertTriangle className="size-3" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      {`{{${v}}}`}
                    </Badge>
                  );
                })
              )}
            </div>
          </div>

          {/* -------- Right: live preview -------- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Eye className="size-3.5" /> Live preview
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{sampleLabel}</span>
            </div>

            <div className="rounded-lg border border-border bg-background">
              <div className="flex items-center gap-2.5 border-b border-border p-3">
                <Avatar name={sampleCtx.sender?.name ?? "You"} color="var(--primary)" size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {subjectPreview.text || <span className="text-muted-foreground">No subject</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    To: {sampleCtx.contact.email}
                  </div>
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {preview.text.trim() ? (
                  preview.text
                ) : (
                  <span className="text-muted-foreground">Write a body to see the preview.</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border p-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Type className="size-3.5" />
                  <span className="tabular">{preview.words} words</span>
                </span>
                {missing.length > 0 ? (
                  <span className="flex items-center gap-1 text-warning">
                    <AlertTriangle className="size-3.5" />
                    {missing.length} using fallback
                  </span>
                ) : usedVars.length > 0 ? (
                  <span className="flex items-center gap-1 text-success">
                    <Check className="size-3.5" /> all resolved
                  </span>
                ) : null}
              </div>
            </div>

            <Separator className="my-1" />

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {category === "meeting_confirmation" ? (
                <CalendarCheck className="size-3.5" />
              ) : category === "initial" ? (
                <Send className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Preview merges live against sample data — real sends personalize per recipient.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ========================= New template dialog ========================= */

function NewTemplateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, category: TemplateCategory) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<TemplateCategory>("initial");

  React.useEffect(() => {
    if (open) {
      setName("");
      setCategory("initial");
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <DialogHeader title="New template" description="Give it a name and category to start editing." onClose={onClose} />
      <DialogBody className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Name</Label>
          <Input
            id="new-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lending intro — v2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onCreate(name.trim(), category);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-cat">Category</Label>
          <Select id="new-cat" value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {TEMPLATE_CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onCreate(name.trim(), category)} disabled={!name.trim()}>
          <Plus className="size-4" /> Create
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/* --------------------------------- helpers -------------------------------- */

function replyVariant(rate: number): "success" | "warning" | "muted" {
  if (rate >= 0.08) return "success";
  if (rate >= 0.03) return "warning";
  return "muted";
}
