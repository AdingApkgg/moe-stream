import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAdGrid } from "@/components/ads/inline-ad-grid";
import { cn } from "@/lib/utils";

type Aspect = "video" | "square";

const ASPECT_CLASS: Record<Aspect, string> = {
  video: "aspect-video",
  square: "aspect-square",
};

interface CardGridProps<T> {
  isLoading: boolean;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  empty: { icon: LucideIcon; title: string; description: string };
  aspect?: Aspect;
  cols?: "compact" | "default";
  skeletonCount?: number;
  /**
   * 信息流广告种子。传入即在网格中插入随机广告（典型：`${zone}-${tab}-${page}`）。
   * 缺省则不插广告。
   */
  adSeed?: string;
}

const COLS_CLASS = {
  compact: { wrapper: "grid grid-cols-2 md:grid-cols-4 gap-3", columns: "grid-cols-2 md:grid-cols-4", gap: "gap-3" },
  default: {
    wrapper: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
    columns: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    gap: "gap-4",
  },
};

export function CardGrid<T>({
  isLoading,
  items,
  renderItem,
  empty,
  aspect = "video",
  cols = "default",
  skeletonCount = 8,
  adSeed,
}: CardGridProps<T>) {
  const colsCfg = COLS_CLASS[cols];

  if (isLoading) {
    return (
      <div className={colsCfg.wrapper}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className={cn(ASPECT_CLASS[aspect], "rounded-lg")} />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  }
  if (adSeed) {
    return (
      <InlineAdGrid
        items={items}
        adSeed={adSeed}
        columnsClass={colsCfg.columns}
        gapClass={colsCfg.gap}
        renderItem={renderItem}
      />
    );
  }
  return <div className={colsCfg.wrapper}>{items.map((item, index) => renderItem(item, index))}</div>;
}
