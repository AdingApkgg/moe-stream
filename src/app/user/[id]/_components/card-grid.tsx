import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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
}

const COLS_CLASS = {
  compact: "grid grid-cols-2 md:grid-cols-4 gap-3",
  default: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
};

export function CardGrid<T>({
  isLoading,
  items,
  renderItem,
  empty,
  aspect = "video",
  cols = "default",
  skeletonCount = 8,
}: CardGridProps<T>) {
  const gridClass = COLS_CLASS[cols];

  if (isLoading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className={cn(ASPECT_CLASS[aspect], "rounded-lg")} />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  }
  return <div className={gridClass}>{items.map((item, index) => renderItem(item, index))}</div>;
}
