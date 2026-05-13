"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Play, Images, Gamepad2, type LucideIcon } from "lucide-react";
import { MotionPage } from "@/components/motion";
import { ContentModeHeader } from "@/components/shared/content-mode-header";
import { AnnouncementBanner } from "@/components/shared/announcement-banner";
import { HeaderBannerCarousel } from "@/components/ads/header-banner";
import { HorizontalScroller } from "@/components/shared/horizontal-scroller";
import { useUIStore } from "@/stores/app";
import { useSiteConfig } from "@/contexts/site-config";
import { VideoCard } from "@/components/video/video-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { ImageMasonry } from "@/components/image/image-masonry";
import { GameCard } from "@/components/game/game-card";
import { CompositeHero } from "./composite-hero";
import { CompositeTrendingTags } from "./composite-trending-tags";
import { CompositeMixedHot } from "./composite-mixed-hot";
import { CompositeWeeklyRanking } from "./composite-weekly-ranking";
import { CompositeAnchorNav, COMPOSITE_ANCHOR_ITEMS, type AnchorItem } from "./composite-anchor-nav";
import { CompositeNsfwToggle } from "./composite-nsfw-toggle";
import { cn } from "@/lib/utils";

type Video = Parameters<typeof VideoCard>[0]["video"];
type ImagePost = Parameters<typeof ImagePostCard>[0]["post"];
type Game = Parameters<typeof GameCard>[0]["game"];

interface TrendingTag {
  id: string;
  name: string;
  slug: string;
  total: number;
}

interface CompositeClientProps {
  initialVideos: Video[];
  initialImages: ImagePost[];
  initialGames: Game[];
  hotVideos: Video[];
  hotImages: ImagePost[];
  hotGames: Game[];
  trendingTags: TrendingTag[];
  hideNsfw: boolean;
}

/**
 * 综合分区 = 站点首页 `/`。从上到下：
 *  1. Banner + 公告
 *  2. ContentModeHeader 分区切换器
 *  3. Hero 推荐（本月热门 #1 三类各一张）
 *  4. 热门标签 chips
 *  5. 综合热门（跨视频/图集/游戏混合 grid，跳过 hero 已用的 #1）
 *  6. 最新视频（横向滚动）
 *  7. 最新图集（瀑布流）
 *  8. 最新游戏（网格）
 *  9. 本月排行（3 列 mini Top10）
 *
 * 关闭单一分区时该类数据为空，对应 section 自动隐藏。
 */
export function CompositeClient({
  initialVideos,
  initialImages,
  initialGames,
  hotVideos,
  hotImages,
  hotGames,
  trendingTags,
  hideNsfw,
}: CompositeClientProps) {
  const setContentMode = useUIStore((s) => s.setContentMode);
  const cfg = useSiteConfig();

  useEffect(() => {
    setContentMode("composite");
  }, [setContentMode]);

  const videoEnabled = cfg?.sectionVideoEnabled !== false;
  const imageEnabled = cfg?.sectionImageEnabled !== false;
  const gameEnabled = cfg?.sectionGameEnabled !== false;

  // 锚点条按实际渲染的 section 过滤，避免点击跳到不存在的位置
  const renderedAnchors: AnchorItem[] = COMPOSITE_ANCHOR_ITEMS.filter((a) => {
    if (a.id === "hero")
      return (
        (videoEnabled && hotVideos.length > 0) ||
        (imageEnabled && hotImages.length > 0) ||
        (gameEnabled && hotGames.length > 0)
      );
    if (a.id === "tags") return trendingTags.length > 0;
    if (a.id === "mixed-hot")
      return (
        (videoEnabled && hotVideos.length > 1) ||
        (imageEnabled && hotImages.length > 1) ||
        (gameEnabled && hotGames.length > 1)
      );
    if (a.id === "latest-video") return videoEnabled && initialVideos.length > 0;
    if (a.id === "latest-image") return imageEnabled && initialImages.length > 0;
    if (a.id === "latest-game") return gameEnabled && initialGames.length > 0;
    if (a.id === "ranking")
      return (
        (videoEnabled && hotVideos.length > 0) ||
        (imageEnabled && hotImages.length > 0) ||
        (gameEnabled && hotGames.length > 0)
      );
    return true;
  });

  return (
    <MotionPage direction="none">
      <div className="px-4 md:px-6 py-4 overflow-x-hidden">
        <HeaderBannerCarousel className="mb-4" />
        <AnnouncementBanner enabled={cfg?.announcementEnabled ?? false} announcement={cfg?.announcement ?? null} />

        <MotionPage>
          {/* 移动端 toggle 堆叠到 header 下方，避免和 4 个分区 tab 抢宽度被挤成竖排 */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <ContentModeHeader current="composite" className="mb-0" />
            <div className="self-end sm:self-auto">
              <CompositeNsfwToggle hideNsfw={hideNsfw} />
            </div>
          </div>
        </MotionPage>

        <CompositeAnchorNav items={renderedAnchors} className="mb-6" />

        <div className="space-y-10">
          <section id="hero" className="scroll-mt-32">
            <CompositeHero
              video={videoEnabled ? (hotVideos[0] ?? null) : null}
              image={imageEnabled ? (hotImages[0] ?? null) : null}
              game={gameEnabled ? (hotGames[0] ?? null) : null}
            />
          </section>

          <section id="tags" className="scroll-mt-32">
            <CompositeTrendingTags tags={trendingTags} />
          </section>

          <section id="mixed-hot" className="scroll-mt-32">
            <CompositeMixedHot
              skip={1}
              perKind={4}
              videos={videoEnabled ? hotVideos : []}
              images={imageEnabled ? hotImages : []}
              games={gameEnabled ? hotGames : []}
            />
          </section>

          {videoEnabled && initialVideos.length > 0 && (
            <section id="latest-video" className="scroll-mt-32">
              <SectionHeader title="最新视频" icon={Play} iconClass="text-rose-500" more="/video">
                <HorizontalScroller
                  items={initialVideos}
                  itemWidthClass="w-[260px] sm:w-[280px]"
                  renderItem={(v, i) => <VideoCard video={v} index={i} />}
                />
              </SectionHeader>
            </section>
          )}

          {imageEnabled && initialImages.length > 0 && (
            <section id="latest-image" className="scroll-mt-32">
              <SectionHeader title="最新图集" icon={Images} iconClass="text-sky-500" more="/image">
                <ImageMasonry
                  items={initialImages.map((p, i) => ({
                    key: p.id,
                    node: <ImagePostCard post={p} index={i} variant="masonry" />,
                  }))}
                />
              </SectionHeader>
            </section>
          )}

          {gameEnabled && initialGames.length > 0 && (
            <section id="latest-game" className="scroll-mt-32">
              <SectionHeader title="最新游戏" icon={Gamepad2} iconClass="text-emerald-500" more="/game">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                  {initialGames.map((g, i) => (
                    <GameCard key={g.id} game={g} index={i} />
                  ))}
                </div>
              </SectionHeader>
            </section>
          )}

          <section id="ranking" className="scroll-mt-32">
            <CompositeWeeklyRanking
              videos={videoEnabled ? hotVideos : []}
              images={imageEnabled ? hotImages : []}
              games={gameEnabled ? hotGames : []}
            />
          </section>
        </div>
      </div>
    </MotionPage>
  );
}

interface SectionHeaderProps {
  title: string;
  icon: LucideIcon;
  iconClass?: string;
  more: string;
  children: React.ReactNode;
}

function SectionHeader({ title, icon: Icon, iconClass, more, children }: SectionHeaderProps) {
  return (
    <section>
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", iconClass)} />
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h2>
        </div>
        <Link
          href={more}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          查看更多
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>
      {children}
    </section>
  );
}
