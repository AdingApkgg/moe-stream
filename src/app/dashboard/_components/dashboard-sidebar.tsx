"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, ArrowLeft, ChevronsLeft, ChevronsRight } from "lucide-react";
import { dashboardMenuGroups, type DashboardMenuGroup } from "../_lib/menu";

type Permissions = {
  isOwner: boolean;
  isAdmin: boolean;
  scopes: string[];
  allScopes: Record<string, string>;
};

function filterGroupsByPermissions(permissions: Permissions | undefined): DashboardMenuGroup[] {
  const hasScope = (scope: string | null) => {
    if (!scope) return true;
    if (!permissions) return false;
    return permissions.scopes.includes(scope);
  };
  return dashboardMenuGroups
    .map((group) => ({ ...group, items: group.items.filter((i) => hasScope(i.scope)) }))
    .filter((g) => g.items.length > 0);
}

export function DashboardSidebar({
  permissions,
  pathname,
  collapsed,
  onToggleCollapsed,
  onItemClick,
  variant = "desktop",
}: {
  permissions: Permissions | undefined;
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onItemClick?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const visibleGroups = filterGroupsByPermissions(permissions);
  const isMobile = variant === "mobile";
  const showCollapsed = !isMobile && collapsed;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full bg-card">
        {/* Header */}
        <div
          className={cn(
            "h-[52px] flex items-center shrink-0 border-b",
            showCollapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group min-w-0"
            onClick={onItemClick}
            aria-label="控制台首页"
          >
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center transition-transform group-hover:scale-105 shrink-0">
              <Shield className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            {!showCollapsed && <span className="text-[15px] font-semibold tracking-tight truncate">控制台</span>}
          </Link>
          {!showCollapsed && (
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/"
                    onClick={onItemClick}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                    aria-label="返回首页"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  返回首页
                </TooltipContent>
              </Tooltip>
              {onToggleCollapsed && !isMobile && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onToggleCollapsed}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
                      aria-label="折叠侧边栏"
                    >
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    折叠侧边栏
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 min-h-0">
          <nav className={cn("py-2", showCollapsed && "py-3")}>
            {visibleGroups.map((group, groupIdx) => (
              <div key={group.label ?? `group-${groupIdx}`}>
                {groupIdx > 0 && <div className={cn("my-1.5 border-t", showCollapsed ? "mx-2" : "mx-4")} />}
                {group.label && !showCollapsed && (
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest select-none">
                      {group.label}
                    </span>
                  </div>
                )}
                <div className={cn(showCollapsed ? "px-2 space-y-0.5" : "px-2")}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const linkEl = (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onItemClick}
                        className={cn(
                          "group relative flex items-center rounded-md text-[13px] transition-colors",
                          showCollapsed ? "h-9 w-9 justify-center mx-auto" : "gap-2.5 px-3 py-[7px]",
                          isActive
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                        )}
                        aria-label={item.label}
                      >
                        {isActive && !showCollapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                        )}
                        {isActive && showCollapsed && (
                          <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground/70 group-hover:text-accent-foreground/70",
                          )}
                        />
                        {!showCollapsed && item.label}
                      </Link>
                    );
                    return showCollapsed ? (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      linkEl
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        {showCollapsed && onToggleCollapsed && (
          <div className="border-t shrink-0 p-2 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="展开侧边栏"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                展开侧边栏
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
