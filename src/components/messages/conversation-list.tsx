"use client";

import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Loader2, MessageSquare } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

interface ConversationListProps {
  activeId?: string;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({ activeId, onSelect }: ConversationListProps) {
  const { data, isLoading } = trpc.message.conversations.useQuery(
    { limit: 50 },
    {
      staleTime: 30_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const conversations = data?.conversations ?? [];

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">暂无对话</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conv) => {
        const user = conv.otherUser;
        const lastMsg = conv.lastMessage;
        const isActive = conv.id === activeId;

        let preview = "暂无消息";
        if (lastMsg) {
          if (lastMsg.type === "TEXT") {
            preview = lastMsg.content?.slice(0, 40) ?? "";
          } else if (lastMsg.type === "IMAGE") {
            preview = "[图片]";
          } else if (lastMsg.type === "FILE") {
            preview = "[文件]";
          } else if (lastMsg.type === "STICKER") {
            preview = "[表情]";
          }
        }

        return (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
              isActive && "bg-accent",
            )}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={user?.avatar || undefined} />
              <AvatarFallback>
                {(user?.nickname || user?.username || "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">
                  {user?.nickname || user?.username || "未知用户"}
                </span>
                {lastMsg && (
                  <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-2">
                    {dayjs(lastMsg.createdAt).fromNow()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground truncate flex-1">
                  {preview}
                </p>
                {conv.unreadCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shrink-0">
                    {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
