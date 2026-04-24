"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, CheckCircle2, EyeOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  stats: { total: number; active: number; disabled: number; scheduled: number };
  filterStatus: string;
  hasOtherFilters: boolean;
  onClear: () => void;
  onFilter: (status: string) => void;
}

export function StatsCards({ stats, filterStatus, hasOtherFilters, onClear, onFilter }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          filterStatus === "all" && !hasOtherFilters && "ring-2 ring-primary/30",
        )}
        onClick={onClear}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">广告总数</p>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          filterStatus === "active" && "ring-2 ring-green-500/40",
        )}
        onClick={() => onFilter("active")}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">投放中</p>
              <p className="text-2xl font-bold tabular-nums text-green-600">{stats.active}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          filterStatus === "disabled" && "ring-2 ring-muted-foreground/30",
        )}
        onClick={() => onFilter("disabled")}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">已禁用</p>
              <p className="text-2xl font-bold tabular-nums text-muted-foreground">{stats.disabled}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          filterStatus === "scheduled" && "ring-2 ring-blue-500/40",
        )}
        onClick={() => onFilter("scheduled")}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">待投放</p>
              <p className="text-2xl font-bold tabular-nums text-blue-600">{stats.scheduled}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
