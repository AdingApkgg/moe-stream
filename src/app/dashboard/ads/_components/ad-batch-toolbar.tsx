"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Power, PowerOff, Trash2 } from "lucide-react";

interface AdBatchToolbarProps {
  selectedCount: number;
  saving: boolean;
  onBatchToggle: (enabled: boolean) => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export function AdBatchToolbar({
  selectedCount,
  saving,
  onBatchToggle,
  onBatchDelete,
  onClearSelection,
}: AdBatchToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 animate-in slide-in-from-top-2">
      <span className="text-sm font-medium">已选择 {selectedCount} 项</span>
      <div className="h-4 w-px bg-border" />
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={() => onBatchToggle(true)}
              disabled={saving}
            >
              <Power className="h-3.5 w-3.5" />
              启用
            </Button>
          </TooltipTrigger>
          <TooltipContent>批量启用所选广告</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1"
              onClick={() => onBatchToggle(false)}
              disabled={saving}
            >
              <PowerOff className="h-3.5 w-3.5" />
              禁用
            </Button>
          </TooltipTrigger>
          <TooltipContent>批量禁用所选广告</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-destructive hover:text-destructive"
              onClick={onBatchDelete}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </TooltipTrigger>
          <TooltipContent>批量删除所选广告</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="ml-auto">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearSelection}>
          取消选择
        </Button>
      </div>
    </div>
  );
}
