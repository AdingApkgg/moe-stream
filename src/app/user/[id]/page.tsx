import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { UserPageClient } from "./client";
import { cache } from "react";
import { getPublicSiteConfig } from "@/lib/site-config";

interface UserPageProps {
  params: Promise<{ id: string }>;
}

// 使用 React cache 避免重复查询
const getUser = cache(async (id: string, includeEmail: boolean) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: includeEmail,
      nickname: true,
      avatar: true,
      bio: true,
      pronouns: true,
      location: true,
      website: true,
      socialLinks: true,
      lastIpLocation: true,
      createdAt: true,
      _count: {
        select: {
          videos: { where: { status: "PUBLISHED" } },
          likes: true,
          favorites: true,
          games: { where: { status: "PUBLISHED" } },
          gameFavorites: true,
          gameLikes: true,
          imagePosts: { where: { status: "PUBLISHED" } },
          imagePostLikes: true,
          imagePostFavorites: true,
        },
      },
    },
  });
});

// 动态生成 metadata
export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { id } = await params;

  // /user/0 → 重定向到当前用户，避免被搜索引擎索引
  if (id === "0") {
    return { title: "正在跳转...", robots: { index: false, follow: false } };
  }

  // metadata 中不需要 email
  const user = await getUser(id, false);

  if (!user) {
    return {
      title: "用户不存在",
      description: "该用户可能已被删除或不存在",
      robots: { index: false, follow: false },
    };
  }

  const displayName = user.nickname || user.username;
  const description = user.bio ? user.bio.slice(0, 160) : `${displayName} 的个人主页`;

  const siteConfig = await getPublicSiteConfig();
  const siteName = siteConfig.siteName;
  const baseUrl = siteConfig.siteUrl;

  return {
    title: displayName,
    description,
    openGraph: {
      type: "profile",
      title: `${displayName} - ${siteName}`,
      description,
      url: `${baseUrl}/user/${id}`,
      images: user.avatar
        ? [
            {
              url: user.avatar,
              width: 200,
              height: 200,
              alt: displayName,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary",
      title: `${displayName} - ${siteName}`,
      description,
      images: user.avatar ? [user.avatar] : undefined,
    },
  };
}

// 序列化用户数据
function serializeUser(user: NonNullable<Awaited<ReturnType<typeof getUser>>>, includeEmail: boolean) {
  return {
    id: user.id,
    username: user.username,
    email: includeEmail ? (user.email ?? null) : null,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio,
    pronouns: user.pronouns,
    location: user.location,
    website: user.website,
    socialLinks: user.socialLinks as Record<string, string> | null,
    lastIpLocation: user.lastIpLocation,
    createdAt: user.createdAt.toISOString(),
    _count: user._count,
  };
}

export type SerializedUser = ReturnType<typeof serializeUser>;

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;

  // /user/0 → 重定向到当前登录用户的主页
  if (id === "0") {
    const session = await getSession();
    if (session?.user?.id) {
      redirect(`/user/${session.user.id}`);
    } else {
      redirect("/login?callbackUrl=/user/0");
    }
  }

  // 先取 session，再据此决定是否查询 email 字段
  const session = await getSession();
  const isOwnProfile = session?.user?.id === id;

  const user = await getUser(id, isOwnProfile);

  if (!user) {
    notFound();
  }

  const initialUser = serializeUser(user, isOwnProfile);

  return <UserPageClient key={id} id={id} initialUser={initialUser} isOwnProfile={isOwnProfile} />;
}
