"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useSiteConfig } from "@/contexts/site-config";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { useAdImpression, useAdTracking } from "@/hooks/use-ad-tracking";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { cn, getRedirectUrl } from "@/lib/utils";
import { getAdImage, parseSponsorAds, pickWeightedRandomAds } from "@/lib/ads";

const DISMISS_KEY = "mikiacg-floating-ad-dismissed";
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000; // 6 小时

/**
 * 左下角悬浮广告（参考 AIACG 设计稿 16:382 / 38:164 等）。
 * 192x96 紧凑卡片，固定底部左下角，可关闭。
 * 移动端隐藏（避免遮挡底部导航）。
 */
export function FloatingAd() {
  const config = useSiteConfig();
  const mounted = useIsMounted();
  // dismissed 状态在 effect 里基于 localStorage 决定 (避免渲染中调 Date.now)
  const [dismissed, setDismissed] = useState(false);
  const redirectOpts = useRedirectOptions();
  const ref = useRef<HTMLAnchorElement | null>(null);
  const { trackEvent } = useAdTracking();

  // 选取一条广告（页面级一次随机；切页不重选避免突兀）
  const adsEnabled = config?.adsEnabled;
  const sponsorAds = config?.sponsorAds;
  const ads = useMemo(() => {
    if (!adsEnabled) return [];
    return parseSponsorAds(sponsorAds);
  }, [adsEnabled, sponsorAds]);

  const ad = useMemo(() => pickWeightedRandomAds(ads, 1)[0], [ads]);

  // 挂载后读取 dismiss 时间戳；超过 TTL 视为已过期。
  // 这里需要在 effect 中同步 setState 以从 localStorage 读取持久化状态——属于
  // 客户端状态初始化的合理用例，不会循环 setState（设置后 dismissed=true 后不再变）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在挂载后跑一次
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const ts = raw ? Number(raw) : null;
      if (ts && !Number.isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDismissed(true);
      }
    } catch {}
  }, [mounted]);

  useAdImpression(ref, ad?.id ?? null);

  if (!mounted || dismissed || !ad) return null;
  const imageUrl = getAdImage(ad, "sidebar");

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-40 hidden md:block",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
      )}
    >
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
          "group relative block w-48 overflow-hidden rounded-2xl bg-card",
          "border border-border/60 shadow-lg shadow-black/15",
          "transition-[transform,box-shadow] duration-300",
          "hover:-translate-y-0.5 hover:shadow-xl",
        )}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="关闭广告"
          className={cn(
            "absolute top-1.5 right-1.5 z-10 grid h-5 w-5 place-items-center rounded-full",
            "bg-black/45 text-white/95 backdrop-blur-sm",
            "opacity-70 hover:opacity-100 hover:bg-black/65 transition",
          )}
        >
          <X className="h-3 w-3" />
        </button>

        {/* 图片 + 渐变 + 文字（覆盖式） */}
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={ad.title}
              fill
              unoptimized
              sizes="192px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          {/* 暗化渐变让白字可读 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground">
            赞助
          </span>
          <div className="absolute inset-x-2 bottom-1.5 space-y-0.5 text-white">
            <p className="text-xs font-semibold leading-tight line-clamp-1">{ad.title}</p>
            {(ad.description || ad.platform) && (
              <p className="text-[10px] leading-tight text-white/85 line-clamp-1">{ad.description || ad.platform}</p>
            )}
          </div>
        </div>
      </a>
    </div>
  );
}
