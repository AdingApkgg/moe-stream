"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { Columns2, Eye, Maximize2, Minimize2, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { buildExtensions, type EditorVariant } from "./extensions/shared";
import { EditorToolbar } from "./toolbar";
import { useMentionFetcher } from "./use-mention-fetcher";
import { getCharacterCount, getMarkdown } from "./markdown";
import { RichContent } from "./rich-content";
import { expandShortcodes } from "./markdown-preprocess";
import { FloatingBubbleMenu } from "./bubble-menu";
import { FloatingHintMenu } from "./floating-menu";

export interface PostEditorRef {
  insertText: (text: string) => void;
  clear: () => void;
  focus: () => void;
  getMarkdown: () => string;
}

export interface PostEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  minHeight?: string;
  autoFocus?: boolean;
  /** 关闭 @mention（多数 Post 场景登录用户都可以 @人，默认开启）。*/
  disableMention?: boolean;
  /** "post"（默认）= 视频/图片简介；"doc" = 游戏/管理员长文，工具栏更全（含 h3/hr/codeblock）。*/
  variant?: Extract<EditorVariant, "post" | "doc">;
}

type Mode = "edit" | "preview" | "split";

const MODE_PREF_KEY = "moe.editor.mode";

function readModePref(): Mode {
  if (typeof window === "undefined") return "edit";
  const raw = window.localStorage.getItem(MODE_PREF_KEY);
  return raw === "split" || raw === "preview" ? raw : "edit";
}

/**
 * 中等富文本编辑器：评论扩展 + 标题/引用/代码块/图片插入 + 编辑/预览/分屏 / 全屏写作。
 * 用于视频简介、图片简介、用户 bio 等"段落级"场景；doc 变体可插入富媒体快捷码。
 */
export const PostEditor = forwardRef<PostEditorRef, PostEditorProps>(function PostEditor(
  {
    value,
    onChange,
    placeholder,
    maxLength,
    className,
    minHeight = "180px",
    autoFocus,
    disableMention = false,
    variant = "post",
  },
  ref,
) {
  const [mode, setMode] = useState<Mode>("edit");
  const [fullscreen, setFullscreen] = useState(false);
  const mentionFetcher = useMentionFetcher();

  // 持久化 mode 偏好，避免每次都从 edit 开始
  useEffect(() => {
    setMode(readModePref());
  }, []);

  const updateMode = (next: Mode) => {
    setMode(next);
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_PREF_KEY, next);
  };

  const extensions = useMemo(
    () =>
      buildExtensions({
        variant,
        placeholder,
        maxLength,
        mentionFetcher: disableMention ? null : mentionFetcher,
      }),
    [variant, placeholder, maxLength, disableMention, mentionFetcher],
  );

  const editor = useEditor({
    extensions,
    content: expandShortcodes(value),
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none px-3 py-2.5 text-sm leading-relaxed",
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => onChange(getMarkdown(editor)),
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== getMarkdown(editor)) {
      editor.commands.setContent(expandShortcodes(value), { emitUpdate: false });
    }
  }, [editor, value]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => editor?.chain().focus().insertContent(text).run(),
      clear: () => {
        editor?.commands.clearContent();
        onChange("");
      },
      focus: () => editor?.commands.focus("end"),
      getMarkdown: () => (editor ? getMarkdown(editor) : ""),
    }),
    [editor, onChange],
  );

  const count = editor ? getCharacterCount(editor) : 0;
  const effectiveMinHeight = fullscreen ? "calc(100vh - 12rem)" : minHeight;

  const body = (
    <div
      className={cn(
        "rounded-lg border bg-background overflow-hidden flex flex-col",
        fullscreen ? "h-full" : "",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5 shrink-0">
        <Tabs value={mode} onValueChange={(v) => updateMode(v as Mode)} className="shrink-0">
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="edit" className="h-6 px-2.5 text-xs gap-1">
              <Pencil className="h-3 w-3" />
              编辑
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-6 px-2.5 text-xs gap-1">
              <Eye className="h-3 w-3" />
              预览
            </TabsTrigger>
            <TabsTrigger value="split" className="h-6 px-2.5 text-xs gap-1 hidden md:inline-flex">
              <Columns2 className="h-3 w-3" />
              分屏
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 min-w-0">
          {mode !== "preview" && <EditorToolbar editor={editor} variant={variant} className="min-w-0" />}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setFullscreen((v) => !v)}
                >
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {fullscreen ? "退出全屏" : "全屏写作"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {mode === "edit" && (
        <div className={cn("relative", fullscreen && "flex-1 overflow-auto")}>
          <EditorContent editor={editor} />
          {editor && (
            <>
              <FloatingBubbleMenu editor={editor} />
              <FloatingHintMenu editor={editor} />
            </>
          )}
          {maxLength != null && (
            <div className="absolute bottom-1.5 right-3 text-[10px] text-muted-foreground/60 pointer-events-none">
              {count}/{maxLength}
            </div>
          )}
        </div>
      )}
      {mode === "preview" && (
        <div
          className={cn("px-3 py-2.5", fullscreen && "flex-1 overflow-auto")}
          style={{ minHeight: effectiveMinHeight }}
        >
          {value.trim() ? (
            <RichContent markdown={value} />
          ) : (
            <p className="text-sm text-muted-foreground italic">暂无内容</p>
          )}
        </div>
      )}
      {mode === "split" && (
        <div className={cn("grid grid-cols-2 divide-x", fullscreen && "flex-1 overflow-hidden")}>
          <div className={cn("relative", fullscreen ? "overflow-auto" : "")}>
            <EditorContent editor={editor} />
            {maxLength != null && (
              <div className="absolute bottom-1.5 right-3 text-[10px] text-muted-foreground/60 pointer-events-none">
                {count}/{maxLength}
              </div>
            )}
          </div>
          <div
            className={cn("px-3 py-2.5 bg-muted/20", fullscreen ? "overflow-auto" : "")}
            style={{ minHeight: effectiveMinHeight }}
          >
            {value.trim() ? (
              <RichContent markdown={value} />
            ) : (
              <p className="text-sm text-muted-foreground italic">实时预览…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <Dialog open onOpenChange={(open) => !open && setFullscreen(false)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[min(1200px,96vw)] w-[min(1200px,96vw)] h-[92vh] p-3 sm:p-4 gap-0 !flex !flex-col"
        >
          <VisuallyHidden>
            <DialogTitle>全屏写作</DialogTitle>
          </VisuallyHidden>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return body;
});
