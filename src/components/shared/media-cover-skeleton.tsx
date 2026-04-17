import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 封面/卡片媒体区域的加载骨架（置于底层或覆盖层，由父级 overflow 裁剪圆角） */
export function MediaCoverSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("absolute inset-0 size-full rounded-none border-0", className)} aria-hidden />;
}
