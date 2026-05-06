"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User as UserIcon, Images, Play, Gamepad2, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/lib/hooks";
import { useSearchHistoryStore } from "@/stores/app";
import { cn } from "@/lib/utils";

interface SearchQueryBarProps {
  /** 当前 URL 中的关键词 */
  query: string;
  className?: string;
}

/**
 * 搜索页顶栏：就地修改关键词并跳转，带防抖建议
 */
export function SearchQueryBar({ query, className }: SearchQueryBarProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { addSearch } = useSearchHistoryStore();
  const recordSearchMutation = trpc.video.recordSearch.useMutation();

  // 外部 query 变化时同步 draft：渲染阶段 setState
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setDraft(query);
  }

  const debounced = useDebounce(draft, 300);
  const { data: suggestions } = trpc.video.searchSuggestions.useQuery(
    { query: debounced, limit: 6 },
    { enabled: debounced.trim().length >= 2, staleTime: 60_000 },
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;
      addSearch(trimmed);
      recordSearchMutation.mutate({ keyword: trimmed });
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      setOpen(false);
      setDraft(trimmed);
    },
    [router, addSearch, recordSearchMutation],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    go(draft);
  };

  const showPanel = open && debounced.trim().length >= 2 && suggestions;

  return (
    <div ref={wrapRef} className={cn("relative max-w-2xl", className)}>
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="搜索视频、游戏、图片、标签…"
            className="pl-9 h-10 sm:h-10"
            aria-label="搜索关键词"
          />
        </div>
        <Button type="submit" className="shrink-0 h-10">
          搜索
        </Button>
      </form>

      {showPanel && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md py-1 max-h-72 overflow-y-auto">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
            onClick={() => go(draft)}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">搜索 &quot;{draft.trim()}&quot;</span>
          </button>
          {suggestions.tags.map((tag) => (
            <button
              key={`tag-${tag.id}`}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
              onClick={() => {
                setOpen(false);
                router.push(`/tag/${tag.slug}`);
              }}
            >
              <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />#{tag.name}
            </button>
          ))}
          {suggestions.videos.map((v) => (
            <button
              key={`v-${v.id}`}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
              onClick={() => {
                setOpen(false);
                router.push(`/video/${v.id}`);
              }}
            >
              <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{v.title}</span>
            </button>
          ))}
          {suggestions.games.map((g) => (
            <button
              key={`g-${g.id}`}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
              onClick={() => {
                setOpen(false);
                router.push(`/game/${g.id}`);
              }}
            >
              <Gamepad2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{g.title}</span>
            </button>
          ))}
          {suggestions.imagePosts?.map((p) => (
            <button
              key={`img-${p.id}`}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
              onClick={() => {
                setOpen(false);
                router.push(`/image/${p.id}`);
              }}
            >
              <Images className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.title}</span>
            </button>
          ))}
          {suggestions.users?.map((u) => (
            <button
              key={`u-${u.id}`}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent"
              onClick={() => {
                setOpen(false);
                router.push(`/user/${u.id}`);
              }}
            >
              <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{u.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
