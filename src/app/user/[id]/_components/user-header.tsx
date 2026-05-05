"use client";

import Link from "next/link";
import {
  Calendar,
  ExternalLink,
  Gamepad2,
  Globe,
  Heart,
  Images,
  Mail,
  MapPin,
  Settings,
  Star,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/contexts/site-config";
import { formatRelativeTime } from "@/lib/format";
import type { SerializedUser } from "../page";
import { parseWebsite } from "../_lib/utils";
import { FollowButton, FollowCounts } from "./follow-controls";
import { SocialLinks } from "./social-links";
import { StatItem } from "./stat-item";

interface UserHeaderProps {
  user: SerializedUser;
  isOwnProfile: boolean;
}

export function UserHeader({ user, isOwnProfile }: UserHeaderProps) {
  const siteConfig = useSiteConfig();
  const totalLikes = user._count.likes + user._count.gameLikes + user._count.imagePostLikes;
  const totalFavorites = user._count.favorites + user._count.gameFavorites + user._count.imagePostFavorites;

  const website = user.website ? parseWebsite(user.website) : null;
  const hasSocialLinks =
    user.socialLinks &&
    typeof user.socialLinks === "object" &&
    !Array.isArray(user.socialLinks) &&
    Object.values(user.socialLinks).some((v) => v);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/8 to-accent/5 border p-6 sm:p-8 mb-6">
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
          <AvatarImage src={user.avatar || undefined} />
          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
            {(user.nickname || user.username).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold">{user.nickname || user.username}</h1>
                {user.pronouns && (
                  <Badge variant="secondary" className="text-xs">
                    {user.pronouns}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
            {isOwnProfile ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                <Link href="/settings">
                  <Settings className="h-3.5 w-3.5" />
                  编辑资料
                </Link>
              </Button>
            ) : (
              <FollowButton userId={user.id} />
            )}
          </div>

          {isOwnProfile && user.email && (
            <a
              href={`mailto:${user.email}`}
              className="text-sm text-muted-foreground flex items-center gap-1 mt-1.5 hover:text-primary transition-colors w-fit"
            >
              <Mail className="h-3 w-3" />
              {user.email}
            </a>
          )}

          {user.bio && <p className="mt-3 text-sm text-foreground/80 max-w-lg leading-relaxed">{user.bio}</p>}

          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
            {user.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {user.location}
              </span>
            )}
            {siteConfig?.showIpLocation !== false && user.lastIpLocation && (
              <span className="flex items-center gap-1" title="基于 IP 地址的大致位置">
                <Globe className="h-3.5 w-3.5" />
                IP 属地：{user.lastIpLocation}
              </span>
            )}
            {website && (
              <a
                href={website.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                {website.hostname}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatRelativeTime(user.createdAt)} 加入
            </span>
          </div>

          {hasSocialLinks && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <SocialLinks socialLinks={user.socialLinks as Record<string, string>} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-5 pt-5 border-t border-border/50 flex-wrap">
        <FollowCounts userId={user.id} />
        <StatItem icon={Video} label="视频" value={user._count.videos} />
        <StatItem icon={Images} label="图片" value={user._count.imagePosts} />
        <StatItem icon={Gamepad2} label="游戏" value={user._count.games} />
        <StatItem icon={Heart} label="获赞" value={totalLikes} />
        <StatItem icon={Star} label="收藏" value={totalFavorites} />
      </div>
    </div>
  );
}
