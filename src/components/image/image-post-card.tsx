"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Images, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatViews } from "@/lib/format";
import { useSound } from "@/hooks/use-sound";
import { SearchHighlightText } from "@/components/shared/search-highlight-text";
import { CardMeta } from "@/components/shared/card-meta";
import { NewBadge, RankBadge } from "@/components/shared/card-badges";
import { HoverFavoriteButton } from "@/components/shared/hover-favorite-button";
import { MediaCoverSkeleton } from "@/components/shared/media-cover-skeleton";
import { useThumb } from "@/hooks/use-thumb";
import { useInViewOnce } from "@/hooks/use-in-view-once";
import { trpc } from "@/lib/trpc";

interface ImagePostCardProps {
  post: {
    id: string;
    title: string;
    description?: string | null;
    images: unknown;
    views: number;
    isNsfw?: boolean;
    createdAt: Date | string;
    uploader: {
      id: string;
      username: string;
      nickname?: string | null;
      avatar?: string | null;
    };
    tags?: { tag: { id: string; name: string; slug: string } }[];
  };
  index?: number;
  highlightQuery?: string | null;
  /** 排行榜场景：1/2/3 显示金/银/铜冠 */
  rank?: number;
  /** 当前用户是否已收藏 */
  isFavorited?: boolean;
}

function ImagePostMainThumb({ src, alt, priority }: { src: string; alt: string; priority: boolean }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && <MediaCoverSkeleton className="z-[1]" />}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        unoptimized
        className="z-[2] object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:scale-105"
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

function ImagePostCardComponent({ post, index, highlightQuery, rank, isFavorited }: ImagePostCardProps) {
  const thumbPrimary = useThumb("gridPrimary");
  const thumbSecondary = useThumb("gridSecondary");
  const { play } = useSound();
  // 只有前 4 张首屏封面走高优先级，其余全部懒加载，避免首屏同时下载过多图片
  const priority = index !== undefined && index < 4;
  const { ref: viewportRef, inView } = useInViewOnce<HTMLDivElement>({ disabled: priority });

  const imageUrls = (post.images ?? []) as string[];
  const imageCount = imageUrls.length;
  const hasMultiple = imageCount > 1;
  const showMain = inView || priority;
  // 堆叠背景图始终等 inView，不受 priority 影响，减少首屏并发请求
  const showSecondary = inView && hasMultiple;
  const mainSrcKey = `${post.id}:${imageUrls[0] ?? ""}`;

  return (
    <div ref={viewportRef} className="group" onMouseEnter={() => play("hover")}>
      <Link href={`/image/${post.id}`} className="block">
        <div className={cn("relative aspect-square", hasMultiple && "pr-2.5 pb-1")}>
          {showSecondary && (
            <>
              {imageUrls[2] && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden border border-border/40 shadow-md origin-bottom-left rotate-[5deg] translate-x-3 translate-y-[-2px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[7deg] group-hover:translate-x-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbSecondary(imageUrls[2])}
                    alt=""
                    className="w-full h-full object-cover brightness-[0.85]"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl overflow-hidden border border-border/50 shadow-md origin-bottom-left rotate-[2.5deg] translate-x-1.5 translate-y-[-1px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[4deg] group-hover:translate-x-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbSecondary(imageUrls[1])}
                  alt=""
                  className="w-full h-full object-cover brightness-90"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              </div>
            </>
          )}

          <div className="relative overflow-hidden rounded-2xl bg-muted shadow-sm group-hover:shadow-xl transition-[shadow,transform] duration-300 ease-out h-full border border-transparent group-hover:border-border/20">
            {imageUrls.length > 0 ? (
              showMain ? (
                <ImagePostMainThumb
                  key={mainSrcKey}
                  src={thumbPrimary(imageUrls[0])}
                  alt={post.title}
                  priority={priority}
                />
              ) : (
                <MediaCoverSkeleton className="relative z-[1] h-full w-full min-h-0" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Images className="w-12 h-12 text-muted-foreground/30" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* 排行榜徽章 / NEW 徽章（左上角，二选一）*/}
            {rank !== undefined ? <RankBadge rank={rank} /> : <NewBadge createdAt={post.createdAt} />}

            {post.isNsfw && (
              <div className="absolute top-1.5 right-1.5 bg-red-500/90 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold">
                NSFW
              </div>
            )}

            {imageCount > 1 && (
              <div
                className={cn(
                  "absolute right-1.5 bg-black/75 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1",
                  post.isNsfw ? "top-9" : "top-1.5",
                )}
              >
                <Images className="h-3 w-3" />
                {imageCount}
              </div>
            )}

            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5 text-[10px] sm:text-xs text-white/80">
              <Eye className="h-3 w-3" />
              {formatViews(post.views)}
            </div>

            {/* 浮动快捷收藏（hover 浮出，desktop only） */}
            <ImagePostFavoriteFab postId={post.id} isFavorited={isFavorited ?? false} />
          </div>
        </div>

        <div className="mt-2 px-0.5 space-y-0.5">
          <h3 className="font-medium line-clamp-2 text-xs sm:text-sm leading-snug group-hover:text-primary transition-colors duration-200 ease-out">
            <SearchHighlightText text={post.title} highlightQuery={highlightQuery} />
          </h3>
          {post.description && (
            <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1">
              <SearchHighlightText text={post.description} highlightQuery={highlightQuery} />
            </p>
          )}
          <CardMeta author={post.uploader.nickname || post.uploader.username} createdAt={post.createdAt} />
        </div>
      </Link>
    </div>
  );
}

function ImagePostFavoriteFab({ postId, isFavorited }: { postId: string; isFavorited: boolean }) {
  const utils = trpc.useUtils();
  const mutation = trpc.image.toggleFavorite.useMutation();
  return (
    <HoverFavoriteButton
      favorited={isFavorited}
      unauthCallbackUrl={`/image/${postId}`}
      onToggle={async () => {
        const data = await mutation.mutateAsync({ imagePostId: postId });
        void utils.image.favoritedMap.invalidate();
        return data.favorited;
      }}
    />
  );
}

export const ImagePostCard = memo(ImagePostCardComponent, (prev, next) => {
  return (
    prev.post.id === next.post.id &&
    prev.post.views === next.post.views &&
    prev.index === next.index &&
    prev.highlightQuery === next.highlightQuery &&
    prev.rank === next.rank &&
    prev.isFavorited === next.isFavorited
  );
});
