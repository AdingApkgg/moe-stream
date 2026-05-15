"use client";

import type { ReactNode } from "react";
import { useInlineAds } from "@/hooks/use-inline-ads";
import { InlineAdRow } from "./inline-ad-row";
import { cn } from "@/lib/utils";

interface InlineAdListProps<T> {
  /** 内容数据列表 */
  items: T[];
  /** 渲染单个内容项,调用方应在返回元素上自己写 `key`(第二个参数为不含广告的内容索引) */
  renderItem: (item: T, index: number) => ReactNode;
  /** 用于稳定广告选取的种子(页码 + 筛选条件等) */
  adSeed: string;
  /** 容器额外 className */
  className?: string;
  /** 列表项垂直间距,默认 `space-y-3` */
  spaceClass?: string;
  /** 广告数量(默认 3) */
  adCount?: number;
  /** 广告插入间隔(默认 5,即每 5 条内容最多 1 条广告) */
  adInterval?: number;
}

/**
 * 通用「内容列表 + 横条信息流广告」渲染器:
 * 用 useInlineAds 把横条广告(InlineAdRow)均匀插入 items 列表。
 * 不处理 loading / empty 状态,由调用方在外部决定。
 */
export function InlineAdList<T>({
  items,
  renderItem,
  adSeed,
  className,
  spaceClass = "space-y-3",
  adCount = 3,
  adInterval = 5,
}: InlineAdListProps<T>) {
  const { gridItems, pickedAds } = useInlineAds<T>({
    items,
    seed: adSeed,
    count: adCount,
    interval: adInterval,
    firstAdPosition: 3,
  });

  let contentIdx = 0;

  return (
    <div className={cn(spaceClass, className)}>
      {gridItems.map((item) => {
        if (item.type === "ad") {
          return <InlineAdRow key={`ad-${item.adIndex}`} ad={pickedAds[item.adIndex]} />;
        }
        const idx = contentIdx++;
        return renderItem(item.data, idx);
      })}
    </div>
  );
}
