import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GamePageClient } from "./client";
import { cache, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicSiteConfig } from "@/lib/site-config";

interface GamePageProps {
  params: Promise<{ id: string }>;
}

const getGame = cache(async (id: string) => {
  return prisma.game.findUnique({
    where: { id },
    include: {
      uploader: {
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      _count: {
        select: {
          likes: true,
          dislikes: true,
          favorites: true,
          comments: true,
        },
      },
    },
  });
});

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);

  if (!game) {
    return {
      title: "游戏不存在",
      description: "该游戏可能已被删除或不存在",
    };
  }

  const uploaderName = game.uploader.nickname || game.uploader.username;
  const description = game.description
    ? game.description.slice(0, 160)
    : `${uploaderName} 分享的游戏`;
  const keywords = game.tags.map(({ tag }) => tag.name);

  const siteConfig = await getPublicSiteConfig();
  const baseUrl = siteConfig.siteUrl;

  return {
    title: game.title,
    description,
    keywords: ["ACGN", "游戏", game.gameType || "", ...keywords].filter(Boolean),
    authors: [{ name: uploaderName }],
    openGraph: {
      type: "website",
      title: game.title,
      description,
      url: `${baseUrl}/game/${id}`,
      ...(game.coverUrl && {
        images: [
          {
            url: game.coverUrl.startsWith("http") ? game.coverUrl : `${baseUrl}${game.coverUrl}`,
            width: 600,
            height: 800,
            alt: game.title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: game.title,
      description,
    },
  };
}

/** 游戏 extraInfo 类型定义 */
export interface GameExtraInfo {
  originalName?: string;
  originalAuthor?: string;
  authorUrl?: string;
  fileSize?: string;
  platforms?: string[];
  screenshots?: string[];
  /** 游戏预览视频（mp4 / m3u8 等） */
  videos?: string[];
  characterIntro?: string;
  downloads?: { name: string; url: string; password?: string }[];
  keywords?: string[];
  notices?: { type: "info" | "success" | "warning" | "error"; content: string }[];
}

function serializeGame(game: NonNullable<Awaited<ReturnType<typeof getGame>>>) {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    coverUrl: game.coverUrl,
    gameType: game.gameType,
    isFree: game.isFree,
    version: game.version,
    views: game.views,
    status: game.status,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    extraInfo: game.extraInfo as GameExtraInfo | null,
    uploader: game.uploader,
    tags: game.tags,
    _count: game._count,
  };
}

export type SerializedGame = ReturnType<typeof serializeGame>;

export default async function GamePage({ params }: GamePageProps) {
  const { id } = await params;
  const game = await getGame(id);

  if (!game) {
    notFound();
  }

  const serializedGame = serializeGame(game);

  return (
    <Suspense fallback={<GamePageSkeleton />}>
      <GamePageClient id={id} initialGame={serializedGame} />
    </Suspense>
  );
}

function GamePageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-4">
      <Skeleton className="h-5 w-28 mb-4" />

      {/* Cover */}
      <Skeleton className="aspect-video w-full max-w-3xl mx-auto rounded-xl" />

      {/* Title + stats */}
      <div className="max-w-3xl mx-auto mt-5 space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
        </div>
      </div>

      {/* Download card */}
      <Skeleton className="h-28 w-full rounded-lg mt-6" />

      {/* Tabs */}
      <div className="mt-6 space-y-4">
        <div className="flex gap-4 border-b pb-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
