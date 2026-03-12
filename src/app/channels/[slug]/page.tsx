"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { trpc } from "@/lib/trpc";
import { useStableSession } from "@/lib/hooks";
import { getSocket } from "@/lib/socket-client";
import { useSocketStore } from "@/stores/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Hash,
  Users,
  Send,
  Loader2,
  LogIn,
  LogOut as LogOutIcon,
  ArrowLeft,
  Lock,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

export default function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { session } = useStableSession();
  const connected = useSocketStore((s) => s.connected);
  const [showMembers, setShowMembers] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();
  const userId = session?.user?.id;

  const { data: channel, isLoading: channelLoading } = trpc.channel.getBySlug.useQuery({ slug });

  const {
    data: messagesData,
    isLoading: messagesLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.channel.messages.useInfiniteQuery(
    { channelId: channel?.id || "", limit: 30 },
    {
      enabled: !!channel?.id,
      getNextPageParam: (last) => last.nextCursor,
    },
  );

  const { data: membersData } = trpc.channel.members.useQuery(
    { channelId: channel?.id || "", limit: 50 },
    { enabled: !!channel?.id && showMembers },
  );

  const { data: membershipData } = trpc.channel.isMember.useQuery(
    { channelId: channel?.id || "" },
    { enabled: !!channel?.id && !!userId },
  );

  const joinMutation = trpc.channel.join.useMutation({
    onSuccess: () => {
      utils.channel.list.invalidate();
      utils.channel.members.invalidate();
      utils.channel.isMember.invalidate();
    },
  });

  const leaveMutation = trpc.channel.leave.useMutation({
    onSuccess: () => {
      utils.channel.list.invalidate();
      utils.channel.members.invalidate();
      utils.channel.isMember.invalidate();
    },
  });

  const sendMutation = trpc.channel.send.useMutation({
    onSuccess: () => {
      setInput("");
      utils.channel.messages.invalidate({ channelId: channel?.id });
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
  });

  const { mutate: markReadMutate } = trpc.channel.markRead.useMutation();

  useEffect(() => {
    if (channel?.id) {
      markReadMutate({ channelId: channel.id });
    }
  }, [channel?.id, markReadMutate]);

  useEffect(() => {
    if (!connected || !channel?.id) return;
    const socket = getSocket();
    socket.emit("channel:join", channel.id);

    const handleNewMessage = () => {
      utils.channel.messages.invalidate({ channelId: channel.id });
      markReadMutate({ channelId: channel.id });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    const handleDeletedMessage = () => {
      utils.channel.messages.invalidate({ channelId: channel.id });
    };

    socket.on("channel:message:new", handleNewMessage);
    socket.on("channel:message:deleted", handleDeletedMessage);

    return () => {
      socket.emit("channel:leave", channel.id);
      socket.off("channel:message:new", handleNewMessage);
      socket.off("channel:message:deleted", handleDeletedMessage);
    };
  }, [connected, channel?.id, utils, markReadMutate]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messagesData?.pages?.[0]?.messages) scrollToBottom();
  }, [messagesData?.pages?.[0]?.messages?.length, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !channel?.id || sendMutation.isPending) return;
    sendMutation.mutate({ channelId: channel.id, content: trimmed, type: "TEXT" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  if (channelLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Hash className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>频道不存在</p>
      </div>
    );
  }

  const allMessages = messagesData?.pages.flatMap((p) => p.messages).reverse() ?? [];
  const membersList = membersData?.members ?? [];
  const userIsMember = membershipData?.isMember ?? false;

  return (
    <div className="mx-auto max-w-5xl px-0 md:px-4 py-0 md:py-6">
      <div className="bg-card border-y md:border md:rounded-xl overflow-hidden h-[calc(100vh-3.5rem)] md:h-[calc(100vh-7rem)] flex">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" asChild>
                <Link href="/channels">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="font-semibold truncate">{channel.name}</span>
              {channel.type === "PRIVATE" && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                  私有
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {userId && userIsMember && channel.creator?.id !== userId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={leaveMutation.isPending}
                  onClick={() => leaveMutation.mutate({ channelId: channel.id })}
                >
                  <LogOutIcon className="h-3.5 w-3.5" />
                  退出
                </Button>
              )}
              {userId && !userIsMember && channel.type === "PUBLIC" && (
                <Button
                  size="sm"
                  className="text-xs gap-1"
                  disabled={joinMutation.isPending}
                  onClick={() => joinMutation.mutate({ channelId: channel.id })}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  加入
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowMembers(!showMembers)}
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {hasNextPage && (
              <div className="text-center mb-4">
                <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  加载更早消息
                </Button>
              </div>
            )}

            {messagesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {allMessages.map((msg) => {
                  const isMine = msg.senderId === userId;
                  return (
                    <div key={msg.id} className="flex items-start gap-2.5 group">
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarImage src={msg.sender.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {(msg.sender.nickname || msg.sender.username || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={cn("text-sm font-medium", isMine && "text-primary")}>
                            {msg.sender.nickname || msg.sender.username}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {dayjs(msg.createdAt).format("MM/DD HH:mm")}
                          </span>
                        </div>
                        {msg.replyTo && (
                          <div className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 mt-0.5 mb-1 line-clamp-1">
                            回复 {msg.replyTo.sender?.nickname || msg.replyTo.sender?.username}: {msg.replyTo.content?.slice(0, 40)}
                          </div>
                        )}
                        {msg.type === "TEXT" && (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        {msg.type === "IMAGE" && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(msg.metadata as Record<string, string>)?.fileUrl || msg.content || ""}
                            alt="图片"
                            className="max-w-xs rounded-lg mt-1"
                          />
                        )}
                        {msg.type === "STICKER" && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(msg.metadata as Record<string, string>)?.stickerUrl || ""}
                            alt="表情"
                            className="h-24 w-24 object-contain mt-1"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input */}
          {userId && userIsMember ? (
            <div className="border-t bg-background px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder={`在 #${channel.name} 中发言...`}
                  rows={1}
                  className="flex-1 resize-none bg-muted/50 border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[120px]"
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full shrink-0"
                  disabled={!input.trim() || sendMutation.isPending}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground">
              {!userId ? (
                <Link href="/login" className="text-primary hover:underline">登录</Link>
              ) : (
                <span>加入频道后即可发言</span>
              )}
            </div>
          )}
        </div>

        {/* Members sidebar */}
        {showMembers && (
          <div className="w-60 border-l flex flex-col shrink-0 hidden md:flex">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                成员 ({channel._count.members})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {membersList.map((m) => (
                <Link
                  key={m.id}
                  href={`/user/${m.userId}`}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={m.user.avatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {(m.user.nickname || m.user.username || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="text-sm truncate block">
                      {m.user.nickname || m.user.username}
                    </span>
                    {m.role !== "MEMBER" && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {m.role === "OWNER" ? "创建者" : "管理员"}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
