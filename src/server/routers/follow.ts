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
});
