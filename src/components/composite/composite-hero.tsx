"use client";

import Link from "next/link";
import { useState } from "react";
import { Play, Images, Gamepad2, Flame, Eye, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatViews } from "@/lib/format";
import { useThumb } from "@/hooks/use-thumb";
import { useSiteConfig } from "@/contexts/site-config";
import { DEFAULT_THUMBNAIL_PRESETS, getVideoCoverThumbUrl } from "@/lib/thumbnail-presets";
import { MediaCoverSkeleton } from "@/components/shared/media-cover-skeleton";

interface VideoItem {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  views: number;
  uploader: { id: string; username: string; nickname?: string | null };
}
interface ImageItem {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  views: number;
  uploader: { id: string; username: string; nickname?: string | null };
}
interface GameItem {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  views: number;
  uploader: { id: string; username: string; nickname?: string | null };
}

interface CompositeHeroProps {
  video?: VideoItem | null;
  image?: ImageItem | null;
  game?: GameItem | null;
}

/**
 * 综合页 Hero 推荐：1 大 + 2 小主次布局。
 * 主位由视图量最高的类型担任，其余两类降级为副位。
 * 任一类型缺数据时该位空缺；三类皆空时 section 不渲染。
 */
export function CompositeHero({ video, image, game }: CompositeHeroProps) {
  const entries: { kind: HeroKind; item: HeroItem }[] = [];
  if (video) entries.push({ kind: "video", item: video });
  if (image) entries.push({ kind: "image", item: image });
  if (game) entries.push({ kind: "game", item: game });
  if (entries.length === 0) return null;

  // 主位：按 views 取最高那个；次/末位保持原顺序去重，保证三类齐全时视频/图集/游戏都有曝光
  const sorted = [...entries].sort((a, b) => b.item.views - a.item.views);
  const main = sorted[0];
  const sides = entries.filter((e) => e.kind !== main.kind);

  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">本月热门推荐</h2>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroCard kind={main.kind} item={main.item} size="lg" />
        </div>
        {sides.length > 0 && (
          <div className="flex flex-col gap-3 sm:gap-4">
            {sides.map(({ kind, item }) => (
              <HeroCard key={`${kind}-${item.id}`} kind={kind} item={item} size="sm" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type HeroKind = "video" | "image" | "game";
type HeroItem = VideoItem | ImageItem | GameItem;
type HeroSize = "lg" | "sm";

const KIND_META: Record<HeroKind, { label: string; icon: LucideIcon; iconClass: string; bg: string }> = {
  video: { label: "视频", icon: Play, iconClass: "text-rose-100", bg: "bg-rose-500/90" },
  image: { label: "图集", icon: Images, iconClass: "text-sky-100", bg: "bg-sky-500/90" },
  game: { label: "游戏", icon: Gamepad2, iconClass: "text-emerald-100", bg: "bg-emerald-500/90" },
};

function HeroCard({ kind, item, size }: { kind: HeroKind; item: HeroItem; size: HeroSize }) {
  const cover = useHeroCover(kind, item, size);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const href = `/${kind === "image" ? "image" : kind}/${item.id}`;
  const author = item.uploader.nickname || item.uploader.username;
  const isLg = size === "lg";

  return (
    <Link
      href={href}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-muted shadow-sm hover:shadow-xl transition-shadow"
    >
      <HeroCover src={cover} alt={item.title} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/40" />
      <span
        className={cn(
          "absolute top-2 left-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold backdrop-blur-sm",
          isLg ? "text-sm" : "text-xs",
          meta.bg,
          meta.iconClass,
        )}
      >
        <Icon className={isLg ? "h-4 w-4" : "h-3 w-3"} />
        {meta.label}
      </span>
      <span
        className={cn(
          "absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/55 backdrop-blur-sm px-2 py-0.5 font-semibold text-amber-300",
          isLg ? "text-sm" : "text-xs",
        )}
      >
        <Flame className={isLg ? "h-4 w-4" : "h-3 w-3"} />
        本月热门
      </span>
      <div className={cn("absolute inset-x-0 bottom-0 text-white", isLg ? "p-4 sm:p-5" : "p-3 sm:p-3.5")}>
        <h3
          className={cn("font-bold leading-tight line-clamp-2", isLg ? "text-xl sm:text-2xl" : "text-sm sm:text-base")}
        >
          {item.title}
        </h3>
        {isLg && item.description && <p className="mt-1.5 text-sm text-white/80 line-clamp-2">{item.description}</p>}
        <div className={cn("mt-1.5 flex items-center gap-2 text-white/80", isLg ? "text-sm" : "text-xs")}>
          <span className="truncate">{author}</span>
          <span className="text-white/40">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Eye className={isLg ? "h-3.5 w-3.5" : "h-3 w-3"} />
            {formatViews(item.views)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function HeroCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <MediaCoverSkeleton />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}

/** 按类型派发出 16:9 hero 用的缩略图 URL（main 用 gridPrimary，小卡尺寸够用） */
function useHeroCover(kind: HeroKind, item: HeroItem, size: HeroSize): string {
  const cfg = useSiteConfig();
  const thumb = useThumb("gridPrimary", 16 / 9);
  if (kind === "video") {
    const v = item as VideoItem;
    const preset = cfg?.thumbnailPresets?.gridPrimary ?? DEFAULT_THUMBNAIL_PRESETS.gridPrimary;
    const proxyEnabled = cfg?.coverProxyThumbEnabled !== false;
    // 主位用更大尺寸（避免拉伸糊），副位走默认 preset
    const w = size === "lg" ? Math.max(preset.width, 800) : preset.width;
    return getVideoCoverThumbUrl(v.id, v.coverUrl, preset, proxyEnabled, { w, h: Math.round(w / (16 / 9)) });
  }
  if (kind === "image") {
    const p = item as ImageItem;
    const first = p.images[0] ?? "";
    if (size === "lg") {
      return thumb(first, { w: 800, h: 450 });
    }
    return thumb(first);
  }
  const g = item as GameItem;
  if (size === "lg") {
    return thumb(g.coverUrl ?? "", { w: 800, h: 450 });
  }
  return thumb(g.coverUrl ?? "");
}
