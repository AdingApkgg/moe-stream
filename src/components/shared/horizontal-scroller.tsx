"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HorizontalScrollerProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 每张卡片的固定宽度 class (Tailwind)。视频卡 16:9 推荐 w-[280px] */
  itemWidthClass?: string;
  /** 卡片间距 (Tailwind gap class) */
  gapClass?: string;
  className?: string;
}

/**
 * 横向滚动容器：参考 hanime1.me 「最新上传」section 的展示方式。
 * - 桌面：hover 时浮出左右箭头按钮翻页
 * - 移动：原生触摸滑动（snap-x 提升体验）
 * - scrollbar 隐藏 (scrollbar-hide utility)
 */
export function HorizontalScroller<T>({
  items,
  renderItem,
  itemWidthClass = "w-[260px]",
  gapClass = "gap-3 sm:gap-4",
  className,
}: HorizontalScrollerProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      ro.disconnect();
    };
  }, [updateScrollButtons]);

  const scrollByOffset = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className={cn("group/scroller relative", className)}>
      <div
        ref={scrollerRef}
        className={cn(
          "flex overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory",
          "-mx-4 px-4 md:-mx-6 md:px-6", // 让卡片能贴页面左右边
          gapClass,
        )}
      >
        {items.map((item, i) => (
          <div key={i} className={cn("shrink-0 snap-start", itemWidthClass)}>
            {renderItem(item, i)}
          </div>
        ))}
      </div>

      {/* 左右滚动按钮（hover 时浮出，移动端隐藏） */}
      {canScrollLeft && (
        <button
          type="button"
          aria-label="向左滚动"
          onClick={() => scrollByOffset(-scrollerRef.current!.clientWidth * 0.8)}
          className={cn(
            "hidden md:grid place-items-center absolute top-1/2 -translate-y-1/2 left-1 z-10",
            "h-10 w-10 rounded-full bg-background/95 backdrop-blur-sm shadow-lg border",
            "opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-200",
            "hover:bg-accent",
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="向右滚动"
          onClick={() => scrollByOffset(scrollerRef.current!.clientWidth * 0.8)}
          className={cn(
            "hidden md:grid place-items-center absolute top-1/2 -translate-y-1/2 right-1 z-10",
            "h-10 w-10 rounded-full bg-background/95 backdrop-blur-sm shadow-lg border",
            "opacity-0 group-hover/scroller:opacity-100 transition-opacity duration-200",
            "hover:bg-accent",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
