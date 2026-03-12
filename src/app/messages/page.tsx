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
import { ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { session, isLoading: sessionLoading } = useStableSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);

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
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                私信
              </h2>
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
              </div>
            )}
          </div>
        </div>
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
