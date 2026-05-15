"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

type ChartCardProps = {
  title: string;
  icon?: LucideIcon;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function ChartCard({
  title,
  icon: Icon,
  description,
  action,
  footer,
  loading,
  empty,
  emptyText = "暂无数据",
  className,
  bodyClassName,
  children,
}: ChartCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
            {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("relative", bodyClassName)}>
        {loading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : empty ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          children
        )}
      </div>
      {footer && <div className="border-t pt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
