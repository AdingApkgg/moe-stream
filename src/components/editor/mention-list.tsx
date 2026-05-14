"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MentionItem {
  id: string;
  label: string;
  username: string;
  avatar: string | null;
}

export interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

type Props = SuggestionProps<MentionItem>;

export const MentionList = forwardRef<MentionListRef, Props>(function MentionList(props, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (!item) return;
    props.command({ id: item.id, label: item.label });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + props.items.length - 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        selectItem(selected);
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length) {
    return (
      <div className="w-64 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">无匹配用户</div>
    );
  }

  return (
    <div className="w-64 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
      {props.items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => selectItem(i)}
          onMouseEnter={() => setSelected(i)}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
            i === selected ? "bg-accent" : "hover:bg-accent/60",
          )}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={item.avatar ?? undefined} />
            <AvatarFallback className="text-[10px]">{item.label.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{item.label}</div>
            <div className="truncate text-xs text-muted-foreground">@{item.username}</div>
          </div>
        </button>
      ))}
    </div>
  );
});
