"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { MotionPage } from "@/components/motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VideoCard } from "@/components/video/video-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { GameCard } from "@/components/game/game-card";
import { Flame, TrendingUp, Calendar, CalendarDays, Heart, Star, Hash, Sparkles } from "lucide-react";

type ContentTypeKey = "video" | "image" | "game" | "combined" | "tag";

type BaseCategoryKey =
  | "score_1d"
  | "score_7d"
  | "score_30d"
  | "surge"
  | "fav_period_7d"
  | "fav_period_30d"
  | "fav_total";
type CombinedCategoryKey = "score_1d" | "score_7d" | "score_30d";
type TagCategoryKey = "tag_hot" | "tag_surge";

interface BaseTabDef {
  key: BaseCategoryKey;
  label: string;
  icon: typeof Flame;
  category: "score" | "surge" | "fav_period" | "fav_total";
  period: "1d" | "7d" | "30d" | "all";
}

const BASE_TABS: BaseTabDef[] = [
  { key: "score_1d", label: "日榜", icon: Flame, category: "score", period: "1d" },
  { key: "score_7d", label: "周榜", icon: Calendar, category: "score", period: "7d" },
  { key: "score_30d", label: "月榜", icon: CalendarDays, category: "score", period: "30d" },
  { key: "surge", label: "飙升", icon: TrendingUp, category: "surge", period: "1d" },
  { key: "fav_period_7d", label: "周收藏", icon: Heart, category: "fav_period", period: "7d" },
  { key: "fav_period_30d", label: "月收藏", icon: Heart, category: "fav_period", period: "30d" },
  { key: "fav_total", label: "总收藏", icon: Star, category: "fav_total", period: "all" },
];

const COMBINED_TABS: Array<{
  key: CombinedCategoryKey;
  label: string;
  icon: typeof Flame;
  period: "1d" | "7d" | "30d";
}> = [
  { key: "score_1d", label: "日榜", icon: Flame, period: "1d" },
  { key: "score_7d", label: "周榜", icon: Calendar, period: "7d" },
  { key: "score_30d", label: "月榜", icon: CalendarDays, period: "30d" },
];

const TAG_TABS: Array<{ key: TagCategoryKey; label: string; icon: typeof Hash }> = [
  { key: "tag_hot", label: "热门标签", icon: Hash },
  { key: "tag_surge", label: "增长最快", icon: Sparkles },
];

function EmptyState() {
  return (
    <div className="text-center text-muted-foreground py-16">
      <p>榜单暂未生成，请稍后再来。</p>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-video bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function BaseContentList({
  contentType,
  category,
  period,
}: {
  contentType: "video" | "image" | "game";
  category: "score" | "surge" | "fav_period" | "fav_total";
  period: "1d" | "7d" | "30d" | "all";
}) {
  const { data, isLoading } = trpc.ranking.list.useQuery({
    contentType,
    category,
    period,
    limit: 50,
    offset: 0,
    excludeNsfw: true,
  });

  if (isLoading) return <GridSkeleton />;
  if (!data?.items.length) return <EmptyState />;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {data.items.map((it) => {
        if (it.type === "video") return <VideoCard key={`v-${it.video.id}`} video={it.video} rank={it.rank} />;
        if (it.type === "image")
          return <ImagePostCard key={`i-${it.imagePost.id}`} post={it.imagePost} rank={it.rank} />;
        return <GameCard key={`g-${it.game.id}`} game={it.game} rank={it.rank} />;
      })}
    </div>
  );
}

function CombinedList({ period }: { period: "1d" | "7d" | "30d" }) {
  const { data, isLoading } = trpc.ranking.list.useQuery({
    contentType: "combined",
    category: "score",
    period,
    limit: 100,
    offset: 0,
    excludeNsfw: true,
  });

  if (isLoading) return <GridSkeleton />;
  if (!data?.items.length) return <EmptyState />;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {data.items.map((it) => {
        if (it.type === "video") return <VideoCard key={`v-${it.video.id}`} video={it.video} rank={it.rank} />;
        if (it.type === "image")
          return <ImagePostCard key={`i-${it.imagePost.id}`} post={it.imagePost} rank={it.rank} />;
        return <GameCard key={`g-${it.game.id}`} game={it.game} rank={it.rank} />;
      })}
    </div>
  );
}

function TagList({ category }: { category: "tag_hot" | "tag_surge" }) {
  const { data, isLoading } = trpc.ranking.tags.useQuery({ category, limit: 50, offset: 0 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (!data?.items.length) return <EmptyState />;

  return (
    <ol className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {data.items.map((t) => (
        <li key={t.id}>
          <Link
            href={`/tags/${t.slug}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/60 transition-colors"
          >
            <span className="w-6 text-center text-sm font-bold text-muted-foreground tabular-nums">{t.rank}</span>
            <Badge variant="secondary" className="font-medium">
              {t.name}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {category === "tag_hot" ? `${t.score} 内容` : `+${t.score}`}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function BaseContentSection({ contentType }: { contentType: "video" | "image" | "game" }) {
  const [sub, setSub] = useState<BaseCategoryKey>("score_1d");
  return (
    <Tabs value={sub} onValueChange={(v) => setSub(v as BaseCategoryKey)}>
      <TabsList className="mb-6 flex-wrap h-auto">
        {BASE_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {BASE_TABS.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          <BaseContentList contentType={contentType} category={t.category} period={t.period} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CombinedSection() {
  const [sub, setSub] = useState<CombinedCategoryKey>("score_1d");
  return (
    <Tabs value={sub} onValueChange={(v) => setSub(v as CombinedCategoryKey)}>
      <TabsList className="mb-6">
        {COMBINED_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {COMBINED_TABS.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          <CombinedList period={t.period} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TagSection() {
  const [sub, setSub] = useState<TagCategoryKey>("tag_hot");
  return (
    <Tabs value={sub} onValueChange={(v) => setSub(v as TagCategoryKey)}>
      <TabsList className="mb-6">
        {TAG_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
              <Icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {TAG_TABS.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          <TagList category={t.key} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function RankingsClient() {
  const [type, setType] = useState<ContentTypeKey>("video");

  return (
    <MotionPage>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">排行榜</h1>
        <p className="text-sm text-muted-foreground mb-6">基于点赞、收藏、评论加权计算，按周期定时刷新</p>

        <Tabs value={type} onValueChange={(v) => setType(v as ContentTypeKey)}>
          <TabsList className="mb-6">
            <TabsTrigger value="video">视频</TabsTrigger>
            <TabsTrigger value="image">图集</TabsTrigger>
            <TabsTrigger value="game">游戏</TabsTrigger>
            <TabsTrigger value="combined">综合</TabsTrigger>
            <TabsTrigger value="tag">标签</TabsTrigger>
          </TabsList>

          <TabsContent value="video">
            <BaseContentSection contentType="video" />
          </TabsContent>
          <TabsContent value="image">
            <BaseContentSection contentType="image" />
          </TabsContent>
          <TabsContent value="game">
            <BaseContentSection contentType="game" />
          </TabsContent>
          <TabsContent value="combined">
            <CombinedSection />
          </TabsContent>
          <TabsContent value="tag">
            <TagSection />
          </TabsContent>
        </Tabs>
      </div>
    </MotionPage>
  );
}
