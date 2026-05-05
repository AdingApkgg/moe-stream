"use client";

import { Clock, Gamepad2, Star, ThumbsUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { GameCard, type GameCardData } from "@/components/game/game-card";
import { CardGrid } from "./card-grid";
import { ContentZone, type SubTabConfig } from "./content-zone";
import type { GameTab } from "../_lib/utils";

interface GameZoneProps {
  userId: string;
  isOwnProfile: boolean;
  uploadsCount: number;
  favoritesCount: number;
  likesCount: number;
  tab: GameTab;
  page: number;
  onTabChange: (tab: GameTab) => void;
  onPageChange: (page: number) => void;
}

export function GameZone({
  userId,
  isOwnProfile,
  uploadsCount,
  favoritesCount,
  likesCount,
  tab,
  page,
  onTabChange,
  onPageChange,
}: GameZoneProps) {
  const enabled = (target: GameTab) => tab === target;

  const uploads = trpc.user.getGames.useQuery({ userId, limit: 20, page }, { enabled: enabled("uploads") });
  const history = trpc.game.getUserHistory.useQuery({ userId, limit: 20, page }, { enabled: enabled("history") });
  const favorites = trpc.game.getUserFavorites.useQuery({ userId, limit: 20, page }, { enabled: enabled("favorites") });
  const liked = trpc.game.getUserLiked.useQuery({ userId, limit: 20, page }, { enabled: enabled("liked") });

  const renderGame = (game: GameCardData, index: number) => <GameCard key={game.id} game={game} index={index} />;
  const ownText = (own: string, other: string) => (isOwnProfile ? own : other);

  const tabs: SubTabConfig[] = [
    {
      key: "uploads",
      label: "作品",
      icon: Gamepad2,
      count: uploadsCount,
      totalPages: uploads.data?.totalPages,
      content: (
        <CardGrid
          isLoading={uploads.isLoading}
          items={((uploads.data?.games ?? []) as GameCardData[]).filter((g) => g?.id != null)}
          renderItem={renderGame}
          empty={{
            icon: Gamepad2,
            title: "暂无游戏作品",
            description: ownText("你还没有上传过游戏", "该用户还没有上传过游戏"),
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
          isLoading={history.isLoading}
          items={((history.data?.games ?? []) as GameCardData[]).filter((g) => g?.id != null)}
          renderItem={renderGame}
          empty={{
            icon: Clock,
            title: "暂无浏览记录",
            description: ownText("你还没有浏览过任何游戏", "该用户还没有浏览过任何游戏"),
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
          items={((favorites.data?.games ?? []) as GameCardData[]).filter((g) => g?.id != null)}
          renderItem={renderGame}
          empty={{
            icon: Star,
            title: "暂无收藏",
            description: ownText("你还没有收藏过任何游戏", "该用户还没有收藏过任何游戏"),
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
          items={((liked.data?.games ?? []) as GameCardData[]).filter((g) => g?.id != null)}
          renderItem={renderGame}
          empty={{
            icon: ThumbsUp,
            title: "暂无喜欢",
            description: ownText("你还没有点赞过任何游戏", "该用户还没有点赞过任何游戏"),
          }}
        />
      ),
    },
  ];

  return (
    <ContentZone
      tabs={tabs}
      activeTab={tab}
      onTabChange={(key) => onTabChange(key as GameTab)}
      page={page}
      onPageChange={onPageChange}
    />
  );
}
