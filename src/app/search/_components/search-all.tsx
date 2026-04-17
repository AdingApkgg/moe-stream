"use client";

import Link from "next/link";
import { ArrowRight, Gamepad2, Images, Play, Tag as TagIcon, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VideoCard } from "@/components/video/video-card";
import { GameCard } from "@/components/game/game-card";
import { ImagePostCard } from "@/components/image/image-post-card";
import { SearchHighlightText } from "@/components/shared/search-highlight-text";

type GoTab = (tab: "video" | "game" | "image" | "tag") => void;

interface SearchAllProps {
  query: string;
  onSelectTab: GoTab;
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  onMore,
  moreLabel = "查看全部",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  onMore?: () => void;
  moreLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
        {count > 0 && (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{count > 999 ? "999+" : count}</span>
        )}
      </h2>
      {onMore && count > 0 && (
        <button
          onClick={onMore}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          {moreLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SectionSkeleton({ rows = 4, square }: { rows?: number; square?: boolean }) {
  return (
    <div className={cn("grid gap-3 sm:gap-4", "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn("rounded-lg bg-muted animate-pulse", square ? "aspect-square" : "aspect-video")} />
      ))}
    </div>
  );
}

export function SearchAll({ query, onSelectTab }: SearchAllProps) {
  const { data, isLoading } = trpc.search.all.useQuery(
    { query },
    { enabled: query.trim().length > 0, staleTime: 60_000, placeholderData: (prev) => prev },
  );

  const empty =
    !!data &&
    data.videos.totalCount === 0 &&
    data.games.totalCount === 0 &&
    data.imagePosts.totalCount === 0 &&
    data.tags.totalCount === 0 &&
    data.users.totalCount === 0;

  if (isLoading && !data) {
    return (
      <div className="space-y-10">
        <div>
          <div className="h-5 w-24 mb-3 rounded bg-muted animate-pulse" />
          <SectionSkeleton rows={4} />
        </div>
        <div>
          <div className="h-5 w-24 mb-3 rounded bg-muted animate-pulse" />
          <SectionSkeleton rows={4} square />
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">没有找到与 &quot;{query}&quot; 相关的内容</p>
        <p className="text-xs text-muted-foreground/60 mt-2">试试更换关键词或更短的表述</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-10">
      {/* 用户 */}
      {data.users.items.length > 0 && (
        <section>
          <SectionHeader
            icon={Users}
            title="相关用户"
            count={data.users.totalCount}
            moreLabel="搜索更多用户"
            onMore={undefined /* 当前无独立用户 Tab，可保留入口为空 */}
          />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
            {data.users.items.map((u) => (
              <Link
                key={u.id}
                href={`/user/${u.id}`}
                className="shrink-0 w-32 sm:w-36 flex flex-col items-center text-center p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <Avatar className="h-14 w-14 mb-2">
                  <AvatarImage src={u.avatar ?? undefined} alt={u.nickname ?? u.username} />
                  <AvatarFallback>{(u.nickname ?? u.username).slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="font-medium text-sm w-full truncate">
                  <SearchHighlightText text={u.nickname || u.username} highlightQuery={query} />
                </div>
                <div className="text-xs text-muted-foreground w-full truncate mt-0.5">@{u.username}</div>
                {u._count.videos > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">{u._count.videos} 个视频</div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 标签 */}
      {data.tags.items.length > 0 && (
        <section>
          <SectionHeader
            icon={TagIcon}
            title="相关标签"
            count={data.tags.totalCount}
            onMore={() => onSelectTab("tag")}
          />
          <div className="flex flex-wrap gap-2">
            {data.tags.items.map((tag) => {
              const total = tag.videoCount + tag.gameCount + tag.imagePostCount;
              return (
                <Link
                  key={tag.id}
                  href={`/tag/${tag.slug}`}
                  className="transition-transform duration-200 hover:scale-105 active:scale-95"
                >
                  <Badge
                    variant="outline"
                    className="text-sm py-1.5 px-3 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <TagIcon className="h-3.5 w-3.5 mr-1.5" />
                    <SearchHighlightText text={tag.name} highlightQuery={query} />
                    {total > 0 && <span className="ml-1.5 opacity-60 text-xs">({total})</span>}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 视频 */}
      {data.videos.items.length > 0 && (
        <section>
          <SectionHeader
            icon={Play}
            title="相关视频"
            count={data.videos.totalCount}
            onMore={() => onSelectTab("video")}
          />
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {data.videos.items.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} highlightQuery={query} />
            ))}
          </div>
        </section>
      )}

      {/* 游戏 */}
      {data.games.items.length > 0 && (
        <section>
          <SectionHeader
            icon={Gamepad2}
            title="相关游戏"
            count={data.games.totalCount}
            onMore={() => onSelectTab("game")}
          />
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {data.games.items.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} highlightQuery={query} />
            ))}
          </div>
        </section>
      )}

      {/* 图片 */}
      {data.imagePosts.items.length > 0 && (
        <section>
          <SectionHeader
            icon={Images}
            title="相关图片"
            count={data.imagePosts.totalCount}
            onMore={() => onSelectTab("image")}
          />
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {data.imagePosts.items.map((p, i) => (
              <ImagePostCard key={p.id} post={p} index={i} highlightQuery={query} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
