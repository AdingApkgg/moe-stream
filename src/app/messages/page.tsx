"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStableSession } from "@/lib/hooks";
import { trpc } from "@/lib/trpc";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessageThread } from "@/components/messages/message-thread";
import { MessageInput } from "@/components/messages/message-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, MessageSquare, Plus, Search, Loader2, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks";

export default function MessagesPage() {
  const { session, isLoading: sessionLoading } = useStableSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const targetUser = searchParams.get("user");

  const getOrCreate = trpc.message.getOrCreate.useMutation({
    onSuccess: (data) => {
      setActiveConversation(data.conversationId);
    },
  });

  useEffect(() => {
    if (targetUser && session?.user) {
      getOrCreate.mutate({ userId: targetUser });
    }
  }, [targetUser, session?.user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionLoading && !session?.user) {
      router.push("/login");
    }
  }, [sessionLoading, session, router]);

  const handleStartConversation = (userId: string) => {
    setShowNewDialog(false);
    getOrCreate.mutate({ userId });
  };

  if (sessionLoading || !session?.user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-0 md:px-4 py-0 md:py-6">
      <div className="bg-card border-y md:border md:rounded-xl overflow-hidden h-[calc(100vh-3.5rem)] md:h-[calc(100vh-7rem)]">
        <div className="flex h-full">
          {/* Left: Conversation list */}
          <div
            className={cn(
              "w-full md:w-80 border-r flex flex-col shrink-0",
              activeConversation ? "hidden md:flex" : "flex",
            )}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                私信
              </h2>
              <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>发起新对话</DialogTitle>
                  </DialogHeader>
                  <UserSearchList onSelect={handleStartConversation} />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                activeId={activeConversation || undefined}
                onSelect={setActiveConversation}
              />
            </div>
          </div>

          {/* Right: Message thread */}
          <div
            className={cn(
              "flex-1 flex flex-col min-w-0",
              !activeConversation ? "hidden md:flex" : "flex",
            )}
          >
            {activeConversation ? (
              <ActiveChat
                conversationId={activeConversation}
                onBack={() => setActiveConversation(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">选择一个对话开始聊天</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowNewDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  发起新对话
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserSearchList({ onSelect }: { onSelect: (userId: string) => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = trpc.user.search.useQuery(
    { query: debouncedQuery, limit: 15 },
    { enabled: debouncedQuery.length >= 1 },
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索用户名..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>
      <div className="max-h-64 overflow-y-auto -mx-2">
        {isLoading && debouncedQuery && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {data?.users && data.users.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <UserIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            未找到用户
          </div>
        )}
        {data?.users?.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user.id)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="text-xs">
                {(user.nickname || user.username || "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium truncate">{user.nickname || user.username}</p>
              {user.email && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
          </button>
        ))}
        {!debouncedQuery && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            输入用户名开始搜索
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveChat({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { data: convData } = trpc.message.conversations.useQuery({ limit: 50 });
  const conv = convData?.conversations.find((c) => c.id === conversationId);
  const otherUser = conv?.otherUser;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={otherUser?.avatar || undefined} />
          <AvatarFallback className="text-xs">
            {(otherUser?.nickname || otherUser?.username || "?")[0]}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm truncate">
          {otherUser?.nickname || otherUser?.username || "加载中..."}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MessageThread conversationId={conversationId} />
      </div>
      <MessageInput conversationId={conversationId} />
    </>
  );
}
