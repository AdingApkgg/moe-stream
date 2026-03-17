"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { useSocketStore } from "@/stores/socket";
import { trpc } from "@/lib/trpc";

export function useNotifications(userId: string | undefined) {
  const connected = useSocketStore((s) => s.connected);
  const incrementUnreadNotif = useSocketStore((s) => s.incrementUnreadNotifications);
  const incrementUnreadMsg = useSocketStore((s) => s.incrementUnreadMessages);

  const utils = trpc.useUtils();

  useEffect(() => {
    if (!userId || !connected) return;

    const socket = getSocket();

    const handleNotification = () => {
      incrementUnreadNotif();
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    };

    const handleUnreadMessage = () => {
      incrementUnreadMsg();
      utils.message.conversations.invalidate();
    };

    socket.on("notification:new", handleNotification);
    socket.on("message:unread", handleUnreadMessage);
    return () => {
      socket.off("notification:new", handleNotification);
      socket.off("message:unread", handleUnreadMessage);
    };
  }, [userId, connected, incrementUnreadNotif, incrementUnreadMsg, utils]);
}
