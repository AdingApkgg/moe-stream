"use client";

import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  userNames: string[];
  className?: string;
}

export function TypingIndicator({ userNames, className }: TypingIndicatorProps) {
  if (userNames.length === 0) return null;

  let text: string;
  if (userNames.length === 1) {
    text = `${userNames[0]} 正在输入`;
  } else if (userNames.length === 2) {
    text = `${userNames[0]} 和 ${userNames[1]} 正在输入`;
  } else {
    text = `${userNames[0]} 等 ${userNames.length} 人正在输入`;
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground px-4 py-1", className)}>
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
      <span>{text}</span>
    </div>
  );
}
