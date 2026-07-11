"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/ui/misc";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Search, Moon, Sun, Menu, LogOut, RefreshCw, Command as CommandIcon, ChevronsUpDown } from "lucide-react";
import { isLiveMode } from "@/lib/supabase/client";

export function Topbar({
  onOpenCommand,
  onOpenSidebar,
}: {
  onOpenCommand: () => void;
  onOpenSidebar: () => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const login = useStore((s) => s.login);
  const logout = useStore((s) => s.logout);
  const resetDemo = useStore((s) => s.resetDemo);
  const user = users.find((u) => u.id === currentUserId) ?? users[0];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <button
        onClick={onOpenSidebar}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <button
        onClick={onOpenCommand}
        className="group flex h-9 flex-1 items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-ring/40 md:max-w-md"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search everything…</span>
        <span className="hidden items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] sm:flex">
          <CommandIcon className="size-2.5" />K
        </span>
      </button>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>

        <Dropdown
          align="end"
          trigger={
            <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-accent">
              <Avatar name={user.name} color={user.avatarColor} size={30} />
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-xs font-medium">{user.name}</div>
                <div className="text-[10px] capitalize text-muted-foreground">{user.role}</div>
              </div>
              <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
            </button>
          }
        >
          {!isLiveMode && (
            <>
              <DropdownLabel>Switch user</DropdownLabel>
              {users.map((u) => (
                <DropdownItem key={u.id} onClick={() => login(u.id)} icon={<Avatar name={u.name} color={u.avatarColor} size={20} />}>
                  {u.name}
                  <span className="ml-auto text-xs capitalize text-muted-foreground">{u.role}</span>
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <DropdownItem icon={<RefreshCw />} onClick={() => resetDemo()}>
                Reset demo data
              </DropdownItem>
            </>
          )}
          <DropdownItem
            icon={<LogOut />}
            destructive
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
