import type { Editor } from "@tiptap/react";

/** tiptap-markdown 注册的 storage 接口（未导出 module augmentation，手动声明）。*/
interface MarkdownStorage {
  getMarkdown: () => string;
}

/** 字符计数 storage。*/
interface CharacterCountStorage {
  characters: (options?: { node?: unknown; mode?: "textSize" | "nodeSize" }) => number;
  words: (options?: { node?: unknown }) => number;
}

/**
 * 从 Tiptap 编辑器实例中提取当前 Markdown 字符串。
 * 若 tiptap-markdown 未注册（理论上不可能），回退到纯文本。
 */
export function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as Record<string, unknown>;
  const md = storage.markdown as MarkdownStorage | undefined;
  if (md && typeof md.getMarkdown === "function") {
    return md.getMarkdown();
  }
  return editor.getText();
}

/** 字符数（不计 markdown 符号）。*/
export function getCharacterCount(editor: Editor): number {
  const storage = editor.storage as unknown as Record<string, unknown>;
  const cc = storage.characterCount as CharacterCountStorage | undefined;
  return cc?.characters?.() ?? 0;
}

/** 字数（按词）。*/
export function getWordCount(editor: Editor): number {
  const storage = editor.storage as unknown as Record<string, unknown>;
  const cc = storage.characterCount as CharacterCountStorage | undefined;
  return cc?.words?.() ?? 0;
}
