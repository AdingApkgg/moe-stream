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
import { trpc } from "@/lib/trpc";
import { Users } from "lucide-react";
import { FollowButton } from "./follow-controls";
import { SocialLinks } from "./social-links";
import { StatItem } from "./stat-item";

interface UserHeaderProps {
  user: SerializedUser;
  isOwnProfile: boolean;
}

/**
 * Hero banner —— 大圆角、渐变背景、居中头像。
 * 参考 AIACG 设计稿（Figma node 16:2985）。
 * 上半：cover banner（高 ~240–280px、24 圆角、深色渐变蒙版）
 * 下半：详细信息条（bio、位置、社交链接），普通卡面
 */
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

  const hasMeta = Boolean(
    user.bio ||
      user.location ||
      (siteConfig?.showIpLocation !== false && user.lastIpLocation) ||
      website ||
      hasSocialLinks ||
      (isOwnProfile && user.email),
  );

  return (
    <div className="space-y-4 mb-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-500 shadow-md">
        {/* 装饰星点（轻量化，避免太花） */}
        <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_30%,_rgba(255,255,255,0.4)_0,_transparent_50%),radial-gradient(circle_at_80%_70%,_rgba(255,255,255,0.3)_0,_transparent_50%)]" />
        {/* 顶部到底部的暗化渐变，保证白字可读 */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/30" />

        {/* 右上角操作按钮 */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {isOwnProfile ? (
            <Button
              asChild
              size="sm"
              className="gap-1.5 rounded-xl bg-white text-foreground hover:bg-white/90 shadow-sm"
            >
              <Link href="/settings">
                <Settings className="h-3.5 w-3.5" />
                编辑资料
              </Link>
            </Button>
          ) : (
            <FollowButton userId={user.id} />
          )}
        </div>

        {/* 主体内容：居中头像 + 名字 + 关注/粉丝徽章 */}
        <div className="relative z-[5] px-6 sm:px-10 py-10 sm:py-12 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 ring-4 ring-white/90 shadow-xl">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="text-2xl bg-white/95 text-primary">
              {(user.nickname || user.username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h1 className="mt-4 text-2xl sm:text-3xl font-semibold text-white drop-shadow-sm flex items-center gap-3 flex-wrap justify-center">
            {user.nickname || user.username}
            {user.pronouns && (
              <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30">
                {user.pronouns}
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-white/75">@{user.username}</p>

          {/* 关注 / 粉丝 黑色半透明药丸 */}
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            <HeroFollowPills userId={user.id} />
          </div>
        </div>
      </div>

      {/* 数据条：视频/图片/游戏/获赞/收藏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatItem icon={Video} label="视频" value={user._count.videos} />
        <StatItem icon={Images} label="图片" value={user._count.imagePosts} />
        <StatItem icon={Gamepad2} label="游戏" value={user._count.games} />
        <StatItem icon={Heart} label="获赞" value={totalLikes} />
        <StatItem icon={Star} label="收藏" value={totalFavorites} />
      </div>

      {/* 详细信息卡（仅在有内容时显示） */}
      {hasMeta && (
        <div className="rounded-2xl bg-card border p-5 sm:p-6 space-y-3">
          {user.bio && <p className="text-sm text-foreground/85 leading-relaxed">{user.bio}</p>}

          <div className="flex items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground flex-wrap">
            {isOwnProfile && user.email && (
              <a href={`mailto:${user.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </a>
            )}
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
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <SocialLinks socialLinks={user.socialLinks as Record<string, string>} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Hero banner 内的关注/粉丝徽章——黑色半透明药丸（参考 Figma 16:2985） */
function HeroFollowPills({ userId }: { userId: string }) {
  const { data: counts } = trpc.follow.counts.useQuery({ userId });
  if (!counts) return null;
  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/95">
        <Users className="h-3 w-3" />
        粉丝 <span className="tabular-nums">{counts.followers.toLocaleString()}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/95">
        <Heart className="h-3 w-3" />
        关注 <span className="tabular-nums">{counts.following.toLocaleString()}</span>
      </span>
    </>
  );
}
