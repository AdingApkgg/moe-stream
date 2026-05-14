"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { buildExtensions, type EditorVariant } from "./extensions/shared";
import { EditorToolbar } from "./toolbar";
import { useMentionFetcher } from "./use-mention-fetcher";
import { getCharacterCount, getMarkdown } from "./markdown";

export interface CommentEditorRef {
  insertText: (text: string) => void;
  clear: () => void;
  focus: () => void;
  getMarkdown: () => string;
}

export interface CommentEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
  minHeight?: string;
  /** 隐藏工具栏（用于聊天/超紧凑场景）。*/
  hideToolbar?: boolean;
  /** 关闭 @mention（如未登录访客评论场景）。*/
  disableMention?: boolean;
  /** Cmd/Ctrl+Enter 提交回调。*/
  onSubmit?: () => void;
  variant?: Extract<EditorVariant, "comment">;
}

/**
 * 轻量级 Tiptap 评论编辑器。
 * 内容以 Markdown 文本读写（value/onChange 始终是 markdown string）。
 */
export const CommentEditor = forwardRef<CommentEditorRef, CommentEditorProps>(function CommentEditor(
  {
    value,
    onChange,
    placeholder,
    maxLength,
    autoFocus,
    className,
    minHeight = "80px",
    hideToolbar = false,
    disableMention = false,
    onSubmit,
  },
  ref,
) {
  const mentionFetcher = useMentionFetcher();

  const extensions = useMemo(
    () =>
      buildExtensions({
        variant: "comment",
        placeholder,
        maxLength,
        mentionFetcher: disableMention ? null : mentionFetcher,
      }),
    [placeholder, maxLength, disableMention, mentionFetcher],
  );

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn("tiptap prose-comment focus:outline-none px-3 py-2.5 text-sm leading-relaxed"),
        style: `min-height: ${minHeight};`,
      },
      handleKeyDown: (_, event) => {
        if (onSubmit && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(getMarkdown(editor));
    },
  });

  // 受控同步：仅在外部 value 与编辑器当前 markdown 不一致时重写
  useEffect(() => {
    if (!editor) return;
    if (value !== getMarkdown(editor)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
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

  return (
    <div className={cn("rounded-lg border bg-background overflow-hidden", className)}>
      {!hideToolbar && (
        <div className="flex items-center border-b px-2 py-1">
          <EditorToolbar editor={editor} variant="comment" />
        </div>
      )}
      <div className="relative">
        <EditorContent editor={editor} />
        {maxLength != null && (
          <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/60 pointer-events-none">
            {count}/{maxLength}
          </div>
        )}
      </div>
    </div>
  );
});
