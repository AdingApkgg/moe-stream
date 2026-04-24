"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useSiteConfig } from "@/contexts/site-config";
import { useInViewOnce } from "@/hooks/use-in-view-once";
import { MediaCoverSkeleton } from "@/components/shared/media-cover-skeleton";
import { DEFAULT_THUMBNAIL_PRESETS, getVideoCoverThumbUrl, type ThumbnailPresetName } from "@/lib/thumbnail-presets";

interface VideoCoverProps {
  videoId?: string;
  coverUrl?: string | null;
  blurDataURL?: string | null;
  title: string;
  className?: string;
  /** 缩略图档位名。不传走原图（适合播放器 poster） */
  preset?: ThumbnailPresetName;
  /** 视频封面目标宽高比，默认 16/9；会与 preset.width 组合成 h = w / aspect */
  aspect?: number;
  /** 首屏优先请求与解码（列表前几项建议开启） */
  priority?: boolean;
}

function CoverPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br from-primary/5 via-muted to-primary/10 flex items-center justify-center ${className}`}
    >
      <div className="text-center text-muted-foreground/60">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
          <Film className="h-10 w-10 mx-auto relative" />
        </div>
        <span className="text-xs mt-2 block font-medium">暂无封面</span>
      </div>
    </div>
  );
}

function VideoCoverImageContent({
  coverSrcWithRetry,
  title,
  className,
  priority,
  blurDataURL,
  shouldRetry,
  maxRetries,
  retryKey,
  setGiveUp,
  setRetryKey,
  retryTimerRef,
  retryDelayMs,
}: {
  coverSrcWithRetry: string;
  title: string;
  className: string;
  priority: boolean;
  blurDataURL?: string | null;
  shouldRetry: boolean;
  maxRetries: number;
  retryKey: number;
  setGiveUp: (v: boolean) => void;
  setRetryKey: React.Dispatch<React.SetStateAction<number>>;
  retryTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  retryDelayMs: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const blurProps = blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {};

  return (
    <>
      {!loaded && <MediaCoverSkeleton className="z-[1]" />}
      <Image
        key={retryKey}
        src={coverSrcWithRetry}
        alt={title}
        fill
        priority={priority}
        className={`object-cover relative z-[2] ${className}`}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        unoptimized
        {...blurProps}
        onError={() => {
          if (!shouldRetry) {
            setGiveUp(true);
            return;
          }

          if (retryKey >= maxRetries) {
            setGiveUp(true);
            return;
          }

          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
          }
          retryTimerRef.current = setTimeout(() => {
            setRetryKey((v) => v + 1);
          }, retryDelayMs);
        }}
        onLoad={() => {
          setLoaded(true);
        }}
      />
    </>
  );
}

export function VideoCover({
  videoId,
  coverUrl,
  blurDataURL,
  title,
  className = "",
  preset,
  aspect = 16 / 9,
  priority = false,
}: VideoCoverProps) {
  const siteConfig = useSiteConfig();
  const proxyThumbEnabled = siteConfig?.coverProxyThumbEnabled !== false;
  const [retryKey, setRetryKey] = useState(0);
  const [giveUp, setGiveUp] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRetry = Boolean(videoId && !coverUrl);
  const maxRetries = 12;
  const retryDelayMs = 5000;

  const { ref: viewportRef, inView } = useInViewOnce<HTMLDivElement>({
    disabled: priority,
  });

  useEffect(() => {
    const timerRef = retryTimerRef;
    return () => {
      const pending = timerRef.current;
      if (pending) clearTimeout(pending);
    };
  }, []);

  const getCoverSrc = (): string | null => {
    if (giveUp) return null;

    if (!preset) {
      // 无 preset：走原图（适用于播放器 poster 等需要最高画质的场景）
      if (coverUrl) {
        if (coverUrl.startsWith("/uploads/")) return coverUrl;
        return `/api/cover/${encodeURIComponent(coverUrl)}`;
      }
      if (videoId) return `/api/cover/video/${videoId}`;
      return null;
    }

    if (!coverUrl && !videoId) return null;

    const p = siteConfig?.thumbnailPresets?.[preset] ?? DEFAULT_THUMBNAIL_PRESETS[preset];
    // 视频封面统一按传入宽高比裁剪；默认 16:9
    const height = Math.max(16, Math.round(p.width / aspect));
    return getVideoCoverThumbUrl(videoId ?? "", coverUrl, p, proxyThumbEnabled, { h: height });
  };

  const coverSrc = getCoverSrc();
  const coverSrcWithRetry = coverSrc && shouldRetry ? `${coverSrc}?r=${retryKey}` : coverSrc;

  if (!coverSrcWithRetry) {
    return <CoverPlaceholder className={className} />;
  }

  const showMedia = inView;

  return (
    <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
      {showMedia && (
        <VideoCoverImageContent
          key={coverSrcWithRetry}
          coverSrcWithRetry={coverSrcWithRetry}
          title={title}
          className={className}
          priority={priority}
          blurDataURL={blurDataURL}
          shouldRetry={shouldRetry}
          maxRetries={maxRetries}
          retryKey={retryKey}
          setGiveUp={setGiveUp}
          setRetryKey={setRetryKey}
          retryTimerRef={retryTimerRef}
          retryDelayMs={retryDelayMs}
        />
      )}
      {!showMedia && <MediaCoverSkeleton className="z-[1]" />}
    </div>
  );
}
