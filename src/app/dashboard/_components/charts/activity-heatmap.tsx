"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Cell = { day: number; hour: number; value: number };

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type ActivityHeatmapProps = {
  cells: Cell[];
  max: number;
  className?: string;
};

export function ActivityHeatmap({ cells, max, className }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<Cell | null>(null);

  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const c of cells) {
      g[c.day][c.hour] = c.value;
    }
    return g;
  }, [cells]);

  const intensity = (v: number) => {
    if (max <= 0 || v <= 0) return 0;
    // 用 log 缩放，让小值也能看见
    return Math.min(1, Math.log10(1 + v) / Math.log10(1 + max));
  };

  const colorFor = (v: number) => {
    const t = intensity(v);
    if (t === 0) return "var(--heatmap-empty, hsl(var(--muted) / 0.4))";
    return `oklch(from var(--primary) calc(0.45 + ${t} * 0.4) calc(c * ${0.3 + t * 0.7}) h)`;
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-stretch gap-1">
        <div className="flex flex-col justify-between py-1 pr-1 text-[10px] text-muted-foreground select-none">
          {WEEKDAYS.map((d) => (
            <div key={d} className="h-3.5 leading-3.5">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="grid grid-rows-7 gap-1" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {grid.map((row, day) =>
              row.map((v, hour) => (
                <button
                  type="button"
                  key={`${day}-${hour}`}
                  onMouseEnter={() => setHovered({ day, hour, value: v })}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "h-3.5 w-full rounded-[2px] transition-all hover:ring-1 hover:ring-foreground/30",
                    hovered?.day === day && hovered?.hour === hour && "ring-1 ring-foreground/40",
                  )}
                  style={{ backgroundColor: colorFor(v), gridRow: day + 1, gridColumn: hour + 1 }}
                  aria-label={`${WEEKDAYS[day]} ${hour}:00 ${v} 次`}
                />
              )),
            )}
          </div>
          <div className="grid mt-1.5" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-[9px] text-muted-foreground text-center tabular-nums">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
        <div className="min-h-[1em]">
          {hovered ? (
            <span className="tabular-nums">
              {WEEKDAYS[hovered.day]} {String(hovered.hour).padStart(2, "0")}:00 — {hovered.value.toLocaleString()}{" "}
              次活动
            </span>
          ) : (
            <span>悬停查看明细 · 共 {cells.reduce((s, c) => s + c.value, 0).toLocaleString()} 次</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span>少</span>
          {[0.05, 0.2, 0.4, 0.6, 0.9].map((t) => (
            <div key={t} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: colorFor(t * max) }} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  );
}
