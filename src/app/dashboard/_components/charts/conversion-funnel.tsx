"use client";

import { cn } from "@/lib/utils";

type Stage = {
  stage: string;
  value: number;
  fill?: string;
};

type ConversionFunnelProps = {
  data: Stage[];
  className?: string;
  format?: (v: number) => string;
};

const DEFAULT_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(263, 70%, 55%)",
  "hsl(289, 75%, 55%)",
  "hsl(330, 80%, 55%)",
  "hsl(0, 84%, 60%)",
];

export function ConversionFunnel({ data, className, format }: ConversionFunnelProps) {
  const head = data[0]?.value || 1;
  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {data.map((d, idx) => {
        const widthPct = head > 0 ? Math.max(8, Math.round((d.value / head) * 100)) : 8;
        const prev = idx > 0 ? data[idx - 1].value : null;
        const dropRate = prev && prev > 0 ? Math.round((d.value / prev) * 1000) / 10 : null;
        const color = d.fill || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        return (
          <div key={d.stage} className="group">
            <div className="flex items-center justify-between text-[11px] mb-1 px-1">
              <span className="text-muted-foreground">{d.stage}</span>
              <span className="tabular-nums font-medium">
                {format ? format(d.value) : d.value.toLocaleString()}
                {dropRate !== null && (
                  <span
                    className={cn(
                      "ml-2 text-[10px]",
                      dropRate >= 80 ? "text-emerald-500" : dropRate >= 40 ? "text-amber-500" : "text-rose-500",
                    )}
                  >
                    {dropRate}%
                  </span>
                )}
              </span>
            </div>
            <div className="relative h-7 w-full rounded-md bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500 ease-out flex items-center justify-end px-2"
                style={{
                  width: `${widthPct}%`,
                  background: `linear-gradient(90deg, ${color} 0%, color-mix(in oklch, ${color}, transparent 30%) 100%)`,
                }}
              >
                <span className="text-[10px] font-medium text-white/90 tabular-nums drop-shadow">{widthPct}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
