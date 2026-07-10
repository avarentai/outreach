"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { value: string; label: React.ReactNode; count?: number }[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  variant?: "underline" | "pills";
}

export function Tabs({ tabs, value, onValueChange, className, variant = "underline" }: TabsProps) {
  if (variant === "pills") {
    return (
      <div className={cn("inline-flex items-center gap-1 rounded-lg bg-muted p-1", className)}>
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onValueChange(t.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              value === t.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 border-b border-border", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onValueChange(t.value)}
          className={cn(
            "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            value === t.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular",
                value === t.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
