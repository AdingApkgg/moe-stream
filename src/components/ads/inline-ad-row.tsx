"use client";

import { useRef } from "react";
import Image from "next/image";
import type { Ad } from "@/lib/ads";
import { getAdImage } from "@/lib/ads";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { useAdTracking, useAdImpression } from "@/hooks/use-ad-tracking";
import { cn, getRedirectUrl } from "@/lib/utils";

interface InlineAdRowProps {
  ad: Ad;
  className?: string;
}

/**
 * 列表场景的横条广告：图在左（aspect-video），文字在右。
 * 用于评论列表、收藏视频列表、合集列表等窄横条形态。
 */
export function InlineAdRow({ ad, className }: InlineAdRowProps) {
  const redirectOpts = useRedirectOptions();
  const imageUrl = getAdImage(ad, "in-feed");
  const ref = useRef<HTMLAnchorElement | null>(null);
  const { trackEvent } = useAdTracking();
  useAdImpression(ref, ad.id);

  return (
    <a
      ref={ref}
      href={getRedirectUrl(ad.url, redirectOpts)}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => trackEvent(ad.id, "click")}
      onAuxClick={(e) => {
        if (e.button === 1) trackEvent(ad.id, "click");
      }}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-muted/40 transition-all hover:shadow-md hover:border-primary/60 hover:border-solid",
        className,
      )}
    >
      <div className="relative w-40 h-24 shrink-0 rounded-md overflow-hidden bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={ad.title}
            fill
            sizes="160px"
            unoptimized
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{ad.title}</div>
        )}
        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-400 text-black leading-tight shadow-sm">
          广告
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-medium text-foreground truncate">{ad.title}</span>
          {ad.platform && (
            <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium leading-none">
              {ad.platform}
            </span>
          )}
        </div>
        {ad.description && <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>}
      </div>
    </a>
  );
}
