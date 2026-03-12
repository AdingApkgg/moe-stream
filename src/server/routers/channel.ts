import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { type Prisma } from "@/generated/prisma/client";
import { socketEmitter } from "@/lib/socket-emitter";

export const channelRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      const { cursor, limit } = input;

      const where = userId
        ? {
            OR: [
              { type: "PUBLIC" as const },
              { members: { some: { userId } } },
            ],
          }
        : { type: "PUBLIC" as const };

      const channels = await ctx.prisma.channel.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { members: true, messages: true } },
          creator: {
            select: { id: true, nickname: true, username: true, avatar: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (channels.length > limit) {
        const next = channels.pop();
        nextCursor = next?.id;
      }

      return { channels, nextCursor };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.findUnique({
        where: { slug: input.slug },
        include: {
          _count: { select: { members: true, messages: true } },
          creator: {
            select: { id: true, nickname: true, username: true, avatar: true },
          },
        },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "频道不存在" });
      }

      if (channel.type === "PRIVATE") {
        const userId = ctx.session?.user?.id;
        if (!userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "私有频道需要登录" });
        }
        const membership = await ctx.prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId: channel.id, userId } },
        });
        if (!membership) {
          throw new TRPCError({ code: "FORBIDDEN", message: "你不是该频道的成员" });
        }
      }

      return channel;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
        description: z.string().max(500).optional(),
        type: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existing = await ctx.prisma.channel.findUnique({
        where: { slug: input.slug },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "频道标识已被使用" });
      }

      const channel = await ctx.prisma.channel.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          type: input.type,
          creatorId: userId,
          members: {
            create: { userId, role: "OWNER" },
          },
        },
      });

      return channel;
    }),

  update: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(500).optional(),
        avatarUrl: z.string().optional(),
        type: z.enum(["PUBLIC", "PRIVATE"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const membership = await ctx.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId, userId } },
      });

      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "需要管理员权限" });
      }

      const { channelId, ...data } = input;
      return ctx.prisma.channel.update({ where: { id: channelId }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { creatorId: true },
      });

      if (!channel || channel.creatorId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只有创建者可以删除频道" });
      }

      await ctx.prisma.channel.delete({ where: { id: input.channelId } });
      return { success: true };
    }),

  join: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const channel = await ctx.prisma.channel.findUnique({
        where: { id: input.channelId },
        select: { type: true },
      });
      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "频道不存在" });
      }
      if (channel.type === "PRIVATE") {
        throw new TRPCError({ code: "FORBIDDEN", message: "私有频道需要邀请加入" });
      }

      const existing = await ctx.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId, userId } },
      });
      if (existing) return { joined: true };

      await ctx.prisma.channelMember.create({
        data: { channelId: input.channelId, userId },
      });

      socketEmitter
        .to(`channel:${input.channelId}`)
        .emit("channel:member:join", { channelId: input.channelId, userId });

      return { joined: true };
    }),

  leave: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const membership = await ctx.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId, userId } },
      });
      if (!membership) return { left: true };
      if (membership.role === "OWNER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "频道创建者不能退出频道" });
      }

      await ctx.prisma.channelMember.delete({
        where: { channelId_userId: { channelId: input.channelId, userId } },
      });

      socketEmitter
        .to(`channel:${input.channelId}`)
        .emit("channel:member:leave", { channelId: input.channelId, userId });

      return { left: true };
    }),

  isMember: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const membership = await ctx.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId, userId } },
        select: { id: true, role: true },
      });
      return { isMember: !!membership, role: membership?.role ?? null };
    }),

  members: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { channelId, cursor, limit } = input;
      const members = await ctx.prisma.channelMember.findMany({
        where: { channelId },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: {
          user: {
            select: { id: true, nickname: true, username: true, avatar: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (members.length > limit) {
        const next = members.pop();
        nextCursor = next?.id;
      }

      return { members, nextCursor };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const myMembership = await ctx.prisma.channelMember.findUnique({
        where: {
          channelId_userId: { channelId: input.channelId, userId: ctx.session.user.id },
        },
      });

      if (!myMembership || myMembership.role !== "OWNER") {
        throw new TRPCError({ code: "FORBIDDEN", message: "只有频道创建者可以修改角色" });
      }

      await ctx.prisma.channelMember.update({
        where: {
          channelId_userId: { channelId: input.channelId, userId: input.userId },
        },
        data: { role: input.role },
      });

      return { success: true };
    }),

  messages: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { channelId, cursor, limit } = input;

      const channel = await ctx.prisma.channel.findUnique({
        where: { id: channelId },
        select: { type: true },
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND" });

      if (channel.type === "PRIVATE") {
        const userId = ctx.session?.user?.id;
        if (!userId) throw new TRPCError({ code: "FORBIDDEN" });
        const membership = await ctx.prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId, userId } },
        });
        if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
      }

      const messages = await ctx.prisma.channelMessage.findMany({
        where: { channelId, isDeleted: false },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: { id: true, nickname: true, username: true, avatar: true },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              sender: {
                select: { id: true, nickname: true, username: true },
              },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (messages.length > limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return { messages, nextCursor };
    }),

  send: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        content: z.string().optional(),
        type: z.enum(["TEXT", "IMAGE", "FILE", "STICKER"]).default("TEXT"),
        metadata: z.record(z.string(), z.unknown()).optional(),
        replyToId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const membership = await ctx.prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId, userId } },
      });
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "你不是该频道的成员" });
      }

      if (input.type === "TEXT" && (!input.content || !input.content.trim())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "消息不能为空" });
      }

      const message = await ctx.prisma.channelMessage.create({
        data: {
          channelId: input.channelId,
          senderId: userId,
          content: input.content,
          type: input.type,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          replyToId: input.replyToId,
        },
        include: {
          sender: {
            select: { id: true, nickname: true, username: true, avatar: true },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              sender: { select: { id: true, nickname: true, username: true } },
            },
          },
        },
      });

      await ctx.prisma.channel.update({
        where: { id: input.channelId },
        data: { updatedAt: new Date() },
      });

      await ctx.prisma.channelMember.update({
        where: { channelId_userId: { channelId: input.channelId, userId } },
        data: { lastReadAt: new Date() },
      });

      socketEmitter
        .to(`channel:${input.channelId}`)
        .emit("channel:message:new", message);

      return message;
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const message = await ctx.prisma.channelMessage.findUnique({
        where: { id: input.messageId },
        select: { senderId: true, channelId: true },
      });

      if (!message) throw new TRPCError({ code: "NOT_FOUND" });

      if (message.senderId !== userId) {
        const membership = await ctx.prisma.channelMember.findUnique({
          where: { channelId_userId: { channelId: message.channelId, userId } },
        });
        if (!membership || membership.role === "MEMBER") {
          throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己的消息" });
        }
      }

      await ctx.prisma.channelMessage.update({
        where: { id: input.messageId },
        data: { isDeleted: true },
      });

      socketEmitter
        .to(`channel:${message.channelId}`)
        .emit("channel:message:deleted", { messageId: input.messageId });

      return { success: true };
    }),

  markRead: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await ctx.prisma.channelMember.updateMany({
        where: { channelId: input.channelId, userId },
        data: { lastReadAt: new Date() },
      });
      return { success: true };
    }),
});
