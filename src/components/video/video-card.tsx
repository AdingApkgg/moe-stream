"use client";

import { memo } from "react";
import Link from "next/link";
import { VideoCover } from "./video-cover";
import { Play, ThumbsUp, MessageCircle } from "lucide-react";
import { formatDuration, formatViews } from "@/lib/format";
import { useSound } from "@/hooks/use-sound";
import { SearchHighlightText } from "@/components/shared/search-highlight-text";
import { CardMeta } from "@/components/shared/card-meta";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    coverUrl?: string | null;
    coverBlurHash?: string | null;
    duration?: number | null;
    views: number;
    createdAt: Date | string;
    uploader: {
      id: string;
      username: string;
      nickname?: string | null;
      avatar?: string | null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extraInfo?: any;
    tags?: { tag: { id: string; name: string; slug: string } }[];
    isNsfw?: boolean;
    _count: {
      likes: number;
      dislikes?: number;
      comments?: number;
      [key: string]: number | undefined;
    };
  };
  index?: number;
  /** 搜索结果页传入，用于标题高亮 */
  highlightQuery?: string | null;
}

function VideoCardComponent({ video, index, highlightQuery }: VideoCardProps) {
  const { play } = useSound();

  const extra =
    video.extraInfo && typeof video.extraInfo === "object" && !Array.isArray(video.extraInfo) ? video.extraInfo : null;
  const authorName = extra?.author || video.uploader.nickname || video.uploader.username;

  const totalVotes = video._count.likes + (video._count.dislikes || 0);
  const likeRatio = totalVotes > 0 ? Math.round((video._count.likes / totalVotes) * 100) : 100;
  const likeColor = likeRatio >= 90 ? "text-green-400" : likeRatio >= 70 ? "text-yellow-400" : "text-red-400";
  const commentCount = video._count.comments ?? 0;

  return (
    <div className="group" onMouseEnter={() => play("hover")}>
      <Link href={`/video/${video.id}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted shadow-[0_1px_2px_0_rgb(0_0_0_/_0.05)] group-hover:shadow-lg transition-shadow duration-300 ease-out">
          <VideoCover
            videoId={video.id}
            coverUrl={video.coverUrl}
            blurDataURL={video.coverBlurHash}
            title={video.title}
            preset="gridPrimary"
            priority={index !== undefined && index < 8}
            className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Play hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-250 ease-out">
            <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full p-3 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95">
              <Play className="h-5 w-5 text-primary fill-primary" />
            </div>
          </div>

          {video.duration && (
            <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium tabular-nums">
              {formatDuration(video.duration)}
            </div>
          )}

          {video.isNsfw && (
            <div className="absolute top-1.5 right-1.5 bg-red-500/90 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold">
              NSFW
            </div>
          )}

          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-2 text-[10px] sm:text-xs">
            <span className={`flex items-center gap-1 ${likeColor}`}>
              <ThumbsUp className="h-3 w-3" />
              {likeRatio}%
            </span>
            <span className="text-white/80">{formatViews(video.views)}次</span>
          </div>
        </div>

        <div className="mt-2 px-0.5 space-y-0.5">
          <h3 className="font-medium line-clamp-2 text-xs sm:text-sm leading-snug group-hover:text-primary transition-colors duration-200 ease-out">
            <SearchHighlightText text={video.title} highlightQuery={highlightQuery} />
          </h3>
          <CardMeta
            author={authorName}
            createdAt={video.createdAt}
            trailing={
              commentCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <MessageCircle className="h-3 w-3" aria-hidden />
                  {formatViews(commentCount)}
                </span>
              ) : null
            }
          />
        </div>
      </Link>
    </div>
  );
}

export const VideoCard = memo(VideoCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.video.id === nextProps.video.id &&
    prevProps.video.views === nextProps.video.views &&
    prevProps.video._count.likes === nextProps.video._count.likes &&
    (prevProps.video._count.comments ?? 0) === (nextProps.video._count.comments ?? 0) &&
    prevProps.index === nextProps.index &&
    prevProps.highlightQuery === nextProps.highlightQuery
  );
});
