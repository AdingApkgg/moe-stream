"use client";

import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  SquareCode,
  Minus,
  Image as ImageIcon,
} from "lucide-react";

export type ToolbarVariant = "comment" | "post" | "doc";

interface ToolbarProps {
  editor: Editor | null;
  variant?: ToolbarVariant;
  className?: string;
}

interface ItemDef {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: () => boolean;
  run: () => void;
  variants: ToolbarVariant[];
}

export function EditorToolbar({ editor, variant = "post", className }: ToolbarProps) {
  if (!editor) return null;

  const items: ItemDef[] = [
    {
      key: "h1",
      icon: Heading1,
      label: "一级标题",
      active: () => editor.isActive("heading", { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      variants: ["post", "doc"],
    },
    {
      key: "h2",
      icon: Heading2,
      label: "二级标题",
      active: () => editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      variants: ["post", "doc"],
    },
    {
      key: "h3",
      icon: Heading3,
      label: "三级标题",
      active: () => editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      variants: ["doc"],
    },
    {
      key: "bold",
      icon: Bold,
      label: "粗体",
      active: () => editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
      variants: ["comment", "post", "doc"],
    },
    {
      key: "italic",
      icon: Italic,
      label: "斜体",
      active: () => editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
      variants: ["comment", "post", "doc"],
    },
    {
      key: "strike",
      icon: Strikethrough,
      label: "删除线",
      active: () => editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
      variants: ["comment", "post", "doc"],
    },
    {
      key: "code",
      icon: Code,
      label: "行内代码",
      active: () => editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
      variants: ["comment", "post", "doc"],
    },
    {
      key: "link",
      icon: LinkIcon,
      label: "链接",
      active: () => editor.isActive("link"),
      run: () => {
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("链接地址", prev ?? "https://");
        if (url === null) return;
        if (url === "") {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      },
      variants: ["comment", "post", "doc"],
    },
    {
      key: "ul",
      icon: List,
      label: "无序列表",
      active: () => editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
      variants: ["comment", "post", "doc"],
    },
    {
      key: "ol",
      icon: ListOrdered,
      label: "有序列表",
      active: () => editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
      variants: ["comment", "post", "doc"],
    },
    {
      key: "quote",
      icon: Quote,
      label: "引用",
      active: () => editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
      variants: ["post", "doc"],
    },
    {
      key: "codeblock",
      icon: SquareCode,
      label: "代码块",
      active: () => editor.isActive("codeBlock"),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
      variants: ["post", "doc"],
    },
    {
      key: "image",
      icon: ImageIcon,
      label: "插入图片",
      run: () => {
        const url = window.prompt("图片地址", "https://");
        if (!url) return;
        editor.chain().focus().setImage({ src: url }).run();
      },
      variants: ["post", "doc"],
    },
    {
      key: "hr",
      icon: Minus,
      label: "分割线",
      run: () => editor.chain().focus().setHorizontalRule().run(),
      variants: ["doc"],
    },
  ];

  const visible = items.filter((it) => it.variants.includes(variant));

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-0.5 overflow-x-auto scrollbar-hide", className)}>
        {visible.map((item) => (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7 shrink-0", item.active?.() && "bg-accent text-accent-foreground")}
                onClick={item.run}
              >
                <item.icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}
        {(variant === "post" || variant === "doc") && (
          <>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
            <span className="shrink-0 text-[10px] text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/40 hidden md:inline">
              输入 / 插入块
            </span>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
