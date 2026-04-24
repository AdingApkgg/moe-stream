"use client";

import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * 广告事件上报 hook。
 * - impression：可配合 IntersectionObserver 在元素进入视口一定时长后上报；
 * - click：元素被点击时上报。
 * 本地会对同一 adId+type 做 1 分钟内去重（避免同一次浏览重复上报）。
 */
export function useAdTracking() {
  const report = trpc.ad.report.useMutation();
  const sentRef = useRef<Map<string, number>>(new Map());

  const trackEvent = useCallback(
    (adId: string, type: "impression" | "click") => {
      if (!adId || adId.startsWith("legacy-") || adId === "preview") return;
      const key = `${type}:${adId}`;
      const now = Date.now();
      const last = sentRef.current.get(key);
      if (last && now - last < 60_000) return;
      sentRef.current.set(key, now);
      report.mutate({ adId, type });
    },
    [report],
  );

  return { trackEvent };
}

/**
 * 观察元素进入视口，超过 500ms 则上报一次 impression。
 * 适用于 `<AdCard>` 等单次 mount 的场景。
 */
export function useAdImpression(ref: React.RefObject<HTMLElement | null>, adId: string | undefined) {
  const { trackEvent } = useAdTracking();

  useEffect(() => {
    if (!adId || !ref.current) return;
    const el = ref.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (timer == null) {
              timer = setTimeout(() => {
                trackEvent(adId, "impression");
                timer = null;
              }, 500);
            }
          } else if (timer != null) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timer != null) clearTimeout(timer);
    };
  }, [adId, ref, trackEvent]);
}
