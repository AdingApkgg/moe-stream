"use client";

import type { ReactNode } from "react";
import { useInlineAds } from "@/hooks/use-inline-ads";
import { AdCard } from "./ad-card";
import { cn } from "@/lib/utils";

interface InlineAdGridProps<T> {
  /** 内容数据列表 */
  items: T[];
  /**
   * 渲染单个内容项。第二个参数是「不含广告」的内容索引（保持 priority 等
   * 取决于位置的逻辑稳定）。调用方应在返回元素上自己写 `key`。
   */
  renderItem: (item: T, index: number) => ReactNode;
  /** 用于稳定广告选取的种子（页码 + 筛选条件等） */
  adSeed: string;
  /** 网格容器的栅格 className（不含 `grid` 与 gap 部分） */
  columnsClass: string;
  /** 整体容器额外 className */
  className?: string;
  /** 间距 class,默认 `gap-3 sm:gap-4 lg:gap-5` */
  gapClass?: string;
  /** 广告数量(默认 4) */
  adCount?: number;
  /** 广告插入间隔(默认 3) */
  adInterval?: number;
}

/**
 * 通用「内容 + 信息流广告」网格渲染器:
 * 用 useInlineAds 把广告均匀插入 items,按统一栅格输出。
 * 不处理 loading / empty 状态,由调用方在外部决定。
 */
export function InlineAdGrid<T>({
  items,
  renderItem,
  adSeed,
  columnsClass,
  className,
  gapClass = "gap-3 sm:gap-4 lg:gap-5",
  adCount = 4,
  adInterval = 3,
}: InlineAdGridProps<T>) {
  const { gridItems, pickedAds } = useInlineAds<T>({
    items,
    seed: adSeed,
    count: adCount,
    interval: adInterval,
  });

  // 内容索引(不含广告)。在 map 中递增以传给 renderItem,使首屏 priority
  // 等基于 index 的逻辑保持稳定。
  let contentIdx = 0;

  return (
    <div className={cn("grid", columnsClass, gapClass, className)}>
      {gridItems.map((item) => {
        if (item.type === "ad") {
          return <AdCard key={`ad-${item.adIndex}`} ad={pickedAds[item.adIndex]} slotId="in-feed" />;
        }
        const idx = contentIdx++;
        return renderItem(item.data, idx);
      })}
    </div>
  );
}
