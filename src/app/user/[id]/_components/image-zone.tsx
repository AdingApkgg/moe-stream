"use client";

import { Clock, Images, Star, ThumbsUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ImagePostCard } from "@/components/image/image-post-card";
import { CardGrid } from "./card-grid";
import { ContentZone, type SubTabConfig } from "./content-zone";
import type { ImageTab } from "../_lib/utils";

interface ImageZoneProps {
  userId: string;
  isOwnProfile: boolean;
  postsCount: number;
  favoritesCount: number;
  likesCount: number;
  tab: ImageTab;
  page: number;
  onTabChange: (tab: ImageTab) => void;
  onPageChange: (page: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImagePost = any;

export function ImageZone({
  userId,
  isOwnProfile,
  postsCount,
  favoritesCount,
  likesCount,
  tab,
  page,
  onTabChange,
  onPageChange,
}: ImageZoneProps) {
  const enabled = (target: ImageTab) => tab === target;

  const posts = trpc.image.getUserPosts.useQuery({ userId, limit: 20, page }, { enabled: enabled("posts") });
  const history = trpc.image.getUserHistory.useQuery({ userId, limit: 20, page }, { enabled: enabled("history") });
  const favorites = trpc.image.getUserFavorites.useQuery(
    { userId, limit: 20, page },
    { enabled: enabled("favorites") },
  );
  const liked = trpc.image.getUserLiked.useQuery({ userId, limit: 20, page }, { enabled: enabled("liked") });

  const renderImagePost = (post: ImagePost, index: number) => <ImagePostCard key={post.id} post={post} index={index} />;
  const ownText = (own: string, other: string) => (isOwnProfile ? own : other);

  const tabs: SubTabConfig[] = [
    {
      key: "posts",
      label: "作品",
      icon: Images,
      count: postsCount,
      totalPages: posts.data?.totalPages,
      content: (
        <CardGrid
          aspect="square"
          isLoading={posts.isLoading}
          items={(posts.data?.posts ?? []).filter((p) => p?.id != null)}
          renderItem={renderImagePost}
          adSeed={`user-${userId}-image-posts-${page}`}
          empty={{
            icon: Images,
            title: "暂无作品",
            description: ownText("你还没有发布过图片", "该用户还没有发布过图片"),
          }}
        />
      ),
    },
    {
      key: "history",
      label: "浏览记录",
      icon: Clock,
      totalPages: history.data?.totalPages,
      content: (
        <CardGrid
          aspect="square"
          isLoading={history.isLoading}
          items={(history.data?.posts ?? []).filter((p) => p?.id != null)}
          renderItem={renderImagePost}
          adSeed={`user-${userId}-image-history-${page}`}
          empty={{
            icon: Clock,
            title: "暂无浏览记录",
            description: ownText("你还没有浏览过任何图片", "该用户还没有浏览过任何图片"),
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
          aspect="square"
          isLoading={favorites.isLoading}
          items={(favorites.data?.posts ?? []).filter((p) => p?.id != null)}
          renderItem={renderImagePost}
          adSeed={`user-${userId}-image-favorites-${page}`}
          empty={{
            icon: Star,
            title: "暂无收藏",
            description: ownText("你还没有收藏过任何图片", "该用户还没有收藏过任何图片"),
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
          aspect="square"
          isLoading={liked.isLoading}
          items={(liked.data?.posts ?? []).filter((p) => p?.id != null)}
          renderItem={renderImagePost}
          adSeed={`user-${userId}-image-liked-${page}`}
          empty={{
            icon: ThumbsUp,
            title: "暂无喜欢",
            description: ownText("你还没有点赞过任何图片", "该用户还没有点赞过任何图片"),
          }}
        />
      ),
    },
  ];

  return (
    <ContentZone
      tabs={tabs}
      activeTab={tab}
      onTabChange={(key) => onTabChange(key as ImageTab)}
      page={page}
      onPageChange={onPageChange}
    />
  );
}
