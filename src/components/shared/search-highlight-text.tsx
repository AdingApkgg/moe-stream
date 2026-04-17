"use client";

import { memo } from "react";
import { buildHighlightSegments } from "@/lib/search-text";

interface SearchHighlightTextProps {
  text: string;
  highlightQuery?: string | null;
  className?: string;
}

/** 在搜索结果中按关键词高亮子串（多词、忽略大小写） */
function SearchHighlightTextComponent({ text, highlightQuery, className }: SearchHighlightTextProps) {
  const q = highlightQuery?.trim();
  if (!q) {
    return <span className={className}>{text}</span>;
  }

  const segments = buildHighlightSegments(text, q);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="rounded-sm bg-primary/25 px-0.5 text-inherit font-inherit">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

export const SearchHighlightText = memo(SearchHighlightTextComponent);
