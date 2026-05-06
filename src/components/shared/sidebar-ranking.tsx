"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, Eye } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatViews } from "@/lib/format";
import { useVideoCoverThumb, useThumb } from "@/hooks/use-thumb";

type RankKind = "video" | "image" | "game";
type TimeRange = "today" | "week" | "month" | "all";

const TIME_TABS: readonly { id: TimeRange; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "week", label: "本周" },
  { id: "month", label: "本月" },
  { id: "all", label: "总榜" },
];

interface SidebarRankingProps {
  kind: RankKind;
  className?: string;
  limit?: number;
}

interface NormalizedItem {
  id: string;
  title: string;
  thumb: string | null;
  views: number;
  href: string;
}

export function SidebarRanking({ kind, className, limit = 10 }: SidebarRankingProps) {
  const supportsTimeRange = kind === "video" || kind === "game";
  const [range, setRange] = useState<TimeRange>("all");

  const videoThumb = useVideoCoverThumb("sideList");
  const imageThumb = useThumb("sideList");

  const videoQ = trpc.video.list.useQuery(
    { limit, page: 1, sortBy: "views", timeRange: supportsTimeRange ? range : "all" },
    { enabled: kind === "video", staleTime: 60_000 },
  );
  const imageQ = trpc.image.list.useQuery(
    { limit, page: 1, sortBy: "views" },
    { enabled: kind === "image", staleTime: 60_000 },
  );
  const gameQ = trpc.game.list.useQuery(
    { limit, page: 1, sortBy: "views", timeRange: supportsTimeRange ? range : "all" },
    { enabled: kind === "game", staleTime: 60_000 },
  );

  const isLoading = kind === "video" ? videoQ.isLoading : kind === "image" ? imageQ.isLoading : gameQ.isLoading;

  const items: NormalizedItem[] = useMemo(() => {
    if (kind === "video") {
      return (videoQ.data?.videos ?? []).map((v) => ({
        id: v.id,
        title: v.title,
        thumb: videoThumb(v.id, v.coverUrl ?? null),
        views: v.views,
        href: `/video/${v.id}`,
      }));
    }
    if (kind === "image") {
      return (imageQ.data?.posts ?? []).map((p) => {
        const imgs = (p.images ?? []) as string[];
        return {
          id: p.id,
          title: p.title,
          thumb: imgs[0] ? imageThumb(imgs[0]) : null,
          views: p.views,
          href: `/image/${p.id}`,
        };
      });
    }
    return (gameQ.data?.games ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      thumb: g.coverUrl ?? null,
      views: g.views,
      href: `/game/${g.id}`,
    }));
  }, [kind, videoQ.data, imageQ.data, gameQ.data, videoThumb, imageThumb]);

  return (
    <aside className={cn("rounded-2xl bg-card ring-1 ring-border/50 shadow-sm overflow-hidden", className)}>
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-border/40">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">热度榜</h3>
      </div>

      {supportsTimeRange && (
        <div className="px-3 pt-2">
          <div className="flex gap-0.5 bg-muted/60 rounded-full p-0.5">
            {TIME_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRange(t.id)}
                className={cn(
                  "flex-1 px-2 py-1 text-[11px] font-medium rounded-full transition-colors",
                  range === t.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="p-2">
        {isLoading && items.length === 0
          ? Array.from({ length: limit }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-2 py-1.5">
                <div className="h-5 w-5 shrink-0 rounded bg-muted animate-pulse" />
                <div className="h-12 w-20 shrink-0 rounded-md bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              </li>
            ))
          : items.map((item, idx) => {
              const rank = idx + 1;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span
                      className={cn(
                        "shrink-0 w-5 text-center text-sm font-bold tabular-nums",
                        rank === 1 && "text-rose-500",
                        rank === 2 && "text-orange-500",
                        rank === 3 && "text-amber-500",
                        rank > 3 && "text-muted-foreground",
                      )}
                    >
                      {rank}
                    </span>
                    <div className="relative shrink-0 w-20 aspect-video rounded-md overflow-hidden bg-muted">
                      {item.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumb}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {formatViews(item.views)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}

        {!isLoading && items.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">暂无数据</li>
        )}
      </ol>
    </aside>
  );
}
