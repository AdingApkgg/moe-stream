"use client";

import { trpc } from "@/lib/trpc";
import { GameGrid } from "@/components/game/game-grid";
import { GameCard, type GameCardData } from "@/components/game/game-card";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { AlertTriangle, X, Gamepad2 } from "lucide-react";
import { PageWrapper, FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CollapsibleTagBar } from "@/components/ui/collapsible-tag-bar";
import { Pagination } from "@/components/ui/pagination";
import { AdCard } from "@/components/ads/ad-card";
import { useInlineAds } from "@/hooks/use-inline-ads";
import type { Ad } from "@/lib/ads";
import { useUIStore } from "@/stores/app";

/** 游戏类型选项 */
const GAME_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "全部" },
  { id: "SLG", label: "SLG" },
  { id: "RPG", label: "RPG" },
  { id: "ADV", label: "ADV" },
  { id: "ACT", label: "ACT" },
  { id: "AVG", label: "AVG" },
  { id: "STG", label: "STG" },
  { id: "PZL", label: "PZL" },
  { id: "FTG", label: "FTG" },
  { id: "OTHER", label: "其他" },
];

type SortBy = "latest" | "views" | "likes";

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface TypeStat {
  type: string;
  count: number;
}

interface GameListClientProps {
  initialTags: Tag[];
  initialGames: GameCardData[];
  typeStats: TypeStat[];
  siteConfig: {
    announcement: string | null;
    announcementEnabled: boolean;
  } | null;
  /** 服务端预选的广告（首页第一页 SSR 直出用） */
  initialAds?: Ad[];
}

export function GameListClient({ initialTags, initialGames, typeStats, siteConfig, initialAds = [] }: GameListClientProps) {
  const setContentMode = useUIStore((s) => s.setContentMode);

  // 记录用户访问了游戏区
  useEffect(() => {
    setContentMode("game");
  }, [setContentMode]);

  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("");
  const [page, setPage] = usePageParam();
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  const {
    data: gameData,
    isLoading,
  } = trpc.game.list.useQuery(
    {
      limit: 20,
      page,
      sortBy,
      tagId: selectedTag || undefined,
      gameType: selectedType || undefined,
    },
    {
      placeholderData: (prev) => prev,
    }
  );

  const games = useMemo(
    () => gameData?.games ?? (page === 1 && sortBy === "latest" && !selectedTag && !selectedType ? initialGames : []),
    [gameData?.games, page, sortBy, selectedTag, selectedType, initialGames]
  );
  const totalPages = gameData?.totalPages ?? 1;

  const isFirstPage = page === 1 && sortBy === "latest" && selectedTag === null && selectedType === "";
  const adSeed = `game-${page}-${sortBy}-${selectedTag ?? ""}-${selectedType}`;
  const { gridItems, pickedAds, hasAds } = useInlineAds({
    items: games,
    seed: adSeed,
    initialAds,
    useInitialAds: isFirstPage && initialAds.length > 0,
  });

  const sortOptions: { id: SortBy; label: string }[] = [
    { id: "latest", label: "最新" },
    { id: "views", label: "热门" },
    { id: "likes", label: "高赞" },
  ];

  const handleSortClick = (id: SortBy) => {
    setSortBy(id);
    setPage(1);
  };

  const handleTagClick = (tagId: string) => {
    setSelectedTag(selectedTag === tagId ? null : tagId);
    setPage(1);
  };

  const handleTypeClick = (type: string) => {
    setSelectedType(type);
    setPage(1);
  };

  // 根据 typeStats 过滤有数据的类型
  const availableTypes = useMemo(() => {
    const typeSet = new Set(typeStats.map((s) => s.type));
    return GAME_TYPE_OPTIONS.filter((opt) => opt.id === "" || typeSet.has(opt.id));
  }, [typeStats]);

  return (
    <PageWrapper>
      <div className="px-4 md:px-6 py-4 overflow-x-hidden">
        {/* 公告横幅 */}
        {siteConfig?.announcementEnabled && siteConfig.announcement && (
          <div
            className={`mb-4 relative overflow-hidden transition-all duration-300 ${
              showAnnouncement ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400 flex-1">
                {siteConfig.announcement}
              </p>
              <button
                onClick={() => setShowAnnouncement(false)}
                className="text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all hover:scale-110 active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* 页面标题 */}
        <FadeIn delay={0.05}>
          <div className="flex items-center gap-3 mb-4">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">游戏</h1>
          </div>
        </FadeIn>

        {/* 游戏类型筛选条 */}
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap gap-2 mb-4">
            {availableTypes.map((opt) => {
              const stat = typeStats.find((s) => s.type === opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => handleTypeClick(opt.id)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    selectedType === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  {opt.label}
                  {stat && <span className="ml-1 text-xs opacity-70">({stat.count})</span>}
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* 排序 + 标签栏 */}
        <FadeIn delay={0.15}>
          <CollapsibleTagBar className="mb-6">
            {sortOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSortClick(option.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  sortBy === option.id
                    ? "bg-foreground text-background"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
            {initialTags.length > 0 && (
              <>
                <div className="shrink-0 w-px bg-border my-1" />
                {initialTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.id)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      selectedTag === tag.id
                        ? "bg-foreground text-background"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
              </>
            )}
          </CollapsibleTagBar>
        </FadeIn>

        {/* 游戏网格 */}
        <section>
          <div key={`${sortBy}-${selectedTag}-${selectedType}-${page}`}>
            {isLoading && games.length === 0 ? (
              <GameGrid games={[]} isLoading />
            ) : hasAds ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {gridItems.map((item, index) =>
                  item.type === "ad" ? (
                    <AdCard
                      key={`ad-${item.adIndex}`}
                      ad={pickedAds[item.adIndex]}
                    />
                  ) : (
                    <GameCard key={item.data.id} game={item.data} index={index} />
                  )
                )}
              </div>
            ) : (
              <GameGrid games={games} isLoading={false} />
            )}

            {!isLoading && games.length === 0 && (
              <div className="text-center py-16">
                <div className="text-muted-foreground mb-4">
                  <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">没有找到游戏</p>
                  <p className="text-sm mt-1">
                    {selectedTag || selectedType ? "尝试调整筛选条件" : "暂无游戏内容"}
                  </p>
                </div>
                {(selectedTag || selectedType) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTag(null);
                      setSelectedType("");
                    }}
                    className="mt-4"
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            )}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            className="mt-8"
          />
        </section>
      </div>
    </PageWrapper>
  );
}
