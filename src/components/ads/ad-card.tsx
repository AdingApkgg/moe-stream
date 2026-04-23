"use client";

import type { Ad } from "@/lib/ads";
import { getAdImage } from "@/lib/ads";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { cn, getRedirectUrl } from "@/lib/utils";

interface AdCardProps {
  ad: Ad;
  /** 紧凑模式（侧栏等小空间） */
  compact?: boolean;
  /** 广告位标识，用于选取合适尺寸的图片 */
  slotId?: string;
  className?: string;
}

/**
 * 单条广告卡片：展示图片、平台名、描述，点击跳转。
 */
export function AdCard({ ad, compact, slotId, className }: AdCardProps) {
  const redirectOpts = useRedirectOptions();
  const resolvedSlot = slotId ?? (compact ? "sidebar" : "in-feed");
  const imageUrl = getAdImage(ad, resolvedSlot);

  return (
    <a
      href={getRedirectUrl(ad.url, redirectOpts)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={cn(
        "group block rounded-lg overflow-hidden border border-dashed border-border bg-muted/40 transition-all hover:shadow-md hover:border-primary/60 hover:border-solid",
        className,
      )}
    >
      {/* 图片区域 */}
      {imageUrl ? (
        <div className={cn("relative w-full overflow-hidden bg-muted", compact ? "aspect-[2/1]" : "aspect-video")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={ad.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          {/* 广告标记 */}
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-400 text-black leading-tight shadow-sm">
            广告
          </span>
        </div>
      ) : (
        <div
          className={cn(
            "relative w-full flex items-center justify-center bg-muted text-muted-foreground text-xs",
            compact ? "aspect-[2/1]" : "aspect-video",
          )}
        >
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-400 text-black leading-tight shadow-sm">
            广告
          </span>
          <span>{ad.title}</span>
        </div>
      )}

      {/* 文字信息 */}
      <div className={cn("px-2 py-1.5", compact ? "space-y-0" : "space-y-0.5")}>
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium text-foreground truncate", compact ? "text-xs" : "text-sm")}>
            {ad.title}
          </span>
          {ad.platform && (
            <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium leading-none">
              {ad.platform}
            </span>
          )}
        </div>
        {ad.description && !compact && <p className="text-xs text-muted-foreground line-clamp-1">{ad.description}</p>}
      </div>
    </a>
  );
}
