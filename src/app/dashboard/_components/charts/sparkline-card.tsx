"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/motion";
import { cn } from "@/lib/utils";

type SparklineCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  series?: number[];
  delta?: number; // 同期比 0-1 之间或绝对值
  deltaLabel?: string;
  format?: (v: number) => string;
  color?: string; // var(--color-x) 形式或 hsl()
  loading?: boolean;
  onClick?: () => void;
};

export function SparklineCard({
  icon: Icon,
  label,
  value,
  series,
  delta,
  deltaLabel,
  format,
  color = "hsl(var(--primary))",
  loading,
  onClick,
}: SparklineCardProps) {
  const data = (series ?? []).map((v, i) => ({ i, v }));
  const positive = (delta ?? 0) >= 0;
  const showSpark = data.length > 1;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group relative w-full text-left overflow-hidden rounded-xl border bg-card p-3.5 transition-all",
        onClick && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Icon className="h-3.5 w-3.5" style={{ color }} />
            <span className="truncate">{label}</span>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className="text-2xl font-bold tabular-nums leading-none">
              {format ? format(value) : <CountUp value={value} />}
            </p>
          )}
          {!loading && delta !== undefined && (
            <p
              className={cn(
                "text-[11px] mt-1.5 tabular-nums flex items-center gap-0.5",
                positive ? "text-emerald-500" : "text-rose-500",
              )}
            >
              <span>{positive ? "↑" : "↓"}</span>
              <span>
                {Math.abs(delta).toLocaleString()}
                {deltaLabel}
              </span>
            </p>
          )}
        </div>
      </div>
      {showSpark && !loading && (
        <div className="absolute inset-x-0 bottom-0 h-10 opacity-60 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}
