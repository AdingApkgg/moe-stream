"use client";

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useStableSession } from "@/lib/hooks";
import { getSocket } from "@/lib/socket-client";
import { useSocketStore } from "@/stores/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { Loader2, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

interface MessageThreadProps {
  conversationId: string;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const redirectOpts = useRedirectOptions();
  const { session } = useStableSession();
  const connected = useSocketStore((s) => s.connected);
  const setActiveConversation = useSocketStore((s) => s.setActiveConversation);
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const userId = session?.user?.id;

  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = trpc.message.messages.useInfiniteQuery(
    { conversationId, limit: 30 },
    { getNextPageParam: (last) => last.nextCursor },
  );

  const markRead = trpc.message.markRead.useMutation();
  const markReadRef = useRef(markRead.mutate);

  useEffect(() => {
    markReadRef.current = markRead.mutate;
  });

  useEffect(() => {
    if (conversationId) {
      markReadRef.current({ conversationId });
    }
  }, [conversationId]);

  useEffect(() => {
    if (!connected || !conversationId) return;

    const socket = getSocket();
    socket.emit("conversation:join", conversationId);

    const handleNewMessage = () => {
      utils.message.messages.invalidate({ conversationId });
      utils.message.conversations.invalidate();
      markReadRef.current({ conversationId });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    const handleDeletedMessage = () => {
      utils.message.messages.invalidate({ conversationId });
    };

    const handleReadReceipt = () => {
      utils.message.messages.invalidate({ conversationId });
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeletedMessage);
    socket.on("message:read", handleReadReceipt);

    return () => {
      socket.emit("conversation:leave", conversationId);
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeletedMessage);
      socket.off("message:read", handleReadReceipt);
    };
  }, [connected, conversationId, utils]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (data?.pages?.[0]?.messages) {
      scrollToBottom();
    }
  }, [data?.pages?.[0]?.messages?.length, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allMessages = data?.pages.flatMap((p) => p.messages).reverse() ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4">
      {hasNextPage && (
        <div className="text-center mb-4">
          <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            加载更早消息
          </Button>
        </div>
      )}

      <div className="flex-1 space-y-3">
        {allMessages.map((msg) => {
          const isMine = msg.senderId === userId;
          return (
            <div key={msg.id} className={cn("flex items-end gap-2", isMine ? "flex-row-reverse" : "")}>
              {!isMine && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={msg.sender.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {(msg.sender.nickname || msg.sender.username || "?")[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
                  isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md",
                )}
              >
                {msg.type === "TEXT" && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                {msg.type === "IMAGE" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(msg.metadata as Record<string, string>)?.fileUrl || msg.content || ""}
                    alt="图片"
                    className="max-w-full rounded-lg"
                  />
                )}
                {msg.type === "STICKER" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(msg.metadata as Record<string, string>)?.stickerUrl || ""}
                    alt="表情"
                    className="h-24 w-24 object-contain"
                  />
                )}
                {msg.type === "FILE" && (
                  <a
                    href={getRedirectUrl((msg.metadata as Record<string, string>)?.fileUrl || "#", redirectOpts)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {(msg.metadata as Record<string, string>)?.fileName || "文件"}
                  </a>
                )}
                <div
                  className={cn(
                    "flex items-center gap-1 mt-1",
                    isMine ? "text-primary-foreground/60 justify-end" : "text-muted-foreground/60",
                  )}
                >
                  <span className="text-[10px]">{dayjs(msg.createdAt).format("HH:mm")}</span>
                  {isMine && <CheckCheck className="h-3 w-3" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
