"use client";

import { trpc } from "@/lib/trpc";
import { NotificationItem } from "./notification-item";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCheck, Trash2 } from "lucide-react";
import { useSocketStore } from "@/stores/socket";

interface NotificationListProps {
  compact?: boolean;
  onNavigate?: () => void;
}

export function NotificationList({ compact, onNavigate }: NotificationListProps) {
  const setUnread = useSocketStore((s) => s.setUnreadNotifications);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.notification.list.useInfiniteQuery(
    { limit: compact ? 8 : 20 },
    { getNextPageParam: (last) => last.nextCursor },
  );

  const utils = trpc.useUtils();

  const markAllRead = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
      setUnread(0);
    },
  });

  const deleteAll = trpc.notification.deleteAll.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
      setUnread(0);
    },
  });

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Bell className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">暂无通知</p>
      </div>
    );
  }

  return (
    <div>
      {!compact && (
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => markAllRead.mutate({ all: true })}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            全部已读
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-destructive hover:text-destructive"
            onClick={() => deleteAll.mutate()}
            disabled={deleteAll.isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            清空
          </Button>
        </div>
      )}
      <div className="divide-y">
        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n as Parameters<typeof NotificationItem>[0]["notification"]} onNavigate={onNavigate} />
        ))}
      </div>
      {!compact && hasNextPage && (
        <div className="p-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            加载更多
          </Button>
        </div>
      )}
    </div>
  );
}
