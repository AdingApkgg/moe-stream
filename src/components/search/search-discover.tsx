"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Flame, Gamepad2, Images, Play, Sparkles, TrendingUp, X, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSearchHistoryStore } from "@/stores/app";
import { cn } from "@/lib/utils";

/**
 * 搜索空态展示：搜索历史 + 站内热搜 + 猜你想搜。
 * 在 /search 页、桌面搜索栏下拉、移动端搜索全屏覆盖层中统一使用。
 *
 * variant:
 * - "page": 用于 /search 独立页，留白更大，模块更分明
 * - "menu": 用于下拉/覆盖层，密度更高，减少滚动
 */

interface SearchDiscoverProps {
  variant?: "page" | "menu";
  /** 点击关键词时触发（历史 / 猜你想搜）。热门内容走 Link 直接跳转。 */
  onSearchKeyword: (keyword: string) => void;
  /** 命中时关闭下拉 / 覆盖层。点击热门内容的 Link 时调用。 */
  onNavigate?: () => void;
  className?: string;
}

type HotContentItem = {
  type: "video" | "game" | "image";
  id: string;
  title: string;
  coverUrl: string | null;
  isNsfw: boolean;
  heat: number;
  rank: number;
};

/** 把多维度热力分压缩到 0-100 区间显示，避免出现“182394”这类原始大数。 */
function formatHeat(heat: number): string {
  if (heat <= 0) return "0";
  // log10 拉平：1 → 0，10 → 25，100 → 50，1k → 75，10k → 100
  const score = Math.min(100, Math.round((Math.log10(heat + 1) / 4) * 100));
  return String(score);
}

const HOT_TYPE_META: Record<HotContentItem["type"], { label: string; href: (id: string) => string; icon: LucideIcon }> =
  {
    video: { label: "视频", href: (id) => `/video/${id}`, icon: Play },
    game: { label: "游戏", href: (id) => `/game/${id}`, icon: Gamepad2 },
    image: { label: "图片", href: (id) => `/image/${id}`, icon: Images },
  };

function HotContentRow({ item, onNavigate }: { item: HotContentItem; onNavigate?: () => void }) {
  const meta = HOT_TYPE_META[item.type];
  const TypeIcon = meta.icon;
  const isTop3 = item.rank <= 3;
  return (
    <Link
      href={meta.href(item.id)}
      onClick={onNavigate}
      className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors"
    >
      <span
        className={cn(
          "w-5 text-center text-xs font-bold tabular-nums shrink-0",
          isTop3 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {item.rank}
      </span>
      <div className="relative w-14 h-9 shrink-0 rounded overflow-hidden bg-muted">
        {item.coverUrl ? (
          <Image src={item.coverUrl} alt={item.title} fill sizes="56px" unoptimized className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        )}
        {item.isNsfw && (
          <span className="absolute top-0 right-0 bg-red-500/90 text-white text-[9px] font-bold px-1 leading-tight rounded-bl">
            NSFW
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate group-hover:text-primary transition-colors">{item.title}</div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
          <TypeIcon className="h-3 w-3" />
          <span>{meta.label}</span>
          <span>·</span>
          <Flame className={cn("h-3 w-3", isTop3 ? "text-red-500" : "text-muted-foreground")} />
          <span className={cn("tabular-nums", isTop3 && "text-red-500 font-medium")}>{formatHeat(item.heat)}</span>
        </div>
      </div>
    </Link>
  );
}

export function SearchDiscover({ variant = "page", onSearchKeyword, onNavigate, className }: SearchDiscoverProps) {
  const { history, removeSearch, clearHistory } = useSearchHistoryStore();

  const { data: hotContents } = trpc.search.getHotContents.useQuery({ limit: 8 }, { staleTime: 300_000 });
  const { data: guessResult } = trpc.search.guessForMe.useQuery({ limit: 10 }, { staleTime: 300_000 });
  const guessItems = guessResult?.items ?? [];
  const isPersonalized = guessResult?.source === "personalized";

  const hasHistory = history.length > 0;
  const hasHot = (hotContents?.length ?? 0) > 0;
  const hasGuess = guessItems.length > 0;
  const isEmpty = !hasHistory && !hasHot && !hasGuess;

  const isPage = variant === "page";
  const sectionGap = isPage ? "space-y-8" : "space-y-5";
  const pad = isPage ? "" : "px-3 py-3";

  if (isEmpty) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center text-muted-foreground",
          isPage ? "py-16" : "py-12",
          className,
        )}
      >
        <Sparkles className="h-8 w-8 opacity-30 mb-2" />
        <p className="text-sm">暂无推荐，输入关键词开始搜索</p>
      </div>
    );
  }

  return (
    <div className={cn(sectionGap, pad, className)}>
      {/* 搜索历史 */}
      {hasHistory && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3
              className={cn(
                "font-semibold flex items-center gap-2",
                isPage ? "text-base" : "text-xs text-muted-foreground",
              )}
            >
              <Clock className={cn(isPage ? "h-4 w-4" : "h-3 w-3")} />
              搜索历史
            </h3>
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              清空
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 8).map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => onSearchKeyword(keyword)}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-sm transition-colors"
              >
                <span className="truncate max-w-[160px]">{keyword}</span>
                <X
                  className="h-3.5 w-3.5 text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSearch(keyword);
                  }}
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 站内热搜（具体内容，多维度热力分） */}
      {hasHot && (
        <section>
          <h3
            className={cn(
              "font-semibold flex items-center gap-2 mb-2",
              isPage ? "text-base" : "text-xs text-muted-foreground",
            )}
          >
            <TrendingUp className={cn(isPage ? "h-4 w-4" : "h-3 w-3")} />
            站内热搜
          </h3>
          <div className={cn("grid gap-1", isPage ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            {hotContents?.map((item) => (
              <HotContentRow key={`${item.type}-${item.id}`} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}

      {/* 猜你想搜 */}
      {hasGuess && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3
              className={cn(
                "font-semibold flex items-center gap-2",
                isPage ? "text-base" : "text-xs text-muted-foreground",
              )}
            >
              <Sparkles className={cn(isPage ? "h-4 w-4" : "h-3 w-3")} />
              猜你想搜
            </h3>
            {isPersonalized && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">已个性化</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {guessItems.map((item) => (
              <button
                key={`${item.keyword}-${item.reason}`}
                type="button"
                onClick={() => onSearchKeyword(item.keyword)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                  item.reason === "interest"
                    ? "bg-primary/10 hover:bg-primary/20 text-foreground"
                    : "bg-muted hover:bg-accent",
                )}
              >
                <span>{item.keyword}</span>
                {item.isHot && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">热</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
