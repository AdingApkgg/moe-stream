"use client";

import { useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { useStableSession } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/generated/prisma/client";

const FILTER_TABS: { label: string; value: NotificationType | "ALL" }[] = [
  { label: "全部", value: "ALL" },
  { label: "评论", value: "COMMENT_REPLY" },
  { label: "点赞", value: "LIKE" },
  { label: "收藏", value: "FAVORITE" },
  { label: "私信", value: "NEW_MESSAGE" },
  { label: "关注", value: "FOLLOW" },
  { label: "审核", value: "CONTENT_STATUS" },
  { label: "系统", value: "SYSTEM" },
];

export default function NotificationsPage() {
  const { session, isLoading } = useStableSession();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<NotificationType | "ALL">("ALL");

  useEffect(() => {
    if (!isLoading && !session?.user) {
      router.push("/login");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session?.user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">通知中心</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              activeFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <NotificationList key={activeFilter} typeFilter={activeFilter === "ALL" ? undefined : activeFilter} />
      </div>
    </div>
  );
}
