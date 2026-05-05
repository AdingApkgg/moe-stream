"use client";

import Link from "next/link";
import { Fragment } from "react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  Menu,
  PanelLeft,
  Crown,
  UserCog,
  User,
  Coins,
  LogOut,
  Home,
  Settings2,
  ChevronRight,
  Shield,
} from "lucide-react";
import { findGroupByItem, findMenuItemByPath } from "../_lib/menu";

type Permissions = {
  isOwner: boolean;
  isAdmin: boolean;
  scopes: string[];
  allScopes: Record<string, string>;
};

function MobileTitle({ pathname }: { pathname: string }) {
  const item = findMenuItemByPath(pathname);
  const group = item ? findGroupByItem(item.href) : undefined;

  if (!item) {
    return (
      <Link href="/dashboard" className="lg:hidden flex items-center gap-2 min-w-0 flex-1">
        <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Shield className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight truncate">控制台</span>
      </Link>
    );
  }

  const Icon = item.icon;
  return (
    <div className="lg:hidden flex items-center gap-2 min-w-0 flex-1">
      <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-foreground/80" />
      </div>
      <div className="flex flex-col min-w-0 leading-tight">
        <span className="text-[15px] font-semibold tracking-tight truncate">{item.label}</span>
        {group?.label && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{group.label}</span>
        )}
      </div>
    </div>
  );
}

function Crumbs({ pathname }: { pathname: string }) {
  const item = findMenuItemByPath(pathname);
  const group = item ? findGroupByItem(item.href) : undefined;

  if (!item) {
    return (
      <Link href="/dashboard" className="text-foreground font-medium truncate">
        控制台
      </Link>
    );
  }

  const segments: { label: string; href?: string }[] = [{ label: "控制台", href: "/dashboard" }];
  if (group?.label) segments.push({ label: group.label });
  segments.push({ label: item.label, href: item.href });

  return (
    <ol className="flex items-center gap-1.5 text-[13px] min-w-0">
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <Fragment key={`${seg.label}-${idx}`}>
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
            {seg.href && !isLast ? (
              <Link href={seg.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                {seg.label}
              </Link>
            ) : (
              <span className={cn("truncate", isLast ? "text-foreground font-medium" : "text-muted-foreground")}>
                {seg.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

export function DashboardTopbar({
  permissions,
  pathname,
  onOpenMobileMenu,
  onToggleSidebar,
  onOpenCommand,
  sidebarCollapsed,
}: {
  permissions: Permissions | undefined;
  pathname: string;
  onOpenMobileMenu: () => void;
  onToggleSidebar: () => void;
  onOpenCommand: () => void;
  sidebarCollapsed: boolean;
}) {
  const { data: meData } = trpc.user.me.useQuery(undefined, { staleTime: 60_000 });

  const roleInfo = (() => {
    if (!permissions) return { label: "用户", icon: User, color: "text-muted-foreground", bg: "bg-muted" };
    if (permissions.isOwner) return { label: "站长", icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10" };
    if (permissions.isAdmin) return { label: "管理员", icon: UserCog, color: "text-blue-500", bg: "bg-blue-500/10" };
    return { label: "用户", icon: User, color: "text-muted-foreground", bg: "bg-muted" };
  })();
  const RoleIcon = roleInfo.icon;

  const displayName = meData?.nickname || meData?.username || "...";
  const initial = (displayName[0] ?? "U").toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <header className="h-14 lg:h-[52px] border-b bg-card flex items-center px-2 lg:px-4 gap-1.5 lg:gap-3 shrink-0">
        {/* Mobile: 菜单按钮（更大触摸目标） */}
        <button
          type="button"
          className="lg:hidden h-10 w-10 -ml-1 rounded-md flex items-center justify-center hover:bg-accent active:bg-accent transition-colors"
          aria-label="打开菜单"
          onClick={onOpenMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile: 当前页面标题 */}
        <MobileTitle pathname={pathname} />

        {/* Desktop: 折叠按钮（侧栏收起时） */}
        {sidebarCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="hidden lg:flex h-8 w-8 rounded-md items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="展开侧边栏"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              展开侧边栏
            </TooltipContent>
          </Tooltip>
        )}

        {/* 面包屑 */}
        <div className="hidden lg:flex flex-1 min-w-0">
          <Crumbs pathname={pathname} />
        </div>

        {/* 搜索按钮 */}
        <button
          type="button"
          onClick={onOpenCommand}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border/60 bg-background hover:bg-accent/50 active:bg-accent transition-colors text-muted-foreground",
            "h-9 w-9 justify-center lg:h-8 lg:w-auto lg:justify-start lg:px-2 lg:pr-1.5 text-[13px]",
          )}
          aria-label="搜索 (⌘K)"
        >
          <Search className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
          <span className="hidden lg:inline">搜索...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/80 bg-muted text-[10px] font-mono text-muted-foreground/80">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>

        {/* 积分 */}
        {meData?.points !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/promotion"
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] hover:bg-accent transition-colors"
              >
                <Coins className="h-3.5 w-3.5 text-amber-500" />
                <span className="tabular-nums font-medium">{meData.points.toLocaleString()}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              我的积分
            </TooltipContent>
          </Tooltip>
        )}

        {/* 用户菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 h-9 lg:h-8 pl-1 pr-1 lg:pr-1.5 rounded-md hover:bg-accent active:bg-accent transition-colors"
              aria-label="用户菜单"
            >
              <Avatar className="size-7 lg:size-6">
                {meData?.avatar && <AvatarImage src={meData.avatar} alt={displayName} />}
                <AvatarFallback className="text-[11px]">{initial}</AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "hidden md:inline-flex h-4 w-4 rounded-full items-center justify-center shrink-0",
                  roleInfo.bg,
                )}
              >
                <RoleIcon className={cn("h-2.5 w-2.5", roleInfo.color)} />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
              <Avatar className="size-8">
                {meData?.avatar && <AvatarImage src={meData.avatar} alt={displayName} />}
                <AvatarFallback className="text-xs">{initial}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{displayName}</div>
                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <RoleIcon className={cn("h-2.5 w-2.5", roleInfo.color)} />
                  {roleInfo.label}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {meData?.points !== undefined && (
              <DropdownMenuItem asChild>
                <Link href="/promotion" className="cursor-pointer">
                  <Coins className="text-amber-500" />
                  <span>积分</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{meData.points.toLocaleString()}</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings2 />
                <span>账号设置</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/" className="cursor-pointer">
                <Home />
                <span>返回首页</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/") } })}
            >
              <LogOut />
              <span>退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </TooltipProvider>
  );
}
