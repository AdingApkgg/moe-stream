import type { LucideIcon } from "lucide-react";
import { CountUp } from "@/components/motion";

export function StatItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex items-baseline gap-1">
        <span className="font-semibold text-sm tabular-nums">
          <CountUp value={value} />
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
