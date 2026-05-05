"use client";

import { Gamepad2, Images, LayoutGrid, Play } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { MotionPage } from "@/components/motion";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";
import type { SerializedUser } from "./page";
import type { GameTab, ImageTab, VideoTab, Zone } from "./_lib/utils";
import { useZoneState } from "./_hooks/use-zone-state";
import { UserHeader } from "./_components/user-header";
import { OverviewZone } from "./_components/overview-zone";
import { VideoZone } from "./_components/video-zone";
import { ImageZone } from "./_components/image-zone";
import { GameZone } from "./_components/game-zone";

const ZONES: { key: Zone; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "综合", icon: LayoutGrid },
  { key: "video", label: "视频", icon: Play },
  { key: "image", label: "图片", icon: Images },
  { key: "game", label: "游戏", icon: Gamepad2 },
];

interface UserPageClientProps {
  id: string;
  initialUser: SerializedUser;
  isOwnProfile: boolean;
}

export function UserPageClient({ id, initialUser, isOwnProfile: serverIsOwn }: UserPageClientProps) {
  const { data: session, status } = useSession();
  const { play } = useSound();

  const { zone, tab, page, setZone, setTab, setPage } = useZoneState();

  const clientIsOwn = status === "authenticated" && session?.user?.id === id;
  const isOwnProfile = status === "loading" ? serverIsOwn : clientIsOwn;

  const displayUser = initialUser;

  const switchToZone = (next: Zone) => {
    setZone(next);
    play("navigate");
  };

  return (
    <div className="container py-6">
      <MotionPage>
        <UserHeader user={displayUser} isOwnProfile={isOwnProfile} />

        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-none">
          {ZONES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchToZone(key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-[color,background-color,box-shadow] duration-200 ease-out whitespace-nowrap",
                zone === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div
          key={zone}
          className="animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-both"
          style={{ animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {zone === "all" && (
            <OverviewZone
              userId={id}
              videosCount={displayUser._count.videos}
              imagePostsCount={displayUser._count.imagePosts}
              gamesCount={displayUser._count.games}
              onSwitchZone={switchToZone}
            />
          )}
          {zone === "video" && (
            <VideoZone
              userId={id}
              isOwnProfile={isOwnProfile}
              uploadsCount={displayUser._count.videos}
              favoritesCount={displayUser._count.favorites}
              likesCount={displayUser._count.likes}
              tab={tab as VideoTab}
              page={page}
              onTabChange={setTab}
              onPageChange={setPage}
            />
          )}
          {zone === "image" && (
            <ImageZone
              userId={id}
              isOwnProfile={isOwnProfile}
              postsCount={displayUser._count.imagePosts}
              favoritesCount={displayUser._count.imagePostFavorites}
              likesCount={displayUser._count.imagePostLikes}
              tab={tab as ImageTab}
              page={page}
              onTabChange={setTab}
              onPageChange={setPage}
            />
          )}
          {zone === "game" && (
            <GameZone
              userId={id}
              isOwnProfile={isOwnProfile}
              uploadsCount={displayUser._count.games}
              favoritesCount={displayUser._count.gameFavorites}
              likesCount={displayUser._count.gameLikes}
              tab={tab as GameTab}
              page={page}
              onTabChange={setTab}
              onPageChange={setPage}
            />
          )}
        </div>
      </MotionPage>
    </div>
  );
}
