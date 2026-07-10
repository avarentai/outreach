"use client";

import * as React from "react";
import { Command } from "cmdk";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import {
  Building2,
  Users,
  Megaphone,
  FileText,
  CalendarDays,
  Search,
  CornerDownLeft,
  Plus,
} from "lucide-react";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => setMounted(true), []);

  const companies = useStore((s) => s.companies);
  const contacts = useStore((s) => s.contacts);
  const campaigns = useStore((s) => s.campaigns);
  const templates = useStore((s) => s.templates);
  const meetings = useStore((s) => s.meetings);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
      <Command
        label="Global command menu"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-in"
        filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            autoFocus
            placeholder="Search companies, leads, campaigns, or jump to…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Quick actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <Item value="new lead create contact" onSelect={() => go("/leads?new=1")} icon={<Plus className="size-4" />}>
              Create new lead
            </Item>
            <Item value="new campaign" onSelect={() => go("/campaigns?new=1")} icon={<Plus className="size-4" />}>
              New campaign
            </Item>
            <Item value="import leads csv" onSelect={() => go("/import")} icon={<Plus className="size-4" />}>
              Import leads
            </Item>
          </Command.Group>

          <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            {ALL_NAV_ITEMS.map((n) => (
              <Item key={n.href} value={`go ${n.label}`} onSelect={() => go(n.href)} icon={<n.icon className="size-4" />}>
                {n.label}
              </Item>
            ))}
          </Command.Group>

          {query.length > 0 && (
            <>
              <Command.Group heading="Companies" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {companies.slice(0, 60).map((c) => (
                  <Item key={c.id} value={`${c.name} ${c.domain} ${c.industry}`} onSelect={() => go(`/companies/${c.id}`)} icon={<Building2 className="size-4" />}>
                    {c.name}
                    <span className="ml-2 text-xs text-muted-foreground">{c.domain}</span>
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Leads" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {contacts.slice(0, 100).map((c) => (
                  <Item key={c.id} value={`${c.firstName} ${c.lastName} ${c.email} ${c.jobTitle}`} onSelect={() => go(`/leads/${c.id}`)} icon={<Users className="size-4" />}>
                    {c.firstName} {c.lastName}
                    <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Campaigns" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {campaigns.map((c) => (
                  <Item key={c.id} value={`campaign ${c.name}`} onSelect={() => go(`/campaigns/${c.id}`)} icon={<Megaphone className="size-4" />}>
                    {c.name}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Templates" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {templates.filter((t) => !t.archived).map((t) => (
                  <Item key={t.id} value={`template ${t.name} ${t.subject}`} onSelect={() => go(`/templates`)} icon={<FileText className="size-4" />}>
                    {t.name}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Meetings" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {meetings.slice(0, 30).map((m) => (
                  <Item key={m.id} value={`meeting ${m.title}`} onSelect={() => go(`/meetings`)} icon={<CalendarDays className="size-4" />}>
                    {m.title}
                  </Item>
                ))}
              </Command.Group>
            </>
          )}
        </Command.List>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" /> to select
          </span>
          <span>Global search</span>
        </div>
      </Command>
    </div>,
    document.body,
  );
}

function Item({
  children,
  value,
  onSelect,
  icon,
}: {
  children: React.ReactNode;
  value: string;
  onSelect: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-accent [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="flex items-center truncate">{children}</span>
    </Command.Item>
  );
}
