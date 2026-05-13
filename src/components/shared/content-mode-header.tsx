"use client";

import Link from "next/link";
import { Play, Images, Gamepad2, LayoutGrid, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/contexts/site-config";
import { useUIStore, type ContentMode } from "@/stores/app";

interface ModeOption {
  id: ContentMode;
  label: string;
  icon: LucideIcon;
  href: string;
}

const ALL_MODES: ModeOption[] = [
  { id: "composite", label: "综合", icon: LayoutGrid, href: "/" },
  { id: "video", label: "视频", icon: Play, href: "/video" },
  { id: "image", label: "图片", icon: Images, href: "/image" },
  { id: "game", label: "游戏", icon: Gamepad2, href: "/game" },
];

interface ContentModeHeaderProps {
  /** 当前页所在的分区，用于高亮 */
  current: ContentMode;
  className?: string;
}

/**
 * 列表页顶部的「分区切换器 + 标题」二合一组件。
 *
 * 视觉：一行大文字「视频 · 图片 · 游戏」，当前页粉色加粗 + 下方一道粗线。
 * 同时担任页面标题（替代原来 h1 + 切换器分离的写法）。
 * 选择即跳转到对应分区，并写入 contentMode store 让 sidebar 等组件感知。
 *
 * 站点配置里禁用某分区时，自动隐藏该选项。
 */
export function ContentModeHeader({ current, className }: ContentModeHeaderProps) {
  const config = useSiteConfig();
  const chooseContentMode = useUIStore((s) => s.chooseContentMode);

  const enabledModes = ALL_MODES.filter((m) => {
    if (m.id === "composite") return config?.sectionCompositeEnabled !== false;
    if (m.id === "video") return config?.sectionVideoEnabled !== false;
    if (m.id === "image") return config?.sectionImageEnabled !== false;
    if (m.id === "game") return config?.sectionGameEnabled !== false;
    return true;
  });

  // 只剩一个启用分区时，分区切换没意义，退化为单个标题
  if (enabledModes.length <= 1) {
    const mode = enabledModes[0] ?? ALL_MODES.find((m) => m.id === current);
    if (!mode) return null;
    const Icon = mode.icon;
    return (
      <div className={cn("flex items-center gap-3 mb-6", className)}>
        <Icon className="h-7 w-7 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{mode.label}</h1>
      </div>
    );
  }

  return (
    <h1
      role="tablist"
      aria-label="内容分区"
      // 4 个 tab 在窄屏会被挤兑（中文被切成竖排），加 overflow-x-auto 让其溢出滚动；
      // 行内 nowrap + shrink-0 双重保险，防止任何一个 tab 单独被压缩到 1 字宽。
      className={cn(
        "mb-6 flex items-end gap-4 sm:gap-7 text-xl sm:text-3xl font-bold tracking-tight",
        "-mx-4 px-4 md:-mx-0 md:px-0 overflow-x-auto scrollbar-hide",
        className,
      )}
    >
      {enabledModes.map((m) => {
        const Icon = m.icon;
        const active = m.id === current;
        return (
          <Link
            key={m.id}
            href={m.href}
            onClick={() => chooseContentMode(m.id)}
            role="tab"
            aria-selected={active}
            className={cn(
              "group relative inline-flex shrink-0 items-center gap-1.5 sm:gap-2 pb-1.5 whitespace-nowrap transition-colors duration-200",
              active ? "text-primary" : "text-muted-foreground/70 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 sm:h-7 sm:w-7 transition-transform",
                active ? "stroke-[2.5px]" : "stroke-[2px] group-hover:scale-105",
              )}
            />
            <span>{m.label}</span>
            {/* 选中态下方加粗下划线 */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 right-0 -bottom-0.5 h-1 rounded-full bg-primary transition-[opacity,transform] duration-300 ease-out origin-left",
                active ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0",
              )}
            />
          </Link>
        );
      })}
    </h1>
  );
}
