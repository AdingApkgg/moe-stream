"use client";

import type { ReactNode } from "react";
import { ChevronRight, Gamepad2, Images, Play, type LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video/video-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { GameCard, type GameCardData } from "@/components/game/game-card";
import type { Zone } from "../_lib/utils";

const OVERVIEW_STALE_TIME = 30_000;

function OverviewSection({
  icon: Icon,
  title,
  count,
  onViewAll,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  onViewAll: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-4.5 w-4.5 text-primary" />
          {title}
          {count != null && count > 0 && (
            <Badge variant="secondary" className="text-xs font-normal ml-1">
              {count}
            </Badge>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary gap-1 h-8"
          onClick={onViewAll}
        >
          查看全部
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </section>
  );
}

function OverviewSkeleton({ aspect }: { aspect: "video" | "square" }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className={`${aspect === "video" ? "aspect-video" : "aspect-square"} rounded-lg`} />
      ))}
    </div>
  );
}

interface OverviewZoneProps {
  userId: string;
  videosCount: number;
  imagePostsCount: number;
  gamesCount: number;
  onSwitchZone: (zone: Zone) => void;
}

export function OverviewZone({ userId, videosCount, imagePostsCount, gamesCount, onSwitchZone }: OverviewZoneProps) {
  const videos = trpc.user.getVideos.useQuery({ userId, limit: 4, page: 1 }, { staleTime: OVERVIEW_STALE_TIME });
  const images = trpc.image.getUserPosts.useQuery({ userId, limit: 4, page: 1 }, { staleTime: OVERVIEW_STALE_TIME });
  const games = trpc.user.getGames.useQuery({ userId, limit: 4, page: 1 }, { staleTime: OVERVIEW_STALE_TIME });

  const oVideos = videos.data?.videos ?? [];
  const oImages = images.data?.posts ?? [];
  const oGames = (games.data?.games ?? []) as GameCardData[];

  return (
    <div className="space-y-6">
      <OverviewSection icon={Play} title="视频作品" count={videosCount} onViewAll={() => onSwitchZone("video")}>
        {videos.isLoading ? (
          <OverviewSkeleton aspect="video" />
        ) : oVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">暂无视频作品</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {oVideos.map((video, index) => (
              <VideoCard key={video.id} video={video} index={index} />
            ))}
          </div>
        )}
      </OverviewSection>

      <OverviewSection icon={Images} title="图片作品" count={imagePostsCount} onViewAll={() => onSwitchZone("image")}>
        {images.isLoading ? (
          <OverviewSkeleton aspect="square" />
        ) : oImages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">暂无图片作品</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {oImages.map((post, index) => (
              <ImagePostCard key={post.id} post={post} index={index} />
            ))}
          </div>
        )}
      </OverviewSection>

      <OverviewSection icon={Gamepad2} title="游戏作品" count={gamesCount} onViewAll={() => onSwitchZone("game")}>
        {games.isLoading ? (
          <OverviewSkeleton aspect="video" />
        ) : oGames.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">暂无游戏作品</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {oGames.map((game, index) => (
              <GameCard key={game.id} game={game} index={index} />
            ))}
          </div>
        )}
      </OverviewSection>
    </div>
  );
}
