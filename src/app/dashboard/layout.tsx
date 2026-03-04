"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Users,
  Video,
  Gamepad2,
  Images,
  Layers,
  Tag,
  Settings,
  Shield,
  MessageSquare,
  Menu,
  Sparkles,
  ArrowLeft,
  Link2,
  DatabaseBackup,
  Image as ImageIcon,
  Sticker,
  TrendingUp,
  Coins,
  Crown,
  UserCog,
  User,
  type LucideIcon,
} from "lucide-react";

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  scope: string | null;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    label: "内容",
    items: [
      { href: "/dashboard/videos", label: "视频", icon: Video, scope: "video:moderate" },
      { href: "/dashboard/games", label: "游戏", icon: Gamepad2, scope: "video:moderate" },
      { href: "/dashboard/images", label: "图片", icon: Images, scope: "video:moderate" },
      { href: "/dashboard/series", label: "合集", icon: Layers, scope: "video:moderate" },
      { href: "/dashboard/covers", label: "封面", icon: ImageIcon, scope: "video:manage" },
    ],
  },
  {
    label: "社区",
    items: [
      { href: "/dashboard/users", label: "用户", icon: Users, scope: "user:view" },
      { href: "/dashboard/tags", label: "标签", icon: Tag, scope: "tag:manage" },
      { href: "/dashboard/comments", label: "评论", icon: MessageSquare, scope: "comment:manage" },
      { href: "/dashboard/stickers", label: "贴图", icon: Sticker, scope: "settings:manage" },
    ],
  },
  {
    label: "推广",
    items: [
      { href: "/dashboard/referral", label: "推广中心", icon: TrendingUp, scope: null },
      { href: "/dashboard/points", label: "积分管理", icon: Coins, scope: "settings:manage" },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/dashboard/links", label: "友情链接", icon: Link2, scope: "settings:manage" },
      { href: "/dashboard/backups", label: "数据备份", icon: DatabaseBackup, scope: "settings:manage" },
      { href: "/dashboard/settings", label: "系统设置", icon: Settings, scope: "settings:manage" },
    ],
  },
];

function SidebarContent({
  permissions,
  pathname,
  onItemClick,
}: {
  permissions: {
    isOwner: boolean;
    isAdmin: boolean;
    scopes: string[];
    allScopes: Record<string, string>;
  } | undefined;
  pathname: string;
  onItemClick?: () => void;
}) {
  const { data: meData } = trpc.user.me.useQuery(undefined, { staleTime: 60_000 });

  const hasScope = (scope: string | null) => {
    if (!scope) return true;
    if (!permissions) return false;
    return permissions.scopes.includes(scope);
  };

  const visibleGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasScope(item.scope)),
    }))
    .filter((group) => group.items.length > 0);

  const roleInfo = (() => {
    if (!permissions) return { label: "用户", icon: User, color: "text-muted-foreground" };
    if (permissions.isOwner) return { label: "站长", icon: Crown, color: "text-amber-500" };
    if (permissions.isAdmin) return { label: "管理员", icon: UserCog, color: "text-blue-500" };
    return { label: "用户", icon: User, color: "text-muted-foreground" };
  })();

  const RoleIcon = roleInfo.icon;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="h-[52px] flex items-center justify-between px-4 border-b shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onItemClick}>
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <Shield className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">控制台</span>
        </Link>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                onClick={onItemClick}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">返回首页</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-2">
          {visibleGroups.map((group, groupIdx) => (
            <div key={group.label}>
              {groupIdx > 0 && (
                <div className="mx-4 my-1.5 border-t" />
              )}
              <div className="px-4 pt-2 pb-1">
                <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest select-none">
                  {group.label}
                </span>
              </div>
              <div className="px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        "group relative flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-accent-foreground/70")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t shrink-0">
        {meData?.points !== undefined && (
          <Link
            href="/dashboard/referral"
            onClick={onItemClick}
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-accent/50 transition-colors"
          >
            <Coins className="h-4 w-4 text-amber-500" />
            <span>积分</span>
            <span className="ml-auto tabular-nums font-medium text-foreground">{meData.points.toLocaleString()}</span>
          </Link>
        )}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-t">
          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", permissions?.isOwner ? "bg-amber-500/10" : permissions?.isAdmin ? "bg-blue-500/10" : "bg-muted")}>
            <RoleIcon className={cn("h-3 w-3", roleInfo.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{meData?.nickname || meData?.username || "..."}</div>
            <div className="text-[11px] text-muted-foreground/60 truncate flex items-center gap-1">
              {permissions?.isOwner && <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
              {roleInfo.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: permissions, isLoading: permissionsLoading } =
    trpc.admin.getMyPermissions.useQuery(undefined, {
      enabled: !!session,
    });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/dashboard");
    }
  }, [status, router]);

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  if (status === "loading" || permissionsLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <div className="flex h-full">
          <div className="hidden lg:flex lg:flex-col w-60 border-r bg-card">
            <div className="h-[52px] flex items-center px-4 border-b">
              <Skeleton className="h-7 w-7 rounded-md mr-2.5" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="px-2 py-3 space-y-1">
              <Skeleton className="h-3 w-10 ml-4 mb-2" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
              <div className="mx-4 my-2 border-t" />
              <Skeleton className="h-3 w-10 ml-4 mb-2" />
              {[1, 2, 3].map((i) => (
                <Skeleton key={`b${i}`} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
          <div className="lg:hidden fixed top-0 left-0 right-0 h-[52px] border-b bg-card flex items-center px-4 gap-3">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex-1 p-4 lg:p-6 pt-[68px] lg:pt-6">
            <Skeleton className="h-7 w-48 mb-6" />
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex h-full">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col w-60 border-r shrink-0">
          <SidebarContent permissions={permissions} pathname={pathname} />
        </aside>

        {/* Mobile header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-[52px] border-b bg-card flex items-center px-4 gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition-colors" aria-label="打开菜单">
                <Menu className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60">
              <SheetHeader className="sr-only">
                <SheetTitle>管理面板导航</SheetTitle>
              </SheetHeader>
              <SidebarContent
                permissions={permissions}
                pathname={pathname}
                onItemClick={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
              <Shield className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">控制台</span>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 pt-[68px] lg:pt-6 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
