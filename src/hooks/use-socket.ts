"use client";

import { useEffect } from "react";
import { getSocket, disconnectSocket } from "@/lib/socket-client";
import { useSocketStore } from "@/stores/socket";

export function useSocket(userId: string | undefined): void {
  const setConnected = useSocketStore((s) => s.setConnected);
  const addOnlineUser = useSocketStore((s) => s.addOnlineUser);
  const removeOnlineUser = useSocketStore((s) => s.removeOnlineUser);

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("presence:online", (data: { userId: string }) => addOnlineUser(data.userId));
    socket.on("presence:offline", (data: { userId: string }) => removeOnlineUser(data.userId));

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("presence:online");
      socket.off("presence:offline");
      disconnectSocket();
      setConnected(false);
    };
  }, [userId, setConnected, addOnlineUser, removeOnlineUser]);
}
