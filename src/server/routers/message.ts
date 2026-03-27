import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { type Prisma } from "@/generated/prisma/client";
import { socketEmitter } from "@/lib/socket-emitter";
import { createNotification } from "@/lib/notification";

export const messageRouter = router({
  conversations: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { cursor, limit } = input;

      const participations = await ctx.prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true, lastReadAt: true },
      });

      if (participations.length === 0) {
        return { conversations: [], nextCursor: undefined };
      }

      const convIds = participations.map((p) => p.conversationId);
      const lastReadMap = new Map(participations.map((p) => [p.conversationId, p.lastReadAt]));

      const conversations = await ctx.prisma.conversation.findMany({
        where: { id: { in: convIds } },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { updatedAt: "desc" },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, nickname: true, username: true, avatar: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            where: { isDeleted: false },
          },
        },
      });

      let nextCursor: string | undefined;
      if (conversations.length > limit) {
        const next = conversations.pop();
        nextCursor = next?.id;
      }

      const result = await Promise.all(
        conversations.map(async (conv) => {
          const lastRead = lastReadMap.get(conv.id);
          const unreadCount = lastRead
            ? await ctx.prisma.directMessage.count({
                where: {
                  conversationId: conv.id,
                  createdAt: { gt: lastRead },
                  senderId: { not: userId },
                  isDeleted: false,
                },
              })
            : await ctx.prisma.directMessage.count({
                where: {
                  conversationId: conv.id,
                  senderId: { not: userId },
                  isDeleted: false,
                },
              });

          const otherParticipant = conv.participants.find((p) => p.userId !== userId);

          return {
            id: conv.id,
            updatedAt: conv.updatedAt,
            lastMessage: conv.messages[0] || null,
            otherUser: otherParticipant?.user || null,
            unreadCount,
          };
        }),
      );

      return { conversations: result, nextCursor };
    }),

  conversationInfo: protectedProcedure.input(z.object({ conversationId: z.string() })).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const participant = await ctx.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: input.conversationId, userId },
      },
    });
    if (!participant) {
      throw new TRPCError({ code: "FORBIDDEN", message: "你不是该会话的参与者" });
    }

    const conversation = await ctx.prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, nickname: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "会话不存在" });
    }

    const otherParticipant = conversation.participants.find((p) => p.userId !== userId);

    return {
      id: conversation.id,
      otherUser: otherParticipant?.user || null,
    };
  }),

  getOrCreate: protectedProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    const myId = ctx.session.user.id;
    if (myId === input.userId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "不能与自己对话" });
    }

    const target = await ctx.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!target) {
      throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
    }

    const existing = await ctx.prisma.conversation.findFirst({
      where: {
        AND: [{ participants: { some: { userId: myId } } }, { participants: { some: { userId: input.userId } } }],
      },
      select: { id: true },
    });

    if (existing) return { conversationId: existing.id };

    const conversation = await ctx.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: myId }, { userId: input.userId }],
        },
      },
    });

    return { conversationId: conversation.id };
  }),

  messages: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { conversationId, cursor, limit } = input;

      const participant = await ctx.prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
      if (!participant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "你不是该会话的参与者" });
      }

      const messages = await ctx.prisma.directMessage.findMany({
        where: { conversationId, isDeleted: false },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: { id: true, nickname: true, username: true, avatar: true },
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
        conversationId: z.string(),
        content: z.string().optional(),
        type: z.enum(["TEXT", "IMAGE", "FILE", "STICKER"]).default("TEXT"),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const participant = await ctx.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId: input.conversationId, userId },
        },
      });
      if (!participant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "你不是该会话的参与者" });
      }

      if (input.type === "TEXT" && (!input.content || !input.content.trim())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "消息不能为空" });
      }

      const message = await ctx.prisma.directMessage.create({
        data: {
          conversationId: input.conversationId,
          senderId: userId,
          content: input.content,
          type: input.type,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
        include: {
          sender: {
            select: { id: true, nickname: true, username: true, avatar: true },
          },
        },
      });

      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      await ctx.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: { conversationId: input.conversationId, userId },
        },
        data: { lastReadAt: new Date() },
      });

      socketEmitter.to(`conversation:${input.conversationId}`).emit("message:new", message);

      const otherParticipants = await ctx.prisma.conversationParticipant.findMany({
        where: { conversationId: input.conversationId, userId: { not: userId } },
        select: { userId: true },
      });

      const senderUser = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { nickname: true, username: true },
      });
      const senderName = senderUser?.nickname || senderUser?.username || "某用户";
      for (const p of otherParticipants) {
        socketEmitter.to(`user:${p.userId}`).emit("message:unread", { conversationId: input.conversationId });

        await createNotification({
          userId: p.userId,
          type: "NEW_MESSAGE",
          title: "新私信",
          content:
            input.type === "TEXT"
              ? `${senderName}: ${(input.content || "").slice(0, 50)}`
              : `${senderName} 发送了${input.type === "IMAGE" ? "一张图片" : input.type === "FILE" ? "一个文件" : "一个贴图"}`,
          data: { conversationId: input.conversationId, senderId: userId },
        });
      }

      return message;
    }),

  markRead: protectedProcedure.input(z.object({ conversationId: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    await ctx.prisma.conversationParticipant.updateMany({
      where: { conversationId: input.conversationId, userId },
      data: { lastReadAt: new Date() },
    });

    socketEmitter
      .to(`conversation:${input.conversationId}`)
      .emit("message:read", { conversationId: input.conversationId, userId });

    return { success: true };
  }),

  deleteMessage: protectedProcedure.input(z.object({ messageId: z.string() })).mutation(async ({ ctx, input }) => {
    const message = await ctx.prisma.directMessage.findUnique({
      where: { id: input.messageId },
      select: { senderId: true, conversationId: true },
    });

    if (!message || message.senderId !== ctx.session.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己的消息" });
    }

    await ctx.prisma.directMessage.update({
      where: { id: input.messageId },
      data: { isDeleted: true },
    });

    socketEmitter.to(`conversation:${message.conversationId}`).emit("message:deleted", { messageId: input.messageId });

    return { success: true };
  }),
});
