"use client";

import { Clock, Star, ThumbsUp, Video } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { VideoCard } from "@/components/video/video-card";
import { CardGrid } from "./card-grid";
import { ContentZone, type SubTabConfig } from "./content-zone";
import type { VideoTab } from "../_lib/utils";

interface VideoZoneProps {
  userId: string;
  isOwnProfile: boolean;
  uploadsCount: number;
  favoritesCount: number;
  likesCount: number;
  tab: VideoTab;
  page: number;
  onTabChange: (tab: VideoTab) => void;
  onPageChange: (page: number) => void;
}

export function VideoZone({
  userId,
  isOwnProfile,
  uploadsCount,
  favoritesCount,
  likesCount,
  tab,
  page,
  onTabChange,
  onPageChange,
}: VideoZoneProps) {
  const enabled = (target: VideoTab) => tab === target;

  const uploads = trpc.user.getVideos.useQuery({ userId, limit: 20, page }, { enabled: enabled("uploads") });
  const history = trpc.video.getUserHistory.useQuery({ userId, limit: 20, page }, { enabled: enabled("history") });
  const favorites = trpc.video.getUserFavorites.useQuery(
    { userId, limit: 20, page },
    { enabled: enabled("favorites") },
  );
  const liked = trpc.video.getUserLiked.useQuery({ userId, limit: 20, page }, { enabled: enabled("liked") });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderVideo = (video: any, index: number) => <VideoCard key={video.id} video={video} index={index} />;
  const ownText = (own: string, other: string) => (isOwnProfile ? own : other);

  const tabs: SubTabConfig[] = [
    {
      key: "uploads",
      label: "作品",
      icon: Video,
      count: uploadsCount,
      totalPages: uploads.data?.totalPages,
      content: (
        <CardGrid
          isLoading={uploads.isLoading}
          items={(uploads.data?.videos ?? []).filter((v) => v?.id != null)}
          renderItem={renderVideo}
          adSeed={`user-${userId}-video-uploads-${page}`}
          empty={{
            icon: Video,
            title: "暂无视频作品",
            description: ownText("你还没有上传过视频", "该用户还没有上传过视频"),
          }}
        />
      ),
    },
    {
      key: "history",
      label: "观看记录",
      icon: Clock,
      totalPages: history.data?.totalPages,
      content: (
        <CardGrid
          isLoading={history.isLoading}
          items={(history.data?.history ?? []).filter((v) => v?.id != null)}
          renderItem={renderVideo}
          adSeed={`user-${userId}-video-history-${page}`}
          empty={{
            icon: Clock,
            title: "暂无观看记录",
            description: ownText("你还没有观看过任何视频", "该用户还没有观看过任何视频"),
          }}
        />
      ),
    },
    {
      key: "favorites",
      label: "收藏",
      icon: Star,
      count: favoritesCount,
      totalPages: favorites.data?.totalPages,
      content: (
        <CardGrid
          isLoading={favorites.isLoading}
          items={(favorites.data?.favorites ?? []).filter((v) => v?.id != null)}
          renderItem={renderVideo}
          adSeed={`user-${userId}-video-favorites-${page}`}
          empty={{
            icon: Star,
            title: "暂无收藏",
            description: ownText("你还没有收藏过任何视频", "该用户还没有收藏过任何视频"),
          }}
        />
      ),
    },
    {
      key: "liked",
      label: "喜欢",
      icon: ThumbsUp,
      count: likesCount,
      totalPages: liked.data?.totalPages,
      content: (
        <CardGrid
          isLoading={liked.isLoading}
          items={(liked.data?.videos ?? []).filter((v) => v?.id != null)}
          renderItem={renderVideo}
          adSeed={`user-${userId}-video-liked-${page}`}
          empty={{
            icon: ThumbsUp,
            title: "暂无喜欢",
            description: ownText("你还没有点赞过任何视频", "该用户还没有点赞过任何视频"),
          }}
        />
      ),
    },
  ];

  return (
    <ContentZone
      tabs={tabs}
      activeTab={tab}
      onTabChange={(key) => onTabChange(key as VideoTab)}
      page={page}
      onPageChange={onPageChange}
    />
  );
}
