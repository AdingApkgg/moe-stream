"use client";

import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ui/markdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Image,
  Code,
  SquareCode,
  List,
  ListOrdered,
  Quote,
  Table,
  Minus,
  Eye,
  Pencil,
} from "lucide-react";

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
  template?: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: Heading1, label: "一级标题", prefix: "# ", suffix: "" },
  { icon: Heading2, label: "二级标题", prefix: "## ", suffix: "" },
  { icon: Heading3, label: "三级标题", prefix: "### ", suffix: "" },
  { icon: Bold, label: "粗体", prefix: "**", suffix: "**" },
  { icon: Italic, label: "斜体", prefix: "*", suffix: "*" },
  { icon: Strikethrough, label: "删除线", prefix: "~~", suffix: "~~" },
  { icon: Link, label: "链接", prefix: "[", suffix: "](url)" },
  { icon: Image, label: "图片", prefix: "![alt](", suffix: ")" },
  { icon: Code, label: "行内代码", prefix: "`", suffix: "`" },
  { icon: SquareCode, label: "代码块", prefix: "```\n", suffix: "\n```", block: true },
  { icon: List, label: "无序列表", prefix: "- ", suffix: "" },
  { icon: ListOrdered, label: "有序列表", prefix: "1. ", suffix: "" },
  { icon: Quote, label: "引用", prefix: "> ", suffix: "" },
  {
    icon: Table,
    label: "表格",
    prefix: "",
    suffix: "",
    template: "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |",
  },
  { icon: Minus, label: "分割线", prefix: "\n---\n", suffix: "", block: true },
];

export interface MdxEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  minHeight?: string;
}

export interface MdxEditorRef {
  focus: () => void;
}

export const MdxEditor = forwardRef<MdxEditorRef, MdxEditorProps>(function MdxEditor(
  { value = "", onChange, placeholder, className, maxLength, minHeight = "200px" },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const insertMarkdown = useCallback(
    (action: ToolbarAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end);
      let newText: string;
      let cursorPos: number;

      if (action.template) {
        const before = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
        newText = value.slice(0, start) + before + action.template + value.slice(end);
        cursorPos = start + before.length + action.template.length;
      } else if (action.block && !selected) {
        const before = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
        newText = value.slice(0, start) + before + action.prefix + action.suffix + value.slice(end);
        cursorPos = start + before.length + action.prefix.length;
      } else {
        newText = value.slice(0, start) + action.prefix + (selected || "") + action.suffix + value.slice(end);
        cursorPos = selected
          ? start + action.prefix.length + selected.length + action.suffix.length
          : start + action.prefix.length;
      }

      onChange?.(newText);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.selectionStart = cursorPos;
        textarea.selectionEnd = cursorPos;
      });
    },
    [value, onChange],
  );

  return (
    <div className={cn("rounded-lg border bg-background overflow-hidden", className)}>
      {/* Header: tabs + toolbar */}
      <div className="flex items-center justify-between border-b px-2 py-1.5 gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "edit" | "preview")} className="shrink-0">
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="edit" className="h-6 px-2.5 text-xs gap-1">
              <Pencil className="h-3 w-3" />
              编辑
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-6 px-2.5 text-xs gap-1">
              <Eye className="h-3 w-3" />
              预览
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "edit" && (
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide min-w-0">
              {TOOLBAR_ACTIONS.map((action) => (
                <Tooltip key={action.label}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => insertMarkdown(action)}
                    >
                      <action.icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {action.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Body */}
      {tab === "edit" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full resize-y bg-transparent px-3 py-2.5 text-sm",
              "placeholder:text-muted-foreground focus:outline-none",
              "font-mono leading-relaxed",
            )}
            style={{ minHeight }}
          />
          {maxLength && (
            <div className="absolute bottom-1.5 right-3 text-[10px] text-muted-foreground/60">
              {value.length}/{maxLength}
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 py-2.5" style={{ minHeight }}>
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <p className="text-sm text-muted-foreground italic">暂无内容</p>
          )}
        </div>
      )}
    </div>
  );
});
