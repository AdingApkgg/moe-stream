"use client";

import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendingTag {
  id: string;
  name: string;
  slug: string;
  total: number;
}

/**
 * 综合页热门标签 chips：跨视频/图片/游戏三类的标签内容总量排序。
 * 点击跳到 /tag/[slug] 全站标签页（视频/图片/游戏混合展示）。
 */
export function CompositeTrendingTags({ tags }: { tags: TrendingTag[] }) {
  if (tags.length === 0) return null;
  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <Hash className="h-5 w-5 text-violet-500" />
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">热门标签</h2>
      </header>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={`/tag/${tag.slug}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              "bg-muted text-foreground hover:bg-muted/70 transition-colors",
            )}
          >
            <span>{tag.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{tag.total}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
