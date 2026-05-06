"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Flame, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "./video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 视频列表「首页模式」：参考 hanime1.me 的分区 Feed —— 不再是单一无穷网格，
 * 而是「最新 / 本日热门 / 本周排行」多个 Section 上下排列，每个 section
 * 有标题 + 「查看更多 →」链接。
 *
 * 仅在用户首次进 /video 且无任何筛选时展示，有筛选时回退到普通网格。
 */

type SortBy = "latest" | "views" | "likes" | "titleAsc" | "titleDesc";
type TimeRange = "all" | "today" | "week" | "month";

interface SectionDef {
  id: string;
  title: string;
  Icon: typeof Sparkles;
  iconClass: string;
  sortBy: SortBy;
  timeRange?: TimeRange;
  /** 「查看更多」点击后跳转到带筛选的 URL 参数 */
  moreParams: string;
  /** 是否对前 3 名展示金银铜徽章 */
  showRank?: boolean;
}

const SECTIONS: SectionDef[] = [
  {
    id: "latest",
    title: "最新上传",
    Icon: Sparkles,
    iconClass: "text-sky-500",
    sortBy: "latest",
    moreParams: "?sortBy=latest",
  },
  {
    id: "trending-today",
    title: "本日热门",
    Icon: Flame,
    iconClass: "text-orange-500",
    sortBy: "views",
    timeRange: "today",
    moreParams: "?sortBy=views&timeRange=today",
  },
  {
    id: "weekly-rank",
    title: "本周排行",
    Icon: Trophy,
    iconClass: "text-amber-500",
    sortBy: "views",
    timeRange: "week",
    moreParams: "?sortBy=views&timeRange=week",
    showRank: true,
  },
];

interface VideoFeedSectionsProps {
  className?: string;
  /** 每个 section 显示几条 (默认 8，对应 4 列 2 行 / 5 列 1.x 行) */
  perSection?: number;
}

export function VideoFeedSections({ className, perSection = 8 }: VideoFeedSectionsProps) {
  return (
    <div className={cn("space-y-10", className)}>
      {SECTIONS.map((section) => (
        <FeedSection key={section.id} section={section} limit={perSection} />
      ))}
    </div>
  );
}

function FeedSection({ section, limit }: { section: SectionDef; limit: number }) {
  const { data, isLoading } = trpc.video.list.useQuery(
    { limit, page: 1, sortBy: section.sortBy, timeRange: section.timeRange ?? "all" },
    { staleTime: 60_000 },
  );
  const videos = data?.videos ?? [];
  const videoIds = videos.map((v) => v.id);
  const { data: progressData } = trpc.video.progressMap.useQuery(
    { videoIds },
    { enabled: videoIds.length > 0, staleTime: 30_000 },
  );
  const progressMap = progressData?.progressByVideoId;
  const { data: favoritedData } = trpc.video.favoritedMap.useQuery(
    { videoIds },
    { enabled: videoIds.length > 0, staleTime: 30_000 },
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
          href={`/video${section.moreParams}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          查看更多
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {isLoading && videos.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: limit }).map((_, i) => (
            <SectionCardSkeleton key={i} />
          ))}
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {videos.map((v, i) => (
            <VideoCard
              key={v.id}
              video={v}
              index={i}
              watchProgress={progressMap?.[v.id]}
              rank={section.showRank ? i + 1 : undefined}
              isFavorited={favoritedSet.has(v.id)}
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
