"use client";

import { trpc } from "@/lib/trpc";
import { VideoGrid } from "@/components/video/video-grid";
import { VideoCard } from "@/components/video/video-card";
import { GameGrid } from "@/components/game/game-grid";
import { GameCard } from "@/components/game/game-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageParam } from "@/hooks/use-page-param";
import { useTabParam } from "@/hooks/use-tab-param";
import { useSearchEnumParam } from "@/hooks/use-filter-param";
import { SearchQueryBar } from "@/app/search/_components/search-query-bar";
import { SearchHighlightText } from "@/components/shared/search-highlight-text";
import { SearchAll } from "@/app/search/_components/search-all";
import { SearchDiscover } from "@/components/search/search-discover";
import { Search, Sparkles, Play, Gamepad2, Images, Tag, LayoutGrid, ChevronDown, type LucideIcon } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AdCard } from "@/components/ads/ad-card";
import { useInlineAds } from "@/hooks/use-inline-ads";
import { MotionPage } from "@/components/motion";

interface SearchContentProps {
  query: string;
}

type SearchTab = "all" | "video" | "game" | "image" | "tag";

const SORT_VALUES = ["latest", "views", "likes", "titleAsc", "titleDesc"] as const;
type SortBy = (typeof SORT_VALUES)[number];

const TIME_VALUES = ["all", "today", "week", "month"] as const;
type TimeRange = (typeof TIME_VALUES)[number];

const TAB_OPTIONS: { value: SearchTab; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "综合", icon: LayoutGrid },
  { value: "video", label: "视频", icon: Play },
  { value: "game", label: "游戏", icon: Gamepad2 },
  { value: "image", label: "图片", icon: Images },
  { value: "tag", label: "标签", icon: Tag },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "latest", label: "最新" },
  { value: "views", label: "最多播放" },
  { value: "likes", label: "最多点赞" },
  { value: "titleAsc", label: "标题 A→Z" },
  { value: "titleDesc", label: "标题 Z→A" },
];

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "all", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
];

function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  const isDefault = value === options[0]?.value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-full px-3 text-sm font-normal",
            !isDefault && "border-primary/50 text-primary hover:text-primary",
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{current?.label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem]">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchExplore() {
  const router = useRouter();

  const goSearch = (keyword: string) => {
    router.push(`/search?q=${encodeURIComponent(keyword)}`);
  };

  return (
    <MotionPage>
      <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
        <SearchQueryBar query="" className="mb-8" />
        <SearchDiscover variant="page" onSearchKeyword={goSearch} />
      </div>
    </MotionPage>
  );
}

const contentTypeLabels: Record<SearchTab, string> = {
  all: "结果",
  video: "视频",
  game: "游戏",
  image: "图片",
  tag: "标签",
};

export function SearchContent({ query }: SearchContentProps) {
  const [searchTab, setSearchTab] = useTabParam<SearchTab>("all");
  const [sortBy, setSortBy] = useSearchEnumParam("sort", "latest", SORT_VALUES);
  const [timeRange, setTimeRange] = useSearchEnumParam("time", "all", TIME_VALUES);
  const [videoPage, setVideoPage] = usePageParam("page");
  const [gamePage, setGamePage] = usePageParam("gp");
  const [imagePage, setImagePage] = usePageParam("ip");

  const { data: tabCounts } = trpc.search.counts.useQuery(
    { query },
    { enabled: query.trim().length > 0, staleTime: 60_000 },
  );

  const showFilters = searchTab === "video" || searchTab === "game";
  const totalForAll = tabCounts ? tabCounts.video + tabCounts.game + tabCounts.image + tabCounts.tag : 0;

  const { data: videoData, isLoading: videoLoading } = trpc.video.list.useQuery(
    { limit: 20, page: videoPage, search: query, sortBy, timeRange },
    { enabled: !!query && searchTab === "video", placeholderData: (prev) => prev },
  );

  const { data: gameData, isLoading: gameLoading } = trpc.game.list.useQuery(
    { limit: 20, page: gamePage, search: query, sortBy, timeRange },
    { enabled: !!query && searchTab === "game", placeholderData: (prev) => prev },
  );

  const { data: imageData, isLoading: imageLoading } = trpc.image.list.useQuery(
    { limit: 20, page: imagePage, search: query, sortBy },
    { enabled: !!query && searchTab === "image", placeholderData: (prev) => prev },
  );

  const { data: tagData, isLoading: tagLoading } = trpc.tag.list.useQuery(
    { search: query, limit: 50 },
    { enabled: !!query && searchTab === "tag" },
  );

  const videos = videoData?.videos ?? [];
  const videoTotalCount = videoData?.totalCount ?? 0;
  const videoTotalPages = videoData?.totalPages ?? 1;

  const games = gameData?.games ?? [];
  const gameTotalCount = gameData?.totalCount ?? 0;
  const gameTotalPages = gameData?.totalPages ?? 1;

  const posts = imageData?.posts ?? [];
  const imageTotalCount = imageData?.totalCount ?? 0;
  const imageTotalPages = imageData?.totalPages ?? 1;

  const tags = tagData ?? [];

  const videoAdSeed = `search-video-${query}-${videoPage}-${sortBy}-${timeRange}`;
  const {
    gridItems: videoGridItems,
    pickedAds: videoPickedAds,
    hasAds: videoHasAds,
  } = useInlineAds({
    items: videos,
    count: 2,
    seed: videoAdSeed,
  });

  const gameAdSeed = `search-game-${query}-${gamePage}-${sortBy}-${timeRange}`;
  const {
    gridItems: gameGridItems,
    pickedAds: gamePickedAds,
    hasAds: gameHasAds,
  } = useInlineAds({
    items: games,
    count: 2,
    seed: gameAdSeed,
  });

  const imageAdSeed = `search-image-${query}-${imagePage}`;
  const {
    gridItems: imageGridItems,
    pickedAds: imagePickedAds,
    hasAds: imageHasAds,
  } = useInlineAds({
    items: posts,
    count: 2,
    seed: imageAdSeed,
  });

  const currentLoading =
    {
      all: false,
      video: videoLoading,
      game: gameLoading,
      image: imageLoading,
      tag: tagLoading,
    }[searchTab] ?? false;

  const currentTotalCount =
    {
      all: 0,
      video: videoTotalCount,
      game: gameTotalCount,
      image: imageTotalCount,
      tag: tags.length,
    }[searchTab] ?? 0;

  const currentPage = { all: 1, video: videoPage, game: gamePage, image: imagePage, tag: 1 }[searchTab] ?? 1;
  const currentSetPage =
    { all: () => {}, video: setVideoPage, game: setGamePage, image: setImagePage, tag: () => {} }[searchTab] ??
    (() => {});
  const currentTotalPages =
    { all: 1, video: videoTotalPages, game: gameTotalPages, image: imageTotalPages, tag: 1 }[searchTab] ?? 1;

  if (!query) {
    return <SearchExplore />;
  }

  return (
    <MotionPage>
      <div className="px-4 md:px-6 py-6">
        <div className="mb-6 space-y-3">
          <SearchQueryBar query={query} />
          <p className="text-muted-foreground text-sm">
            搜索 &quot;{query}&quot;
            {searchTab === "all"
              ? tabCounts && <span className="ml-1">- 共找到 {totalForAll > 999 ? "999+" : totalForAll} 条结果</span>
              : !currentLoading && (
                  <span className="ml-1">
                    - 共 {currentTotalCount} 个{contentTypeLabels[searchTab]}
                  </span>
                )}
          </p>
        </div>

        <div className="flex gap-6 border-b overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 mb-5">
          {TAB_OPTIONS.map((tab) => {
            const Icon = tab.icon;
            const isActive = searchTab === tab.value;
            const countBadge = tab.value === "all" ? undefined : tabCounts ? tabCounts[tab.value] : undefined;
            return (
              <button
                key={tab.value}
                onClick={() => setSearchTab(tab.value)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 py-3 border-b-2 -mb-px text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {countBadge !== undefined && (
                  <span className="text-xs font-normal tabular-nums opacity-70">
                    {countBadge > 999 ? "999+" : countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <FilterDropdown label="排序" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
            <FilterDropdown label="时间" options={TIME_RANGE_OPTIONS} value={timeRange} onChange={setTimeRange} />
            {(sortBy !== "latest" || timeRange !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setSortBy("latest");
                  setTimeRange("all");
                }}
              >
                清除筛选
              </Button>
            )}
          </div>
        )}

        {/* 综合结果 */}
        {searchTab === "all" && <SearchAll query={query} onSelectTab={(t) => setSearchTab(t)} />}

        {/* 视频结果 */}
        {searchTab === "video" && (
          <>
            {currentLoading ? (
              <VideoGrid videos={[]} isLoading />
            ) : videoHasAds ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {videoGridItems.map((item, index) =>
                  item.type === "ad" ? (
                    <AdCard key={`ad-${item.adIndex}`} ad={videoPickedAds[item.adIndex]} slotId="in-feed" />
                  ) : (
                    <VideoCard key={item.data.id} video={item.data} index={index} highlightQuery={query} />
                  ),
                )}
              </div>
            ) : (
              <VideoGrid videos={videos} isLoading={false} highlightQuery={query} />
            )}
            {currentTotalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={currentTotalPages}
                onPageChange={currentSetPage}
                className="mt-8"
              />
            )}
            {!currentLoading && videos.length === 0 && (
              <EmptyResult
                icon={Search}
                label="视频"
                sortBy={sortBy}
                timeRange={timeRange}
                onClear={() => {
                  setSortBy("latest");
                  setTimeRange("all");
                }}
              />
            )}
          </>
        )}

        {/* 游戏结果 */}
        {searchTab === "game" && (
          <>
            {currentLoading ? (
              <GameGrid games={[]} isLoading columns={4} />
            ) : gameHasAds ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {gameGridItems.map((item, index) =>
                  item.type === "ad" ? (
                    <AdCard key={`ad-${item.adIndex}`} ad={gamePickedAds[item.adIndex]} slotId="in-feed" />
                  ) : (
                    <GameCard key={item.data.id} game={item.data} index={index} highlightQuery={query} />
                  ),
                )}
              </div>
            ) : (
              <GameGrid games={games} isLoading={false} columns={4} highlightQuery={query} />
            )}
            {currentTotalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={currentTotalPages}
                onPageChange={currentSetPage}
                className="mt-8"
              />
            )}
            {!currentLoading && games.length === 0 && (
              <EmptyResult
                icon={Gamepad2}
                label="游戏"
                sortBy={sortBy}
                timeRange={timeRange}
                onClear={() => {
                  setSortBy("latest");
                  setTimeRange("all");
                }}
              />
            )}
          </>
        )}

        {/* 图片结果 */}
        {searchTab === "image" && (
          <>
            {currentLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : imageHasAds ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {imageGridItems.map((item, index) =>
                  item.type === "ad" ? (
                    <AdCard key={`ad-${item.adIndex}`} ad={imagePickedAds[item.adIndex]} slotId="in-feed" />
                  ) : (
                    <ImagePostCard key={item.data.id} post={item.data} index={index} highlightQuery={query} />
                  ),
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {posts.map((post, index) => (
                  <ImagePostCard key={post.id} post={post} index={index} highlightQuery={query} />
                ))}
              </div>
            )}
            {currentTotalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={currentTotalPages}
                onPageChange={currentSetPage}
                className="mt-8"
              />
            )}
            {!currentLoading && posts.length === 0 && (
              <EmptyResult icon={Images} label="图片" sortBy="latest" timeRange="all" onClear={() => {}} />
            )}
          </>
        )}

        {/* 标签结果 */}
        {searchTab === "tag" && (
          <>
            {tagLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const count = (tag.videoCount ?? 0) + (tag.gameCount ?? 0) + (tag.imagePostCount ?? 0);
                  return (
                    <Link
                      key={tag.id}
                      href={`/tag/${tag.slug}`}
                      className="transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95"
                    >
                      <Badge
                        variant="outline"
                        className="text-sm py-2 px-4 cursor-pointer hover:bg-accent transition-colors"
                      >
                        <Tag className="h-3.5 w-3.5 mr-1.5" />
                        <SearchHighlightText text={tag.name} highlightQuery={query} />
                        {count > 0 && <span className="ml-1.5 opacity-60">({count})</span>}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <Tag className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">没有找到相关标签</p>
              </div>
            )}
          </>
        )}
      </div>
    </MotionPage>
  );
}

function EmptyResult({
  icon: Icon,
  label,
  sortBy,
  timeRange,
  onClear,
}: {
  icon: LucideIcon;
  label: string;
  sortBy: SortBy;
  timeRange: TimeRange;
  onClear: () => void;
}) {
  const router = useRouter();
  const { data: guessResult } = trpc.search.guessForMe.useQuery({ limit: 10 }, { staleTime: 300000 });
  const guessItems = guessResult?.items ?? [];

  return (
    <div>
      <div className="text-center py-12">
        <Icon className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">没有找到相关{label}</p>
        {(sortBy !== "latest" || timeRange !== "all") && (
          <Button variant="link" onClick={onClear} className="mt-2">
            清除筛选条件重试
          </Button>
        )}
      </div>
      {guessItems.length > 0 && (
        <div className="max-w-2xl mx-auto mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {guessResult?.source === "personalized" ? "猜你想搜" : "试试这些"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {guessItems.map((item) => (
              <button
                key={`${item.keyword}-${item.reason}`}
                onClick={() => router.push(`/search?q=${encodeURIComponent(item.keyword)}`)}
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
        </div>
      )}
    </div>
  );
}
