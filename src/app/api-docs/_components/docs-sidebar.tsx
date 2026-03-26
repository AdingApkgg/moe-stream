"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ShieldCheck,
  Video,
  Gamepad2,
  ImageIcon,
  MessageSquare,
  Tag,
  FolderOpen,
  Upload,
  UserCircle,
  Users,
  Bell,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const docsNav: NavGroup[] = [
  {
    label: "基础",
    items: [
      { title: "概览", href: "/api-docs", icon: BookOpen },
      { title: "认证与请求格式", href: "/api-docs/authentication", icon: ShieldCheck },
      { title: "错误处理", href: "/api-docs/errors", icon: AlertTriangle },
    ],
  },
  {
    label: "内容管理",
    items: [
      { title: "视频", href: "/api-docs/video", icon: Video },
      { title: "游戏", href: "/api-docs/game", icon: Gamepad2 },
      { title: "图片", href: "/api-docs/image", icon: ImageIcon },
    ],
  },
  {
    label: "互动",
    items: [
      { title: "评论", href: "/api-docs/comment", icon: MessageSquare },
      { title: "标签", href: "/api-docs/tag", icon: Tag },
      { title: "合集", href: "/api-docs/series", icon: FolderOpen },
    ],
  },
  {
    label: "系统",
    items: [
      { title: "文件上传", href: "/api-docs/file", icon: Upload },
      { title: "用户", href: "/api-docs/user", icon: UserCircle },
      { title: "社交", href: "/api-docs/social", icon: Users },
      { title: "通知", href: "/api-docs/notification", icon: Bell },
    ],
  },
  {
    label: "开发者",
    items: [{ title: "API Key 管理", href: "/api-docs/api-key", icon: KeyRound }],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="w-full lg:w-56 flex-shrink-0">
      <div className="lg:sticky lg:top-20 space-y-6 overflow-y-auto max-h-[calc(100vh-6rem)]">
        {docsNav.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-3">
              {group.label}
            </p>
            <div className="flex lg:flex-col gap-0.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              {group.items.map((item) => {
                const isActive = item.href === "/api-docs" ? pathname === "/api-docs" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
