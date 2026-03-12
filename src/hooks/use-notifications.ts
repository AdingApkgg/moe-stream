"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { useSocketStore } from "@/stores/socket";
import { trpc } from "@/lib/trpc";

export function useNotifications(userId: string | undefined) {
  const connected = useSocketStore((s) => s.connected);
  const incrementUnread = useSocketStore((s) => s.incrementUnreadNotifications);

  const utils = trpc.useUtils();

  useEffect(() => {
    if (!userId || !connected) return;

    const socket = getSocket();

    const handler = () => {
      incrementUnread();
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    };

    socket.on("notification:new", handler);
    return () => {
      socket.off("notification:new", handler);
    };
  }, [userId, connected, incrementUnread, utils]);
}
