"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Flame, Trophy, Crown, Hash } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "./video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { HorizontalScroller } from "@/components/shared/horizontal-scroller";
import { cn } from "@/lib/utils";

/**
 * 视频列表「首页模式」分区 Feed —— 多个 section 上下排列，每个 section 用不同 layout：
 * - 「最新上传」横向滚动（一行能看 8-15 张）
 * - 「本日热门」标准 4 列网格
 * - 「本周排行」Top 1 hero（冠军大图 + 6 张其他）
 *
 * 参考 hanime1.me 的 section 设计。
 */

type SortBy = "latest" | "views" | "likes" | "titleAsc" | "titleDesc";
type TimeRange = "all" | "today" | "week" | "month";
type Layout = "grid" | "horizontal" | "hero";

interface SectionDef {
  id: string;
  title: string;
  Icon: typeof Sparkles;
  iconClass: string;
  sortBy: SortBy;
  timeRange?: TimeRange;
  moreParams: string;
  layout: Layout;
  /** 是否对前 N 名展示金/银/铜冠 */
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
    layout: "horizontal",
  },
  {
    id: "trending-today",
    title: "本日热门",
    Icon: Flame,
    iconClass: "text-orange-500",
    sortBy: "views",
    timeRange: "today",
    moreParams: "?sortBy=views&timeRange=today",
    layout: "grid",
  },
  {
    id: "weekly-rank",
    title: "本周排行",
    Icon: Trophy,
    iconClass: "text-amber-500",
    sortBy: "views",
    timeRange: "week",
    moreParams: "?sortBy=views&timeRange=week",
    layout: "hero",
    showRank: true,
  },
];

interface VideoFeedSectionsProps {
  className?: string;
}

export function VideoFeedSections({ className }: VideoFeedSectionsProps) {
  return (
    <div className={cn("space-y-10", className)}>
      <FeedSection section={SECTIONS[0]} />
      {/* 在「最新上传」之后插入「按标签浏览」快速入口 */}
      <TagBrowseSection />
      <FeedSection section={SECTIONS[1]} />
      <FeedSection section={SECTIONS[2]} />
    </div>
  );
}

/**
 * 「按标签浏览」section：横排热门标签 chip，点击跳到 tag 筛选。
 * 参考 hanime1.me 在 section feed 中穿插的分类入口。
 */
function TagBrowseSection() {
  const { data: tags, isLoading } = trpc.tag.popular.useQuery({ limit: 16, type: "video" }, { staleTime: 5 * 60_000 });

  return (
    <section>
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">按标签浏览</h2>
        </div>
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          全部标签
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {isLoading && !tags ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      ) : tags && tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/video?tags=${encodeURIComponent(tag.slug)}`}
              className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Hash className="h-3.5 w-3.5 opacity-50" />
              {tag.name}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground py-6 text-center">暂无热门标签</div>
      )}
    </section>
  );
}

function FeedSection({ section }: { section: SectionDef }) {
  // 不同 layout 拉的数量不一样：
  // - horizontal 一次拉 12 张，用户可以左右翻
  // - grid 拉 8 张（4 列 × 2 行）
  // - hero 拉 7 张（冠军大图 1 + 网格 6）
  const limit = section.layout === "horizontal" ? 12 : section.layout === "hero" ? 7 : 8;

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

  return (
    <section>
      <SectionHeader section={section} />

      {isLoading && videos.length === 0 ? (
        <SectionSkeleton layout={section.layout} count={limit} />
      ) : videos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">暂无内容</div>
      ) : section.layout === "horizontal" ? (
        <HorizontalScroller
          items={videos}
          itemWidthClass="w-[260px] sm:w-[300px]"
          renderItem={(v, i) => (
            <VideoCard video={v} index={i} watchProgress={progressMap?.[v.id]} isFavorited={favoritedSet.has(v.id)} />
          )}
        />
      ) : section.layout === "hero" ? (
        <HeroLayout videos={videos} progressMap={progressMap} favoritedSet={favoritedSet} showRank={section.showRank} />
      ) : (
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
      )}
    </section>
  );
}

/** Section 标题栏：图标 + 标题 + 「查看更多」链接 */
function SectionHeader({ section }: { section: SectionDef }) {
  const { Icon } = section;
  return (
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
  );
}

/**
 * Hero Layout：冠军大图占左侧 2 列高度，右侧 6 张普通卡片。
 * 移动端退化为普通网格，避免横向不够宽时大图过宽。
 */
type VideoCardItem = React.ComponentProps<typeof VideoCard>["video"];

function HeroLayout({
  videos,
  progressMap,
  favoritedSet,
  showRank,
}: {
  videos: VideoCardItem[];
  progressMap?: Record<string, { progress: number; duration: number | null }>;
  favoritedSet: Set<string>;
  showRank?: boolean;
}) {
  if (videos.length === 0) return null;
  const [champion, ...rest] = videos;

  return (
    <div className="grid gap-3 sm:gap-4 lg:gap-5 lg:grid-cols-3">
      {/* 冠军大封面：lg+ 上跨两列两行；移动端正常单卡 */}
      <div className="lg:col-span-2 lg:row-span-2 relative">
        <VideoCard
          video={champion}
          index={0}
          watchProgress={progressMap?.[champion.id]}
          rank={showRank ? 1 : undefined}
          isFavorited={favoritedSet.has(champion.id)}
        />
        {/* 冠军徽章覆盖在大封面上（除了卡片自身的 RankBadge） */}
        <div className="hidden lg:flex absolute top-3 right-3 z-[2] items-center gap-1.5 rounded-full bg-amber-500 text-amber-50 px-3 py-1 text-sm font-bold shadow-xl">
          <Crown className="h-4 w-4" />
          冠军
        </div>
      </div>

      {/* 右侧 6 张普通卡片，2x3 网格（lg+） */}
      <div className="contents lg:grid lg:grid-cols-2 lg:gap-3">
        {rest.map((v, i) => (
          <VideoCard
            key={v.id}
            video={v}
            index={i + 1}
            watchProgress={progressMap?.[v.id]}
            rank={showRank ? i + 2 : undefined}
            isFavorited={favoritedSet.has(v.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Section 加载骨架 */
function SectionSkeleton({ layout, count }: { layout: Layout; count: number }) {
  if (layout === "horizontal") {
    return (
      <div className="flex gap-3 sm:gap-4 -mx-4 px-4 md:-mx-6 md:px-6 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="shrink-0 w-[260px] sm:w-[300px] space-y-2">
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (layout === "hero") {
    return (
      <div className="grid gap-3 sm:gap-4 lg:gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 lg:row-span-2 space-y-2">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="contents lg:grid lg:grid-cols-2 lg:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-video w-full rounded-2xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
