"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { useSound } from "@/hooks/use-sound";
import { cn } from "@/lib/utils";

export interface SubTabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  totalPages?: number;
  content: ReactNode;
}

interface ContentZoneProps {
  tabs: SubTabConfig[];
  activeTab: string;
  onTabChange: (key: string) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function ContentZone({ tabs, activeTab, onTabChange, page, onPageChange }: ContentZoneProps) {
  const { play } = useSound();
  const current = tabs.find((t) => t.key === activeTab) ?? tabs[0];

  if (!current) return null;

  return (
    <>
      <div className="flex items-center gap-1 border-b mb-6 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                onTabChange(tab.key);
                play("navigate");
              }}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count != null && <span className="text-xs text-muted-foreground">({tab.count})</span>}
            </button>
          );
        })}
      </div>
      <div key={current.key} className="animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both">
        {current.content}
        <Pagination
          currentPage={page}
          totalPages={current.totalPages ?? 1}
          onPageChange={onPageChange}
          className="mt-6"
        />
      </div>
    </>
  );
}
