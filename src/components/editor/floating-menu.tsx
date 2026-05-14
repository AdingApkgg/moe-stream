"use client";

import type { Editor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { Plus } from "lucide-react";

interface Props {
  editor: Editor;
}

/** 空段开头处显示 "/" 提示按钮，点击会自动键入 "/" 触发 SlashCommand。*/
export function FloatingHintMenu({ editor }: Props) {
  const insertSlash = () => {
    editor.chain().focus().insertContent("/").run();
  };

  return (
    <FloatingMenu
      editor={editor}
      options={{ placement: "left", offset: 6 }}
      shouldShow={({ editor, state }) => {
        const { $from } = state.selection;
        const parent = $from.parent;
        // 仅在空段落里显示
        if (parent.type.name !== "paragraph") return false;
        if (parent.content.size !== 0) return false;
        // 不在表格、列表、引用、callout 内显示，避免重复
        if (
          editor.isActive("bulletList") ||
          editor.isActive("orderedList") ||
          editor.isActive("blockquote") ||
          editor.isActive("codeBlock") ||
          editor.isActive("callout") ||
          editor.isActive("hiddenContent") ||
          editor.isActive("details")
        ) {
          return false;
        }
        return true;
      }}
    >
      <button
        type="button"
        onClick={insertSlash}
        className="inline-flex items-center gap-1 rounded-md border bg-popover px-1.5 py-0.5 text-[11px] text-muted-foreground shadow-sm hover:text-foreground hover:bg-accent"
        title="点击或输入 / 插入块"
      >
        <Plus className="h-3 w-3" />
        <span>/</span>
      </button>
    </FloatingMenu>
  );
}
