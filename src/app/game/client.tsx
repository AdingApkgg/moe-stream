"use client";

import { trpc } from "@/lib/trpc";
import { GameGrid } from "@/components/game/game-grid";
import { GameCard, type GameCardData } from "@/components/game/game-card";
import { AnnouncementBanner } from "@/components/shared/announcement-banner";
import { Button } from "@/components/ui/button";
import { Fragment, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { usePageParam } from "@/hooks/use-page-param";
import { Gamepad2 } from "lucide-react";
import { MotionPage } from "@/components/motion";
import { cn } from "@/lib/utils";
import { CollapsibleTagBar } from "@/components/ui/collapsible-tag-bar";
import { SectionTabs, type SectionTabItem } from "@/components/shared/section-tabs";
import { useTagFilter } from "@/hooks/use-tag-filter";
import { Pagination } from "@/components/ui/pagination";
import { AdCard } from "@/components/ads/ad-card";
import { HeaderBannerCarousel } from "@/components/ads/header-banner";
import { useInlineAds } from "@/hooks/use-inline-ads";
import type { Ad } from "@/lib/ads";
import { useUIStore } from "@/stores/app";
import { useSiteConfig } from "@/contexts/site-config";
import { DEFAULT_HOME_LAYOUT, isSectionModuleEnabled, sectionGridClass, type SectionModuleId } from "@/lib/home-layout";

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

type SortBy = "latest" | "views" | "likes" | "titleAsc" | "titleDesc";

const ALL_SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "latest", label: "最新" },
  { id: "views", label: "热门" },
  { id: "likes", label: "高赞" },
  { id: "titleAsc", label: "标题 A→Z" },
  { id: "titleDesc", label: "标题 Z→A" },
];

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

export function GameListClient({
  initialTags,
  initialGames,
  typeStats,
  siteConfig,
  initialAds = [],
}: GameListClientProps) {
  const setContentMode = useUIStore((s) => s.setContentMode);
  const siteConfigCtx = useSiteConfig();

  // 记录用户访问了游戏区
  useEffect(() => {
    setContentMode("game");
  }, [setContentMode]);

  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const enabled = (siteConfigCtx?.gameSortOptions ?? "latest,views,likes").split(",").map((s) => s.trim());
    const configured = (siteConfigCtx?.gameDefaultSort as SortBy) || "latest";
    return enabled.includes(configured) ? configured : ((enabled[0] as SortBy) ?? "latest");
  });
  const { selectedSlugs, excludedSlugs, toggleTag, toggleExclude, clearAll, isSelected, isExcluded, hasFilter } =
    useTagFilter();
  const [selectedType, setSelectedType] = useState<string>("");
  const [page, setPage] = usePageParam();

  const { data: gameData, isLoading } = trpc.game.list.useQuery(
    {
      limit: 20,
      page,
      sortBy,
      tagSlugs: selectedSlugs.length > 0 ? selectedSlugs : undefined,
      excludeTagSlugs: excludedSlugs.length > 0 ? excludedSlugs : undefined,
      gameType: selectedType || undefined,
    },
    {
      placeholderData: (prev) => prev,
    },
  );

  const games = useMemo(
    () => gameData?.games ?? (page === 1 && !hasFilter && !selectedType ? initialGames : []),
    [gameData?.games, page, hasFilter, selectedType, initialGames],
  );
  const totalPages = gameData?.totalPages ?? 1;

  // 当前页游戏的收藏状态（已登录才查；未登录返回空）
  const gameIds = useMemo(() => games.map((g) => g.id), [games]);
  const { data: favoritedData } = trpc.game.favoritedMap.useQuery(
    { gameIds },
    { enabled: gameIds.length > 0, staleTime: 30_000 },
  );
  const favoritedSet = useMemo(() => new Set(favoritedData?.favoritedIds ?? []), [favoritedData?.favoritedIds]);

  const isFirstPage = page === 1 && !hasFilter && selectedType === "";
  const adSeed = `game-${page}-${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}-${selectedType}`;
  const layout = siteConfigCtx?.homeLayout ?? DEFAULT_HOME_LAYOUT;
  const adDensity = layout.section.adDensity;
  const gridClass = sectionGridClass(layout.section.gridColumns);
  const { gridItems, pickedAds, hasAds } = useInlineAds({
    items: games,
    seed: adSeed,
    initialAds: adDensity === 0 ? [] : initialAds,
    useInitialAds: isFirstPage && initialAds.length > 0 && adDensity > 0,
    count: adDensity === 0 ? 0 : 4,
    interval: adDensity === 0 ? 9999 : adDensity,
  });

  const sortOptions = useMemo(() => {
    const enabledKeys = (siteConfigCtx?.gameSortOptions ?? "latest,views,likes").split(",").map((s) => s.trim());
    return ALL_SORT_OPTIONS.filter((opt) => enabledKeys.includes(opt.id));
  }, [siteConfigCtx?.gameSortOptions]);

  const handleSortClick = useCallback(
    (id: SortBy) => {
      setSortBy(id);
      setPage(1);
    },
    [setPage],
  );

  const handleTagClick = useCallback(
    (slug: string) => {
      setPage(1);
      toggleTag(slug);
    },
    [toggleTag, setPage],
  );

  const handleTagRightClick = useCallback(
    (e: React.MouseEvent, slug: string) => {
      e.preventDefault();
      setPage(1);
      toggleExclude(slug);
    },
    [toggleExclude, setPage],
  );

  const handleTypeClick = useCallback(
    (type: string) => {
      setSelectedType(type);
      setPage(1);
    },
    [setPage],
  );

  // 根据 typeStats 过滤有数据的类型
  const availableTypes = useMemo(() => {
    const typeSet = new Set(typeStats.map((s) => s.type));
    return GAME_TYPE_OPTIONS.filter((opt) => opt.id === "" || typeSet.has(opt.id));
  }, [typeStats]);

  const modules: Record<SectionModuleId, ReactNode> = {
    headerBanner: <HeaderBannerCarousel className="mb-4" />,
    announcement: (
      <AnnouncementBanner
        enabled={siteConfig?.announcementEnabled ?? false}
        announcement={siteConfig?.announcement ?? null}
      />
    ),
    tagBar: (
      <>
        <MotionPage>
          <div className="flex items-center gap-3 mb-4">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">游戏</h1>
          </div>
        </MotionPage>

        <MotionPage>
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
                      : "bg-muted hover:bg-muted/80 text-foreground",
                  )}
                >
                  {opt.label}
                  {stat && <span className="ml-1 text-xs opacity-70">({stat.count})</span>}
                </button>
              );
            })}
          </div>
        </MotionPage>

        <MotionPage>
          {sortOptions.length > 0 && (
            <SectionTabs<SortBy>
              className="mb-3"
              tabs={sortOptions as SectionTabItem<SortBy>[]}
              value={sortBy}
              onChange={handleSortClick}
            />
          )}
          {initialTags.length > 0 && (
            <CollapsibleTagBar className="mb-6">
              {initialTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag.slug)}
                  onContextMenu={(e) => handleTagRightClick(e, tag.slug)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    isSelected(tag.slug) && "bg-foreground text-background",
                    isExcluded(tag.slug) && "bg-destructive/20 text-destructive line-through",
                    !isSelected(tag.slug) && !isExcluded(tag.slug) && "bg-muted hover:bg-muted/80 text-foreground",
                  )}
                  title="左键选择，右键排除"
                >
                  {tag.name}
                </button>
              ))}
            </CollapsibleTagBar>
          )}
        </MotionPage>
      </>
    ),
    mainGrid: (
      <section>
        <div key={`${sortBy}-${selectedSlugs.join(",")}-${excludedSlugs.join(",")}-${selectedType}-${page}`}>
          {isLoading && games.length === 0 ? (
            <GameGrid games={[]} isLoading columnsClass={gridClass} />
          ) : hasAds ? (
            <div className={cn("grid gap-3 sm:gap-4 lg:gap-5", gridClass)}>
              {gridItems.map((item, index) =>
                item.type === "ad" ? (
                  <AdCard key={`ad-${item.adIndex}`} ad={pickedAds[item.adIndex]} slotId="in-feed" />
                ) : (
                  <GameCard
                    key={item.data.id}
                    game={item.data}
                    index={index}
                    isFavorited={favoritedSet.has(item.data.id)}
                  />
                ),
              )}
            </div>
          ) : (
            <GameGrid games={games} isLoading={false} columnsClass={gridClass} favoritedSet={favoritedSet} />
          )}

          {!isLoading && games.length === 0 && (
            <div className="text-center py-16">
              <div className="text-muted-foreground mb-4">
                <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">没有找到游戏</p>
                <p className="text-sm mt-1">{hasFilter || selectedType ? "尝试调整筛选条件" : "暂无游戏内容"}</p>
              </div>
              {(hasFilter || selectedType) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAll();
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

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      </section>
    ),
  };

  return (
    <MotionPage direction="none">
      <div className="px-4 md:px-6 py-4 overflow-x-hidden">
        {layout.section.modules.map((m) => {
          if (!isSectionModuleEnabled(layout, m.id)) return null;
          const node = modules[m.id];
          if (!node) return null;
          return <Fragment key={m.id}>{node}</Fragment>;
        })}
      </div>
    </MotionPage>
  );
}
