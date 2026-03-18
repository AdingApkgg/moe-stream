"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { useSocketStore } from "@/stores/socket";
import { NotificationList } from "./notification-list";
import { useStableSession } from "@/lib/hooks";
import { useState } from "react";
import Link from "next/link";

export function NotificationBell() {
  const { session } = useStableSession();
  const [open, setOpen] = useState(false);

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(
    undefined,
    {
      enabled: !!session?.user,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  );

  const storeUnread = useSocketStore((s) => s.unreadNotifications);
  const count = unreadCount ?? storeUnread;

  if (!session?.user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label="通知"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0 rounded-xl"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">通知</h3>
          <Link
            href="/notifications"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            查看全部
          </Link>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <NotificationList compact onNavigate={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
