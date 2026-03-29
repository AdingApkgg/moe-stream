import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { getIpLocation } from "@/lib/ip-location";
import { parseDeviceInfo, type DeviceInfo } from "@/lib/device-info";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex = /^https?:\/\/.+/;

export const guestbookRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;

      const messages = await ctx.prisma.guestbookMessage.findMany({
        where: { isDeleted: false, isHidden: false },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatar: true,
              role: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return { messages, nextCursor };
    }),

  create: publicProcedure
    .input(
      z.object({
        content: z.string().min(1).max(500),
        guestName: z.string().min(1).max(50).optional(),
        guestEmail: z
          .string()
          .refine((val) => !val || emailRegex.test(val), {
            message: "邮箱格式不正确",
          })
          .optional(),
        guestWebsite: z
          .string()
          .refine((val) => !val || urlRegex.test(val), {
            message: "网址格式不正确",
          })
          .optional(),
        deviceInfo: z
          .object({
            deviceType: z.string().nullable().optional(),
            os: z.string().nullable().optional(),
            osVersion: z.string().nullable().optional(),
            browser: z.string().nullable().optional(),
            browserVersion: z.string().nullable().optional(),
            brand: z.string().nullable().optional(),
            model: z.string().nullable().optional(),
            platform: z.string().nullable().optional(),
            language: z.string().nullable().optional(),
            timezone: z.string().nullable().optional(),
            screen: z.string().nullable().optional(),
            pixelRatio: z.number().nullable().optional(),
            userAgent: z.string().nullable().optional(),
            fingerprint: z.string().optional(),
            visitorId: z.string().nullable().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { content, guestName, guestEmail, guestWebsite, deviceInfo } = input;
      const userId = ctx.session?.user?.id;

      if (!userId && !guestName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "请填写昵称",
        });
      }

      const visitorId = deviceInfo?.visitorId;
      if (!userId && visitorId) {
        const { redisExists } = await import("@/lib/redis");
        const rateKey = `guestbook_rate:vid:${visitorId}`;
        const exists = await redisExists(rateKey);
        if (exists) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "留言太频繁，请稍后再试",
          });
        }
      }

      const [ipv4Location, ipv6Location] = await Promise.all([
        getIpLocation(ctx.ipv4Address),
        getIpLocation(ctx.ipv6Address),
      ]);

      let normalizedDeviceInfo: DeviceInfo;
      if (deviceInfo && deviceInfo.os && deviceInfo.osVersion) {
        normalizedDeviceInfo = {
          deviceType: deviceInfo.deviceType || "desktop",
          os: deviceInfo.os,
          osVersion: deviceInfo.osVersion,
          browser: deviceInfo.browser || null,
          browserVersion: deviceInfo.browserVersion || null,
          brand: deviceInfo.brand || null,
          model: deviceInfo.model || null,
          platform: deviceInfo.platform || null,
          language: deviceInfo.language || null,
          timezone: deviceInfo.timezone || null,
          screen: deviceInfo.screen || null,
          pixelRatio: deviceInfo.pixelRatio || null,
          userAgent: deviceInfo.userAgent || ctx.userAgent || null,
          fingerprint: deviceInfo.fingerprint || "unknown",
          visitorId: visitorId || null,
        };
      } else {
        normalizedDeviceInfo = parseDeviceInfo(ctx.userAgent, deviceInfo);
      }

      const message = await ctx.prisma.guestbookMessage.create({
        data: {
          content,
          userId: userId || null,
          guestName: userId ? null : guestName,
          guestEmail: userId ? null : guestEmail,
          guestWebsite: userId ? null : guestWebsite,
          ipv4Address: ctx.ipv4Address,
          ipv4Location,
          ipv6Address: ctx.ipv6Address,
          ipv6Location,
          deviceInfo: normalizedDeviceInfo as unknown as Prisma.InputJsonValue,
          userAgent: ctx.userAgent,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              avatar: true,
              role: true,
            },
          },
        },
      });

      if (!userId && visitorId) {
        const { redisSetEx } = await import("@/lib/redis");
        await redisSetEx(`guestbook_rate:vid:${visitorId}`, "1", 60);
      }

      return message;
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const userRole = ctx.session.user.role;

    const message = await ctx.prisma.guestbookMessage.findUnique({
      where: { id: input.id },
      select: { userId: true, isDeleted: true },
    });

    if (!message || message.isDeleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "留言不存在",
      });
    }

    const isOwner = message.userId === userId;
    const isAdmin = userRole === "ADMIN" || userRole === "OWNER";

    if (!isOwner && !isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "无权删除此留言",
      });
    }

    await ctx.prisma.guestbookMessage.update({
      where: { id: input.id },
      data: { isDeleted: true },
    });

    return { success: true };
  }),
});
