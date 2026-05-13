"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { VideoCard } from "@/components/video/video-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { GameCard } from "@/components/game/game-card";

type VideoItem = Parameters<typeof VideoCard>[0]["video"];
type ImageItem = Parameters<typeof ImagePostCard>[0]["post"];
type GameItem = Parameters<typeof GameCard>[0]["game"];

interface CompositeMixedHotProps {
  /** 跳过的索引数（前 N 名给 hero 用，本 section 从 N 开始取） */
  skip?: number;
  /** 每类取多少条（去掉 hero 占位之后）*/
  perKind?: number;
  videos: VideoItem[];
  images: ImageItem[];
  games: GameItem[];
}

/**
 * 跨视频/图集/游戏的混合热门 grid：从每类 hot 列表里跳过 hero 名次后各取 N 条，
 * 按位置交错排列（V0,I0,G0,V1,I1,G1,...），渲染时用各自原生 card 组件并保留类型差异。
 */
export function CompositeMixedHot({ skip = 1, perKind = 4, videos, images, games }: CompositeMixedHotProps) {
  const items = useMemo<MixedItem[]>(() => {
    const v = videos.slice(skip, skip + perKind).map<MixedItem>((item) => ({ kind: "video", id: item.id, item }));
    const i = images.slice(skip, skip + perKind).map<MixedItem>((item) => ({ kind: "image", id: item.id, item }));
    const g = games.slice(skip, skip + perKind).map<MixedItem>((item) => ({ kind: "game", id: item.id, item }));
    // 按位置交错：V0 I0 G0 V1 I1 G1 …，单类型不足时跳过其位
    const max = Math.max(v.length, i.length, g.length);
    const merged: MixedItem[] = [];
    for (let idx = 0; idx < max; idx++) {
      if (v[idx]) merged.push(v[idx]);
      if (i[idx]) merged.push(i[idx]);
      if (g[idx]) merged.push(g[idx]);
    }
    return merged;
  }, [videos, images, games, skip, perKind]);

  if (items.length === 0) return null;

  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">综合热门</h2>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {items.map((entry, i) => {
          if (entry.kind === "video") return <VideoCard key={`v-${entry.id}`} video={entry.item} index={i} />;
          if (entry.kind === "image") {
            return <ImagePostCard key={`i-${entry.id}`} post={entry.item} index={i} variant="square" />;
          }
          return <GameCard key={`g-${entry.id}`} game={entry.item} index={i} />;
        })}
      </div>
    </section>
  );
}

type MixedItem =
  | { kind: "video"; id: string; item: VideoItem }
  | { kind: "image"; id: string; item: ImageItem }
  | { kind: "game"; id: string; item: GameItem };
