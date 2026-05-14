"use client";

import { useMemo } from "react";
import { useRandomAds } from "@/hooks/use-ads";
import { resolveSlotPosition, type Ad } from "@/lib/ads";

export type GridItem<T> = { type: "content"; data: T } | { type: "ad"; adIndex: number };

interface UseInlineAdsOptions<T> {
  items: T[];
  /** 需要的广告数量（默认 4） */
  count?: number;
  /** 每多少个内容项最多插 1 条广告（默认 3） */
  interval?: number;
  /** 首条广告插入位置（0-based，默认 2 表示第 3 个位置） */
  firstAdPosition?: number;
  /** 最少多少内容项才展示广告（默认 4） */
  minItemsForAds?: number;
  /** 用于稳定广告选取的种子 */
  seed: string;
  /** SSR 预选的广告 */
  initialAds?: Ad[];
  /** 是否使用 initialAds（如第一页首次加载） */
  useInitialAds?: boolean;
}

/**
 * 通用内联广告 hook：将广告均匀插入内容列表。
 * 首条广告提前展示以提升可见度，后续均匀分布。
 */
export function useInlineAds<T>({
  items,
  count = 4,
  interval = 3,
  firstAdPosition = 2,
  minItemsForAds = 4,
  seed,
  initialAds = [],
  useInitialAds = false,
}: UseInlineAdsOptions<T>) {
  const { ads: clientAds, showAds } = useRandomAds(count, seed, resolveSlotPosition("in-feed"));
  const pickedAds = useInitialAds && initialAds.length > 0 ? initialAds : clientAds;

  const adInsertPositions = useMemo(() => {
    if (!showAds || pickedAds.length === 0 || items.length < minItemsForAds) return [];
    const adCount = Math.min(pickedAds.length, Math.floor(items.length / interval));
    if (adCount === 0) return [];

    const positions: number[] = [];

    // 首条广告放在靠前位置（高可见区域）
    const first = Math.min(firstAdPosition, items.length - 1);
    positions.push(first);

    if (adCount > 1) {
      // 剩余广告在首条之后均匀分布
      const remaining = adCount - 1;
      const availableSlots = items.length - first;
      const step = Math.floor(availableSlots / (remaining + 1));

      let seedNum = 0;
      for (let i = 0; i < seed.length; i++) seedNum = (seedNum * 31 + seed.charCodeAt(i)) | 0;

      for (let i = 0; i < remaining; i++) {
        const base = first + step * (i + 1);
        const jitter = Math.abs(seedNum + i * 7) % Math.max(1, Math.floor(step / 3));
        positions.push(Math.min(base + jitter, items.length));
      }
    }

    return [...new Set(positions)].sort((a, b) => a - b);
  }, [showAds, pickedAds.length, items.length, minItemsForAds, interval, firstAdPosition, seed]);

  const gridItems = useMemo((): GridItem<T>[] => {
    if (adInsertPositions.length === 0) {
      return items.map((data) => ({ type: "content" as const, data }));
    }
    const result: GridItem<T>[] = [];
    let adIdx = 0;
    for (let i = 0; i <= items.length; i++) {
      while (adIdx < adInsertPositions.length && adInsertPositions[adIdx] === i) {
        result.push({ type: "ad", adIndex: adIdx });
        adIdx++;
      }
      if (i < items.length) {
        result.push({ type: "content", data: items[i] });
      }
    }
    return result;
  }, [items, adInsertPositions]);

  return { gridItems, pickedAds, showAds, hasAds: adInsertPositions.length > 0 };
}
