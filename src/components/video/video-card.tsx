"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { VideoCover } from "./video-cover";
import { Play, ThumbsUp, MessageCircle, Check, Crown, Heart, Loader2 } from "lucide-react";
import { formatDuration, formatViews } from "@/lib/format";
import { useSound } from "@/hooks/use-sound";
import { cn } from "@/lib/utils";
import { SearchHighlightText } from "@/components/shared/search-highlight-text";
import { CardMeta } from "@/components/shared/card-meta";
import { useStableSession } from "@/lib/hooks";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast-with-sound";
import { useRouter } from "next/navigation";

const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 小时内视为「新」
const WATCHED_THRESHOLD = 0.95; // 看完进度阈值

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
  /** 当前用户的观看进度（来自 video.progressMap）。未登录或未观看时为 undefined */
  watchProgress?: { progress: number; duration: number | null };
  /** 排行榜场景：1/2/3 显示金/银/铜冠图标，其它整数显示数字徽章 */
  rank?: number;
  /** 当前用户是否已收藏该视频（来自 video.favoritedMap）。控制浮动按钮的填充态 */
  isFavorited?: boolean;
}

function VideoCardComponent({ video, index, highlightQuery, watchProgress, rank, isFavorited }: VideoCardProps) {
  const { play } = useSound();

  const extra =
    video.extraInfo && typeof video.extraInfo === "object" && !Array.isArray(video.extraInfo) ? video.extraInfo : null;
  const authorName = extra?.author || video.uploader.nickname || video.uploader.username;

  const totalVotes = video._count.likes + (video._count.dislikes || 0);
  const likeRatio = totalVotes > 0 ? Math.round((video._count.likes / totalVotes) * 100) : 100;
  const likeColor = likeRatio >= 90 ? "text-green-400" : likeRatio >= 70 ? "text-yellow-400" : "text-red-400";
  const commentCount = video._count.comments ?? 0;

  // 24h 内上传 → NEW 徽章。
  // 注：渲染中调 Date.now() 严格意义上不是纯函数，但每次 render 取的"现在时间"
  // 用作 NEW 标记是 acceptable 的——它不会引起循环更新（仅决定徽章是否显示），
  // 且每个 VideoCard 都被 memo 包裹只在 props 变更时重渲染。
  const createdMs = new Date(video.createdAt).getTime();
  // eslint-disable-next-line react-hooks/purity
  const isNew = Number.isFinite(createdMs) && Date.now() - createdMs < NEW_THRESHOLD_MS;

  // 进度比例 0..1（仅当 duration 已知）。watchHistory 用 progress 字段（秒）
  const progressDuration = watchProgress?.duration ?? video.duration ?? null;
  const progressRatio =
    watchProgress && progressDuration && progressDuration > 0
      ? Math.min(1, Math.max(0, watchProgress.progress / progressDuration))
      : 0;
  const watched = progressRatio >= WATCHED_THRESHOLD;

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
            className={cn(
              "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform group-hover:scale-105",
              watched && "grayscale opacity-70",
            )}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Play hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-250 ease-out">
            <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full p-3 shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95">
              <Play className="h-5 w-5 text-primary fill-primary" />
            </div>
          </div>

          {/* 排行榜徽章（前 3 名金/银/铜，其它显示数字） */}
          {rank !== undefined && <RankBadge rank={rank} />}

          {/* 左上：NEW（仅当未在排行榜场景下） */}
          {rank === undefined && isNew && (
            <div className="absolute top-1.5 left-1.5 bg-orange-500/95 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold shadow-sm">
              NEW
            </div>
          )}

          {/* 中部偏左下：时长（在排行榜场景下下移避免与 RankBadge 重叠） */}
          {video.duration && (
            <div
              className={cn(
                "absolute bg-black/75 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium tabular-nums",
                isNew && rank === undefined ? "top-9 left-1.5" : "top-1.5 left-1.5",
                rank !== undefined && "left-12 top-1.5",
              )}
            >
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

          {/* 浮动快捷收藏按钮（hover 时浮出，desktop only） */}
          <FavoriteFab videoId={video.id} isFavorited={isFavorited ?? false} />

          {/* 已看完角标 */}
          {watched && (
            <div className="absolute top-1.5 right-1.5 bg-green-500/95 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 shadow-sm">
              <Check className="h-3 w-3" />
              已看完
            </div>
          )}

          {/* 进度条：未看完且有进度时展示 */}
          {progressRatio > 0 && !watched && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
                aria-label={`观看进度 ${Math.round(progressRatio * 100)}%`}
              />
            </div>
          )}
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

/**
 * 浮动收藏按钮：卡片左下角，hover 时浮出（移动端隐藏避免误触）。
 * 点击不会触发外层 Link 跳转，直接 toggle favorite。
 * 未登录时跳到登录页。
 */
function FavoriteFab({ videoId, isFavorited }: { videoId: string; isFavorited: boolean }) {
  const router = useRouter();
  const { session } = useStableSession();
  const utils = trpc.useUtils();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const favorited = optimistic ?? isFavorited;

  const mutation = trpc.video.favorite.useMutation({
    onMutate: () => {
      setOptimistic(!favorited);
    },
    onSuccess: (data) => {
      setOptimistic(data.favorited);
      // 让其他页面（收藏列表/详情页）能感知到变化
      void utils.video.favoritedMap.invalidate();
      toast.success(data.favorited ? "已收藏" : "已取消收藏");
    },
    onError: () => {
      setOptimistic(null);
      toast.error("操作失败，请稍后再试");
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/video/${videoId}`)}`);
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate({ videoId });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={favorited ? "取消收藏" : "加入收藏"}
      aria-pressed={favorited}
      className={cn(
        "absolute bottom-1.5 left-1.5 grid h-8 w-8 place-items-center rounded-full",
        "bg-black/55 backdrop-blur-sm text-white shadow-lg",
        "transition-[opacity,transform,background-color] duration-200",
        // 移动端隐藏（避免误触 + 列表页节省空间）
        "hidden md:grid",
        favorited ? "opacity-100" : "opacity-0 group-hover:opacity-100 -translate-y-0.5 group-hover:translate-y-0",
        "hover:bg-black/75 active:scale-90",
      )}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4 transition-colors", favorited ? "fill-pink-500 text-pink-500" : "text-white")} />
      )}
    </button>
  );
}

/** 排行榜徽章：前 3 名金/银/铜冠 + 数字，其它名次仅显示「#N」 */
function RankBadge({ rank }: { rank: number }) {
  if (rank <= 0) return null;
  if (rank <= 3) {
    const tier =
      rank === 1
        ? { ring: "from-amber-300 to-yellow-500", text: "text-amber-50" }
        : rank === 2
          ? { ring: "from-slate-200 to-slate-400", text: "text-slate-50" }
          : { ring: "from-orange-300 to-amber-700", text: "text-orange-50" };
    return (
      <div
        className={cn(
          "absolute top-1.5 left-1.5 z-[1] inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-lg",
          "bg-gradient-to-br",
          tier.ring,
          tier.text,
        )}
        aria-label={`排名第 ${rank}`}
      >
        <Crown className="h-3.5 w-3.5" />
        <span className="tabular-nums">{rank}</span>
      </div>
    );
  }
  return (
    <div className="absolute top-1.5 left-1.5 z-[1] inline-flex items-center rounded-full bg-black/65 backdrop-blur-sm px-2 py-0.5 text-xs font-bold text-white tabular-nums">
      #{rank}
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
    prevProps.highlightQuery === nextProps.highlightQuery &&
    prevProps.rank === nextProps.rank &&
    prevProps.isFavorited === nextProps.isFavorited &&
    prevProps.watchProgress?.progress === nextProps.watchProgress?.progress &&
    prevProps.watchProgress?.duration === nextProps.watchProgress?.duration
  );
});
