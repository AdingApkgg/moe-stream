"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { useSocketStore } from "@/stores/socket";

interface TypingUser {
  userId: string;
  timestamp: number;
}

const TYPING_TIMEOUT = 3000;

export function useTyping(scope: "conversation" | "channel", targetId: string | undefined) {
  const connected = useSocketStore((s) => s.connected);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const startEvent = scope === "conversation" ? "typing:start" : "channel:typing:start";
  const stopEvent = scope === "conversation" ? "typing:stop" : "channel:typing:stop";
  const keyField = scope === "conversation" ? "conversationId" : "channelId";

  const emitStart = useCallback(() => {
    if (!connected || !targetId || isTypingRef.current) return;
    const socket = getSocket();
    isTypingRef.current = true;
    socket.emit(startEvent, { [keyField]: targetId });
  }, [connected, targetId, startEvent, keyField]);

  const emitStop = useCallback(() => {
    if (!connected || !targetId || !isTypingRef.current) return;
    const socket = getSocket();
    isTypingRef.current = false;
    socket.emit(stopEvent, { [keyField]: targetId });
  }, [connected, targetId, stopEvent, keyField]);

  const onInput = useCallback(() => {
    emitStart();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitStop();
    }, 2000);
  }, [emitStart, emitStop]);

  useEffect(() => {
    if (!connected || !targetId) return;
    const socket = getSocket();

    const handleStart = (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== data.userId);
        return [...filtered, { userId: data.userId, timestamp: Date.now() }];
      });
    };

    const handleStop = (data: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    };

    socket.on(startEvent, handleStart);
    socket.on(stopEvent, handleStop);

    const cleanup = setInterval(() => {
      setTypingUsers((prev) => prev.filter((u) => Date.now() - u.timestamp < TYPING_TIMEOUT));
    }, 1000);

    return () => {
      socket.off(startEvent, handleStart);
      socket.off(stopEvent, handleStop);
      clearInterval(cleanup);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      emitStop();
    };
  }, [connected, targetId, startEvent, stopEvent, emitStop]);

  return { typingUsers, onInput };
}
