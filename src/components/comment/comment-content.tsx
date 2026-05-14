"use client";

import { RichContent } from "@/components/editor/rich-content";

interface CommentContentProps {
  content: string;
  className?: string;
}

/**
 * 评论内容渲染器：Markdown + @mention + 表情贴图。
 * 历史 textarea 时代的纯文本评论也兼容（markdown 段落渲染纯文本无副作用）。
 */
export function CommentContent({ content, className }: CommentContentProps) {
  return <RichContent markdown={content} compact className={className} />;
}
