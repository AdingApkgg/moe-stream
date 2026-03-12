"use client";

import { useSocketStore } from "@/stores/socket";
import { cn } from "@/lib/utils";

interface OnlineBadgeProps {
  userId: string;
  className?: string;
}

export function OnlineBadge({ userId, className }: OnlineBadgeProps) {
  const isOnline = useSocketStore((s) => s.isOnline(userId));

  if (!isOnline) return null;

  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background",
        className,
      )}
      title="在线"
    />
  );
}
