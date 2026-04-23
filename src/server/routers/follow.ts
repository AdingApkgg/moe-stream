import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { createNotification } from "@/lib/notification";

export const followRouter = router({
  follow: protectedProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    const followerId = ctx.session.user.id;
    if (followerId === input.userId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "不能关注自己" });
    }

    const target = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, nickname: true, username: true },
    });
    if (!target) {
      throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
    }

    const existing = await ctx.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: input.userId } },
    });
    if (existing) return { followed: true };

    await ctx.prisma.follow.create({
      data: { followerId, followingId: input.userId },
    });

    const followerUser = await ctx.prisma.user.findUnique({
      where: { id: followerId },
      select: { nickname: true, username: true },
    });

    await createNotification({
      userId: input.userId,
      type: "FOLLOW",
      title: "新粉丝",
      content: `${followerUser?.nickname || followerUser?.username || "某用户"} 关注了你`,
      data: { followerId },
    });

    return { followed: true };
  }),

  unfollow: protectedProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.follow.deleteMany({
      where: { followerId: ctx.session.user.id, followingId: input.userId },
    });
    return { followed: false };
  }),

  isFollowing: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    const follow = await ctx.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: ctx.session.user.id,
          followingId: input.userId,
        },
      },
    });
    return !!follow;
  }),

  followers: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId, cursor, limit } = input;
      const follows = await ctx.prisma.follow.findMany({
        where: { followingId: userId },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          follower: {
            select: { id: true, nickname: true, username: true, avatar: true, bio: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (follows.length > limit) {
        const next = follows.pop();
        nextCursor = next?.id;
      }

      return {
        users: follows.map((f) => f.follower),
        nextCursor,
      };
    }),

  following: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId, cursor, limit } = input;
      const follows = await ctx.prisma.follow.findMany({
        where: { followerId: userId },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          following: {
            select: { id: true, nickname: true, username: true, avatar: true, bio: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (follows.length > limit) {
        const next = follows.pop();
        nextCursor = next?.id;
      }

      return {
        users: follows.map((f) => f.following),
        nextCursor,
      };
    }),

  counts: publicProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
    const [followers, following] = await Promise.all([
      ctx.prisma.follow.count({ where: { followingId: input.userId } }),
      ctx.prisma.follow.count({ where: { followerId: input.userId } }),
    ]);
    return { followers, following };
  }),

  // 批量检查当前用户是否关注了一批用户
  batchIsFollowing: protectedProcedure
    .input(z.object({ userIds: z.array(z.string()).min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.follow.findMany({
        where: {
          followerId: ctx.session.user.id,
          followingId: { in: input.userIds },
        },
        select: { followingId: true },
      });
      const set = new Set(rows.map((r) => r.followingId));
      return Object.fromEntries(input.userIds.map((id) => [id, set.has(id)])) as Record<string, boolean>;
    }),

  // 互相关注的用户（当前用户与目标用户都互相关注对方，或指定用户的互关列表）
  mutual: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 用户 A 的关注 ∩ 用户 A 的粉丝
      const following = await ctx.prisma.follow.findMany({
        where: { followerId: input.userId },
        select: { followingId: true },
      });
      const followingIds = following.map((f) => f.followingId);
      if (followingIds.length === 0) {
        return { users: [], totalCount: 0, totalPages: 0, currentPage: input.page };
      }

      const mutualFollows = await ctx.prisma.follow.findMany({
        where: {
          followerId: { in: followingIds },
          followingId: input.userId,
        },
        select: { followerId: true },
      });
      const mutualIds = mutualFollows.map((f) => f.followerId);
      const totalCount = mutualIds.length;
      if (totalCount === 0) {
        return { users: [], totalCount: 0, totalPages: 0, currentPage: input.page };
      }

      const skip = (input.page - 1) * input.limit;
      const pageIds = mutualIds.slice(skip, skip + input.limit);

      const users = await ctx.prisma.user.findMany({
        where: { id: { in: pageIds } },
        select: { id: true, username: true, nickname: true, avatar: true, bio: true },
      });
      const byId = new Map(users.map((u) => [u.id, u] as const));
      const ordered = pageIds.map((id) => byId.get(id)).filter((u): u is (typeof users)[number] => Boolean(u));

      return {
        users: ordered,
        totalCount,
        totalPages: Math.ceil(totalCount / input.limit),
        currentPage: input.page,
      };
    }),

  // 推荐关注的用户
  // 策略：我关注的人所关注的人（2 度好友），过滤已关注 & 自己 & 封禁用户，按共同好友数排序
  suggestions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(10) }))
    .query(async ({ ctx, input }) => {
      const myId = ctx.session.user.id;

      const myFollows = await ctx.prisma.follow.findMany({
        where: { followerId: myId },
        select: { followingId: true },
      });
      const myFollowingIds = myFollows.map((f) => f.followingId);
      const excludeIds = new Set<string>([myId, ...myFollowingIds]);

      let candidateIds: string[] = [];

      if (myFollowingIds.length > 0) {
        // 二度好友
        const secondDegree = await ctx.prisma.follow.findMany({
          where: { followerId: { in: myFollowingIds }, followingId: { notIn: [...excludeIds] } },
          select: { followingId: true },
        });
        const counter = new Map<string, number>();
        for (const r of secondDegree) {
          counter.set(r.followingId, (counter.get(r.followingId) ?? 0) + 1);
        }
        candidateIds = [...counter.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, input.limit * 2)
          .map(([id]) => id);
      }

      // 候选不足时，用活跃用户补齐
      if (candidateIds.length < input.limit) {
        const fallback = await ctx.prisma.user.findMany({
          where: {
            id: { notIn: [...excludeIds, ...candidateIds] },
            isBanned: false,
          },
          select: { id: true },
          orderBy: { videos: { _count: "desc" } },
          take: input.limit - candidateIds.length,
        });
        candidateIds.push(...fallback.map((u) => u.id));
      }

      if (candidateIds.length === 0) return [];

      const users = await ctx.prisma.user.findMany({
        where: { id: { in: candidateIds }, isBanned: false },
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          bio: true,
          _count: { select: { followers: true, videos: true } },
        },
      });
      const byId = new Map(users.map((u) => [u.id, u] as const));
      return candidateIds
        .map((id) => byId.get(id))
        .filter((u): u is (typeof users)[number] => Boolean(u))
        .slice(0, input.limit);
    }),
});
