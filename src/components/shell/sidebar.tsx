"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const followUpsDue = useStore((s) => s.followUps.filter((f) => f.status === "due").length);
  const inboxUnread = useStore((s) => s.threads.filter((t) => t.unread && t.state === "open").length);
  const workspace = useStore((s) => s.workspace);

  const badgeValue = (key?: "followUpsDue" | "inboxUnread") =>
    key === "followUpsDue" ? followUpsDue : key === "inboxUnread" ? inboxUnread : 0;

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Zap className="size-4.5" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">{workspace.name}</div>
          <div className="text-[11px] text-muted-foreground">Outbound OS</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 no-scrollbar">
        {NAV.map((section) => (
          <div key={section.title}>
            <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const badge = badgeValue(item.badgeKey);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon
                      className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                      strokeWidth={2}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
