"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 小时内视为「新」

/** 判断内容是否在最近 24h 上传——NewBadge 是否会显示，由父组件用于布局调整 */
export function isNewlyUploaded(createdAt: Date | string | null | undefined): boolean {
  if (!createdAt) return false;
  const ms = new Date(createdAt).getTime();

  return Number.isFinite(ms) && Date.now() - ms < NEW_THRESHOLD_MS;
}

/**
 * 24 小时内上传的内容显示「NEW」徽章（橙色）。
 * 用于视频/图片/游戏卡片，统一外观。
 */
export function NewBadge({ createdAt, className }: { createdAt: Date | string; className?: string }) {
  if (!isNewlyUploaded(createdAt)) return null;
  return (
    <div
      className={cn(
        "absolute top-1.5 left-1.5 bg-orange-500/95 backdrop-blur-sm text-white",
        "text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold shadow-sm",
        className,
      )}
    >
      NEW
    </div>
  );
}

/**
 * 排行榜场景：1/2/3 显示金/银/铜冠图标 + 数字，>3 显示「#N」纯数字徽章。
 * 通常放在卡片左上角，z-index 1 以避免被其它徽章压住。
 */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  if (rank <= 0) return null;
  if (rank <= 3) {
    const tier =
      rank === 1
        ? { ring: "from-amber-300 to-yellow-500", text: "text-amber-50" }
        : rank === 2
          ? { ring: "from-slate-200 to-slate-400", text: "text-slate-50" }
          : { ring: "from-orange-300 to-amber-700", text: "text-orange-50" };
    return (
      <div
        className={cn(
          "absolute top-1.5 left-1.5 z-[1] inline-flex items-center gap-1 rounded-full",
          "px-2 py-0.5 text-xs font-bold shadow-lg bg-gradient-to-br",
          tier.ring,
          tier.text,
          className,
        )}
        aria-label={`排名第 ${rank}`}
      >
        <Crown className="h-3.5 w-3.5" />
        <span className="tabular-nums">{rank}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "absolute top-1.5 left-1.5 z-[1] inline-flex items-center rounded-full",
        "bg-black/65 backdrop-blur-sm px-2 py-0.5 text-xs font-bold text-white tabular-nums",
        className,
      )}
    >
      #{rank}
    </div>
  );
}
