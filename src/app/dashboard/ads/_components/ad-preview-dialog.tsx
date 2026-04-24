"use client";

import type { Ad } from "@/lib/ads";
import { AdCard } from "@/components/ads/ad-card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdPreviewDialogProps {
  ad: Ad | null;
  onClose: () => void;
}

export function AdPreviewDialog({ ad, onClose }: AdPreviewDialogProps) {
  return (
    <Dialog open={!!ad} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>广告预览</DialogTitle>
          <DialogDescription>预览广告在不同位置的展示效果</DialogDescription>
        </DialogHeader>
        {ad && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">卡片样式（信息流）</p>
              <AdCard ad={ad} slotId="in-feed" />
            </div>
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">紧凑样式（侧栏）</p>
              <AdCard ad={ad} compact slotId="sidebar" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
