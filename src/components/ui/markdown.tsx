"use client";

import { RichContent } from "@/components/editor/rich-content";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * 客户端 Markdown 渲染器 - 用于客户端组件中渲染 Markdown 字符串。
 * 内部直接转发到 RichContent，统一支持 @mention / 行内短代码 / 块级短代码（callout/hidden/details/gallery）。
 *
 * @deprecated 历史调用入口，建议直接使用 `<RichContent />` 以便传入 hiddenVisibility 等扩展项。
 */
export function Markdown({ content, className }: MarkdownProps) {
  return <RichContent markdown={content} className={className} />;
}
