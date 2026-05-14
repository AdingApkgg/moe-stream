"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BubbleProps {
  editor: Editor;
}

/** 选区出现时的浮动行内格式条。*/
export function FloatingBubbleMenu({ editor }: BubbleProps) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor, from, to }) => {
        if (from === to) return false;
        // 在媒体节点等 atomic 节点上不显示
        if (editor.isActive("bilibiliEmbed") || editor.isActive("youtubeEmbed") || editor.isActive("neteaseEmbed")) {
          return false;
        }
        return true;
      }}
    >
      <div className="flex items-center gap-0.5 rounded-md border bg-popover p-0.5 shadow-md">
        <BtnIcon
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          Icon={Bold}
          label="粗体"
        />
        <BtnIcon
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          Icon={Italic}
          label="斜体"
        />
        <BtnIcon
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          Icon={Strikethrough}
          label="删除线"
        />
        <BtnIcon
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          Icon={Code}
          label="行内代码"
        />
        <BtnIcon active={editor.isActive("link")} onClick={setLink} Icon={LinkIcon} label="链接" />
      </div>
    </BubbleMenu>
  );
}

function BtnIcon({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded text-foreground/80 hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
