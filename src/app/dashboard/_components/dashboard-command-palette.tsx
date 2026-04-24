"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Home, LogOut } from "lucide-react";
import { dashboardMenuGroups } from "../_lib/menu";
import { authClient } from "@/lib/auth-client";

type Permissions = {
  isOwner: boolean;
  isAdmin: boolean;
  scopes: string[];
  allScopes: Record<string, string>;
};

export function DashboardCommandPalette({
  open,
  onOpenChange,
  permissions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: Permissions | undefined;
}) {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const hasScope = (scope: string | null) => {
    if (!scope) return true;
    if (!permissions) return false;
    return permissions.scopes.includes(scope);
  };

  const visibleGroups = dashboardMenuGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => hasScope(i.scope)) }))
    .filter((g) => g.items.length > 0);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="搜索命令" description="输入关键词快速跳转">
      <CommandInput placeholder="搜索页面、操作..." />
      <CommandList>
        <CommandEmpty>未找到结果</CommandEmpty>
        {visibleGroups.map((group, idx) => (
          <CommandGroup key={group.label ?? `g-${idx}`} heading={group.label ?? "总览"}>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.href} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={() => go(item.href)}
                >
                  <Icon />
                  <span>{item.label}</span>
                  <CommandShortcut className="text-[10px] font-mono">
                    {item.href.replace("/dashboard/", "")}
                  </CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="操作">
          <CommandItem
            value="返回首页 home"
            onSelect={() => {
              onOpenChange(false);
              router.push("/");
            }}
          >
            <Home />
            <span>返回首页</span>
          </CommandItem>
          <CommandItem
            value="退出登录 logout signout"
            onSelect={() => {
              onOpenChange(false);
              authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/") } });
            }}
          >
            <LogOut />
            <span>退出登录</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
