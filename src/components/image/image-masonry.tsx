"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface MasonryItem {
  key: string;
  node: ReactNode;
}

interface ImageMasonryProps {
  items: MasonryItem[];
  className?: string;
}

/**
 * 瀑布流布局：JS 按视口断点决定列数，将 items 轮流分配到各列，
 * 让视觉首行恰好按 items 顺序展示（CSS columns 是「列优先填充」会反序）。
 *
 * - SSR 默认 2 列（与 useMediaQuery 的 serverSnapshot 一致），客户端水合后按真实断点重排
 * - 行内间距用 flex-col 的 gap，列间距用外层 flex 的 gap，跟原 CSS columns 视觉对齐
 */
export function ImageMasonry({ items, className }: ImageMasonryProps) {
  const isSm = useMediaQuery("(min-width: 640px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const cols = isXl ? 5 : isLg ? 4 : isSm ? 3 : 2;

  const columns = useMemo(() => {
    const result: MasonryItem[][] = Array.from({ length: cols }, () => []);
    items.forEach((item, i) => result[i % cols].push(item));
    return result;
  }, [items, cols]);

  return (
    <div className={cn("flex items-start gap-3 sm:gap-4 lg:gap-5", className)}>
      {columns.map((col, ci) => (
        // 列容器用稳定的「col-N」key，列数变化时不会全部 unmount
        <div key={`col-${ci}`} className="flex flex-1 min-w-0 flex-col gap-3 sm:gap-4 lg:gap-5">
          {col.map((item) => (
            <Fragment key={item.key}>{item.node}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
