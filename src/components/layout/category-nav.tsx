"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useCallback } from "react";
import { ChevronDown, Play, Images, Gamepad2, TrendingUp, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubItem {
  label: string;
  href: string;
  description?: string;
}

interface NavEntry {
  id: string;
  label: string;
  href: string;
  matchPrefix: string;
  icon: typeof Play;
  children?: SubItem[];
}

const NAV: readonly NavEntry[] = [
  {
    id: "video",
    label: "视频",
    href: "/video",
    matchPrefix: "/video",
    icon: Play,
    children: [
      { label: "全部视频", href: "/video", description: "浏览全站视频" },
      { label: "热度排行", href: "/ranking?kind=video", description: "按观看量排序" },
      { label: "标签广场", href: "/tags", description: "按标签发现内容" },
    ],
  },
  {
    id: "image",
    label: "图集",
    href: "/image",
    matchPrefix: "/image",
    icon: Images,
    children: [
      { label: "全部图集", href: "/image", description: "浏览全站图集" },
      { label: "热门图集", href: "/ranking?kind=image", description: "高人气图集" },
    ],
  },
  {
    id: "game",
    label: "游戏",
    href: "/game",
    matchPrefix: "/game",
    icon: Gamepad2,
    children: [
      { label: "全部游戏", href: "/game", description: "浏览全站游戏" },
      { label: "ADV 冒险", href: "/game?type=ADV" },
      { label: "RPG 角色扮演", href: "/game?type=RPG" },
      { label: "SLG 策略", href: "/game?type=SLG" },
      { label: "ACT 动作", href: "/game?type=ACT" },
    ],
  },
  { id: "ranking", label: "排行", href: "/ranking", matchPrefix: "/ranking", icon: TrendingUp },
  { id: "tags", label: "标签", href: "/tags", matchPrefix: "/tags", icon: Hash },
];

interface CategoryNavProps {
  className?: string;
}

export function CategoryNav({ className }: CategoryNavProps) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpenId(null), 120);
  }, [cancelClose]);

  return (
    <nav
      className={cn(
        "sticky top-14 z-40 border-b border-border/50 bg-background/85 backdrop-blur-md",
        "hidden md:block",
        className,
      )}
      aria-label="主分类导航"
    >
      <ul className="flex items-center gap-0.5 px-4 md:px-6 max-w-screen-2xl mx-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const hasChildren = !!item.children?.length;
          const active = pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
          const open = openId === item.id;

          return (
            <li
              key={item.id}
              className="relative"
              onMouseEnter={() => {
                cancelClose();
                if (hasChildren) setOpenId(item.id);
              }}
              onMouseLeave={() => {
                if (hasChildren) scheduleClose();
              }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  "hover:bg-accent/40 hover:text-foreground",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
                onFocus={() => {
                  cancelClose();
                  if (hasChildren) setOpenId(item.id);
                }}
                onBlur={() => {
                  if (hasChildren) scheduleClose();
                }}
              >
                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                <span>{item.label}</span>
                {hasChildren && (
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 opacity-50 transition-transform duration-200",
                      open && "rotate-180 opacity-100",
                    )}
                  />
                )}
                {active && (
                  <span aria-hidden className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </Link>

              {hasChildren && open && (
                <div
                  className="absolute top-full left-0 mt-1 min-w-[220px] rounded-xl bg-popover ring-1 ring-border/50 shadow-lg p-1.5 z-50 animate-in fade-in-0 slide-in-from-top-1 duration-150"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  {item.children!.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="flex flex-col gap-0.5 px-3 py-2 text-sm rounded-lg hover:bg-accent/60 transition-colors"
                      onClick={() => setOpenId(null)}
                    >
                      <span className="font-medium">{c.label}</span>
                      {c.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">{c.description}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
