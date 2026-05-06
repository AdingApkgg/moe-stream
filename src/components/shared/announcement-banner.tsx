"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismissedAnnouncement } from "@/hooks/use-dismissed-announcement";

interface AnnouncementBannerProps {
  /** 站点公告内容 */
  announcement: string | null | undefined;
  /** 是否启用公告（来自站点配置） */
  enabled?: boolean;
  className?: string;
}

/**
 * 列表页顶部公告横幅。用户关闭后 24h 内不再显示，公告内容变更后状态自动失效。
 * 替代之前在各 list client 重复实现的 showAnnouncement state。
 */
export function AnnouncementBanner({ announcement, enabled, className }: AnnouncementBannerProps) {
  const [shown, dismiss] = useDismissedAnnouncement(enabled ? announcement : null);

  if (!enabled || !announcement) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        shown ? "max-h-24 opacity-100 mb-4" : "max-h-0 opacity-0 mb-0",
        className,
      )}
    >
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
        <p className="text-sm text-yellow-700 dark:text-yellow-300 flex-1">{announcement}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭公告"
          className="text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all hover:scale-110 active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
