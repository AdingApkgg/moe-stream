"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface VideoCoverProps {
  videoId?: string;
  coverUrl?: string | null;
  blurDataURL?: string | null;
  title: string;
  className?: string;
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

export function VideoCover({ videoId, coverUrl, blurDataURL, title, className = "" }: VideoCoverProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [giveUp, setGiveUp] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRetry = Boolean(videoId && !coverUrl);
  const maxRetries = 12;
  const retryDelayMs = 5000;

  // 稳定的本地封面无需 unoptimized，可享受 Next.js 图片优化
  const isStableLocal = Boolean(coverUrl?.startsWith("/uploads/"));

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const getCoverSrc = () => {
    if (giveUp) return null;
    
    if (coverUrl) {
      if (coverUrl.startsWith("/uploads/")) {
        return coverUrl;
      }
      return `/api/cover/${encodeURIComponent(coverUrl)}`;
    }
    
    if (videoId) {
      return `/api/cover/video/${videoId}`;
    }
    
    return null;
  };

  const coverSrc = getCoverSrc();
  const coverSrcWithRetry =
    coverSrc && shouldRetry ? `${coverSrc}?r=${retryKey}` : coverSrc;

  if (!coverSrcWithRetry) {
    return <CoverPlaceholder className={className} />;
  }

  const placeholderProps = blurDataURL
    ? ({ placeholder: "blur" as const, blurDataURL })
    : {};

  return (
    <>
      {/* 底层始终渲染占位符，避免重试时闪烁 */}
      {!loaded && <CoverPlaceholder className={className} />}
      <Image
        key={retryKey}
        src={coverSrcWithRetry}
        alt={title}
        fill
        className={`object-cover ${className}`}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        unoptimized={!isStableLocal}
        {...placeholderProps}
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
