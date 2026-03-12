"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useTyping } from "@/hooks/use-typing";
import { TypingIndicator } from "@/components/shared/typing-indicator";
import { StickerPicker } from "@/components/shared/sticker-picker";
import { ChatFileUpload } from "@/components/shared/chat-file-upload";

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const { typingUsers, onInput: onTypingInput } = useTyping("conversation", conversationId);

  const sendMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      setContent("");
      utils.message.messages.invalidate({ conversationId });
      utils.message.conversations.invalidate();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || sendMutation.isPending) return;

    sendMutation.mutate({
      conversationId,
      content: trimmed,
      type: "TEXT",
    });
  }, [content, conversationId, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTypingInput();
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleStickerSelect = (sticker: { stickerId: string; imageUrl: string; name: string }) => {
    sendMutation.mutate({
      conversationId,
      type: "STICKER",
      metadata: {
        stickerId: sticker.stickerId,
        stickerUrl: sticker.imageUrl,
        stickerName: sticker.name,
      },
    });
  };

  const handleFileUpload = (file: { url: string; name: string; size: number; type: string }) => {
    const isImage = file.type.startsWith("image/");
    sendMutation.mutate({
      conversationId,
      type: isImage ? "IMAGE" : "FILE",
      metadata: {
        fileUrl: file.url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });
  };

  const typingNames = typingUsers.map((u) => u.userId.slice(0, 6));

  return (
    <div className="border-t bg-background">
      <TypingIndicator userNames={typingNames} />
      <div className="px-4 py-3">
        <div className="flex items-end gap-1">
          <ChatFileUpload onUpload={handleFileUpload} />
          <StickerPicker onSelect={handleStickerSelect} />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 resize-none bg-muted/50 border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[120px]"
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            disabled={!content.trim() || sendMutation.isPending}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
