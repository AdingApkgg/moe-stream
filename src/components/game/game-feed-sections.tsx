"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Flame, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { GameCard } from "./game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 游戏列表「首页模式」：参考视频区，多个 Section 上下排列。
 * 仅在用户首次进 /game 且无任何筛选时展示。
 */

type SortBy = "latest" | "views" | "likes" | "downloads" | "titleAsc" | "titleDesc";
type TimeRange = "all" | "today" | "week" | "month";

interface SectionDef {
  id: string;
  title: string;
  Icon: typeof Sparkles;
  iconClass: string;
  sortBy: SortBy;
  timeRange?: TimeRange;
  moreParams: string;
  showRank?: boolean;
}

// 三种差异化排序，避免时间窗口空数据
const SECTIONS: SectionDef[] = [
  {
    id: "latest",
    title: "最新上架",
    Icon: Sparkles,
    iconClass: "text-sky-500",
    sortBy: "latest",
    moreParams: "?sortBy=latest",
  },
  {
    id: "trending",
    title: "热门游戏",
    Icon: Flame,
    iconClass: "text-orange-500",
    sortBy: "views",
    moreParams: "?sortBy=views",
  },
  {
    id: "top-rated",
    title: "高赞排行",
    Icon: Trophy,
    iconClass: "text-amber-500",
    sortBy: "likes",
    moreParams: "?sortBy=likes",
    showRank: true,
  },
];

interface GameFeedSectionsProps {
  className?: string;
  perSection?: number;
}

export function GameFeedSections({ className, perSection = 8 }: GameFeedSectionsProps) {
  return (
    <div className={cn("space-y-10", className)}>
      {SECTIONS.map((section) => (
        <FeedSection key={section.id} section={section} limit={perSection} />
      ))}
    </div>
  );
}

function FeedSection({ section, limit }: { section: SectionDef; limit: number }) {
  const { data, isLoading } = trpc.game.list.useQuery(
    { limit, page: 1, sortBy: section.sortBy, timeRange: section.timeRange ?? "all" },
    { staleTime: 60_000 },
  );
  const games = data?.games ?? [];
  const gameIds = games.map((g) => g.id);
  const { data: favoritedData } = trpc.game.favoritedMap.useQuery(
    { gameIds },
    { enabled: gameIds.length > 0, staleTime: 30_000 },
  );
  const favoritedSet = new Set(favoritedData?.favoritedIds ?? []);

  const { Icon } = section;

  return (
    <section>
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", section.iconClass)} />
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{section.title}</h2>
        </div>
        <Link
          href={`/game${section.moreParams}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          查看更多
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {isLoading && games.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: limit }).map((_, i) => (
            <SectionCardSkeleton key={i} />
          ))}
        </div>
      ) : games.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {games.map((g, i) => (
            <GameCard
              key={g.id}
              game={g}
              index={i}
              rank={section.showRank ? i + 1 : undefined}
              isFavorited={favoritedSet.has(g.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">暂无内容</div>
      )}
    </section>
  );
}

function SectionCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
