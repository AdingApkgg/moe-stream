"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

interface CardMetaProps {
  author: string;
  createdAt: Date | string;
  className?: string;
  /** 右侧附加统计（如观看量、下载量徽章） */
  trailing?: ReactNode;
}

/** 视频/图集/游戏卡片底部统一的元信息条：作者 · 时间 · 附加 */
export function CardMeta({ author, createdAt, className, trailing }: CardMetaProps) {
  return (
    <p className={cn("flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground min-w-0", className)}>
      <span className="truncate">{author}</span>
      <span aria-hidden className="shrink-0 opacity-50">
        ·
      </span>
      <span className="shrink-0 tabular-nums">{formatRelativeTime(createdAt)}</span>
      {trailing && (
        <>
          <span aria-hidden className="shrink-0 opacity-50">
            ·
          </span>
          <span className="shrink-0">{trailing}</span>
        </>
      )}
    </p>
  );
}
