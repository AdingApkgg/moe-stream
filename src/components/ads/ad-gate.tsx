"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { useSiteConfigForAds } from "@/hooks/use-ads";
import { useAdTracking } from "@/hooks/use-ad-tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Ad } from "@/lib/ads";
import { pickWeightedRandomAds, getActiveAds, parseSponsorAds, getAdImage } from "@/lib/ads";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_FREE_UNTIL = "acgn_ad_gate_free_until";
const STORAGE_VIEW_COUNT = "acgn_ad_gate_view_count";
const SESSION_CLICK_AT = "acgn_ad_gate_click_at";
const MIN_AWAY_MS = 1000;
const MAX_AWAY_MS = 10 * 60 * 1000;

const AUTO_PLAY_MS = 4000;

function AdCarousel({ ads, onClickAd }: { ads: Ad[]; onClickAd: (ad: Ad) => void }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = ads.length;
  const { trackEvent } = useAdTracking();

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (total <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((i) => (i + 1) % total);
    }, AUTO_PLAY_MS);
  }, [total]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  // 当前展示的广告变化时上报 impression
  useEffect(() => {
    const ad = ads[current];
    if (ad) trackEvent(ad.id, "impression");
  }, [ads, current, trackEvent]);

  const go = useCallback(
    (dir: -1 | 1) => {
      setCurrent((i) => (i + dir + total) % total);
      resetTimer();
    },
    [total, resetTimer],
  );

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(idx);
      resetTimer();
    },
    [resetTimer],
  );

  if (total === 0) return null;
  const ad = ads[current];
  const imageUrl = getAdImage(ad, "ad-gate");

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* 广告内容 */}
      <button type="button" onClick={() => onClickAd(ad)} className="group relative w-full text-left transition-all">
        {imageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={ad.title}
              className="w-full h-auto block transition-transform group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate drop-shadow-sm">{ad.title}</p>
                {ad.description && (
                  <p className="text-xs text-white/80 line-clamp-1 drop-shadow-sm">{ad.description}</p>
                )}
              </div>
              {ad.platform && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-medium backdrop-blur-sm">
                  {ad.platform}
                </span>
              )}
            </div>
            <div className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-white/70 backdrop-blur-sm">
              广告
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted/50 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{ad.title}</span>
              {ad.platform && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {ad.platform}
                </span>
              )}
            </div>
            {ad.description && <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>}
          </div>
        )}
      </button>

      {/* 左右切换箭头 */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* 底部指示器 */}
      {total > 1 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5 py-1">
          {ads.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goTo(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === current ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdGate() {
  const { data: session, status } = useSession();
  const siteConfig = useSiteConfigForAds();
  const [viewCount, setViewCount] = useState(0);
  const [freeUntil, setFreeUntil] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);

  const allAds = useMemo(() => parseSponsorAds(siteConfig?.sponsorAds), [siteConfig?.sponsorAds]);
  const enabledAds = useMemo(() => getActiveAds(allAds, "ad-gate"), [allAds]);

  const gateOn = siteConfig?.adsEnabled === true && siteConfig?.adGateEnabled === true && enabledAds.length > 0;
  const required = siteConfig?.adGateViewsRequired ?? 3;
  const hours = siteConfig?.adGateHours ?? 12;

  const userAllowsAds =
    status !== "loading" &&
    (session === null ? true : (session.user as { adsEnabled?: boolean })?.adsEnabled !== false);

  const randomAd = useMemo(() => pickWeightedRandomAds(enabledAds, 1, "ad-gate")[0] ?? null, [enabledAds]);
  const { trackEvent } = useAdTracking();

  const openSponsor = useCallback(
    (ad: Ad) => {
      if (typeof window === "undefined") return;
      trackEvent(ad.id, "click");
      window.open(ad.url, "_blank", "noopener,noreferrer");
      try {
        sessionStorage.setItem(SESSION_CLICK_AT, String(Date.now()));
      } catch {}
    },
    [trackEvent],
  );

  const tryCountReturn = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (document.visibilityState !== "visible") return;
      const raw = sessionStorage.getItem(SESSION_CLICK_AT);
      if (!raw) return;
      const clickAt = parseInt(raw, 10);
      if (Number.isNaN(clickAt)) return;
      const elapsed = Date.now() - clickAt;
      if (elapsed < MIN_AWAY_MS || elapsed > MAX_AWAY_MS) return;
      sessionStorage.removeItem(SESSION_CLICK_AT);
      setViewCount((prev) => {
        const next = prev + 1;
        try {
          localStorage.setItem(STORAGE_VIEW_COUNT, String(next));
        } catch {}
        if (next >= required) {
          const until = Date.now() + hours * 60 * 60 * 1000;
          try {
            localStorage.setItem(STORAGE_FREE_UNTIL, String(until));
            localStorage.removeItem(STORAGE_VIEW_COUNT);
          } catch {}
          setFreeUntil(until);
          setCompleted(true);
        }
        return next;
      });
    } catch {}
  }, [required, hours]);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setNow(Date.now());
    const id = setInterval(update, 1000);
    const tid = setTimeout(update, 0);
    return () => {
      clearInterval(id);
      clearTimeout(tid);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    try {
      const until = localStorage.getItem(STORAGE_FREE_UNTIL);
      if (until) {
        const t = parseInt(until, 10);
        if (!Number.isNaN(t) && t > Date.now()) {
          setTimeout(() => setFreeUntil(t), 0);
          return;
        }
        localStorage.removeItem(STORAGE_FREE_UNTIL);
      }
      const count = localStorage.getItem(STORAGE_VIEW_COUNT);
      setTimeout(() => setViewCount(count ? Math.min(parseInt(count, 10) || 0, required) : 0), 0);
    } catch {}
  }, [mounted, required]);

  useEffect(() => {
    if (!mounted || !gateOn) return;
    const onVisible = () => tryCountReturn();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [mounted, gateOn, tryCountReturn]);

  if (!mounted || !gateOn || !userAllowsAds) return null;
  if (dismissed) return null;
  if (freeUntil != null && (now === 0 || freeUntil > now) && !completed) return null;
  if (completed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="mx-4 max-w-md space-y-6 rounded-xl border bg-card p-6 text-center shadow-lg">
          <p className="text-lg font-medium text-foreground">感谢您的支持！</p>
          <p className="text-sm text-muted-foreground">
            您的支持是我们持续运营的最大动力。现在您可以享受本站的所有内容了。
          </p>
          <Button size="lg" onClick={() => setDismissed(true)}>
            进入本站
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-lg space-y-5 rounded-xl border bg-card p-6 shadow-xl"
        style={{ height: "fit-content" }}
      >
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">感谢支持</h2>
          <p className="text-sm text-muted-foreground">
            点击下方广告或「随机观看广告」，在新标签页至少停留 1 秒后返回本页即可算一次。
          </p>
          <p className="text-sm text-muted-foreground">
            观看 <strong>{required}</strong> 次广告即可 <strong>{hours}</strong> 小时内关闭此广告。
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
            {viewCount}/{required} 已完成
          </span>
          {randomAd && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openSponsor(randomAd)}>
              🎲 随机观看广告
            </Button>
          )}
        </div>

        <AdCarousel ads={enabledAds} onClickAd={openSponsor} />
      </div>
    </div>
  );
}
