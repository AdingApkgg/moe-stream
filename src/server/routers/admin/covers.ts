import { router, adminProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { processVideo, setCoverManually } from "@/lib/cover-auto";
import { addToQueueBatch, getCoverStats, resetCoverStats, getPermFailedVideos, clearPermFailed, getCoverLogs, clearCoverLogs } from "@/lib/cover-queue";

export const adminCoversRouter = router({
  // 重置视频封面：清除匹配模式的封面URL并触发自动生成
  resetCovers: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      // 匹配封面URL的模式，如 "/Picture/" 匹配合集封面
      urlPattern: z.string().min(1).max(200).optional(),
      // 指定合集ID，重置该合集下所有视频的封面
      seriesId: z.string().optional(),
      // 指定视频ID列表
      videoIds: z.array(z.string()).optional(),
      // 重置所有没有自动生成封面的视频（coverUrl 非空且不是本地路径）
      nonLocalOnly: z.boolean().optional(),
      // 仅重置本地生成的封面（coverUrl 以 /uploads/cover/ 开头）
      localOnly: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 构建查询条件
      const where: Prisma.VideoWhereInput = {
        coverUrl: { not: null },
      };

      if (input.videoIds && input.videoIds.length > 0) {
        where.id = { in: input.videoIds };
      } else if (input.seriesId) {
        where.seriesEpisodes = { some: { seriesId: input.seriesId } };
      }

      if (input.urlPattern) {
        where.coverUrl = { contains: input.urlPattern };
      } else if (input.localOnly) {
        where.coverUrl = { startsWith: "/uploads/cover/" };
      } else if (input.nonLocalOnly) {
        where.AND = [
          { coverUrl: { not: null } },
          { coverUrl: { not: "" } },
          { coverUrl: { not: { startsWith: "/uploads/cover/" } } },
        ];
      }

      const videos = await ctx.prisma.video.findMany({
        where,
        select: { id: true, coverUrl: true },
        take: 500,
      });

      if (videos.length === 0) {
        return { resetCount: 0, queuedCount: 0 };
      }

      await ctx.prisma.video.updateMany({
        where: { id: { in: videos.map((v) => v.id) } },
        data: { coverUrl: null, coverBlurHash: null },
      });

      // 批量入队自动生成
      const queuedCount = await addToQueueBatch(videos.map((v) => v.id));

      return {
        resetCount: videos.length,
        queuedCount,
      };
    }),

  // 获取封面生成统计和队列状态
  getCoverStats: adminProcedure.use(requireScope("video:manage")).query(async ({ ctx }) => {
    const published: Prisma.VideoWhereInput = { status: "PUBLISHED" };

    const [stats, total, withCover, localCover, withBlur, noCover, recentNoCover, permFailedIds] = await Promise.all([
      getCoverStats(),
      ctx.prisma.video.count({ where: published }),
      ctx.prisma.video.count({ where: { ...published, coverUrl: { not: null }, NOT: { coverUrl: "" } } }),
      ctx.prisma.video.count({ where: { ...published, coverUrl: { startsWith: "/uploads/cover/" } } }),
      ctx.prisma.video.count({ where: { ...published, coverBlurHash: { not: null } } }),
      ctx.prisma.video.count({ where: { ...published, OR: [{ coverUrl: null }, { coverUrl: "" }] } }),
      ctx.prisma.video.findMany({
        where: { ...published, OR: [{ coverUrl: null }, { coverUrl: "" }] },
        select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getPermFailedVideos(),
    ]);

    return {
      ...stats,
      db: {
        total,
        withCover,
        localCover,
        externalCover: withCover - localCover,
        withBlur,
        noCover,
        recentNoCover,
        permFailedIds,
      },
    };
  }),

  // 重置封面生成统计
  resetCoverStats: adminProcedure.use(requireScope("video:manage")).mutation(async () => {
    await resetCoverStats();
    return { success: true };
  }),

  // 获取封面生成日志
  getCoverLogs: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      limit: z.number().min(1).max(200).default(100),
    }).optional())
    .query(async ({ input }) => {
      const logs = await getCoverLogs(input?.limit ?? 100);
      return { logs };
    }),

  // 清除封面生成日志
  clearCoverLogs: adminProcedure.use(requireScope("video:manage")).mutation(async () => {
    await clearCoverLogs();
    return { success: true };
  }),

  // 清除永久失败标记，允许重新尝试生成封面
  clearPermFailed: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      videoIds: z.array(z.string()).optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const cleared = await clearPermFailed(input?.videoIds);
      return { cleared };
    }),

  // 手动触发补全缺失封面的视频
  triggerCoverBackfill: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      limit: z.number().min(1).max(500).default(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const videos = await ctx.prisma.video.findMany({
        where: {
          status: "PUBLISHED",
          OR: [{ coverUrl: null }, { coverUrl: "" }],
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: input.limit,
      });

      if (videos.length === 0) {
        return { found: 0, queued: 0 };
      }

      const queued = await addToQueueBatch(videos.map((v) => v.id));
      return { found: videos.length, queued };
    }),

  // 为指定视频重新生成封面
  regenerateCovers: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      videoIds: z.array(z.string()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      // 清除旧封面URL，触发重新生成
      await ctx.prisma.video.updateMany({
        where: { id: { in: input.videoIds } },
        data: { coverUrl: null, coverBlurHash: null },
      });

      const queued = await addToQueueBatch(input.videoIds);
      return { resetCount: input.videoIds.length, queued };
    }),

  // 立即生成封面（同步执行，不经过队列）
  generateCoverNow: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      videoId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 先清除旧数据
      await ctx.prisma.video.update({
        where: { id: input.videoId },
        data: { coverUrl: null, coverBlurHash: null },
      });

      const startTime = Date.now();
      const ok = await processVideo(input.videoId);
      const elapsed = Date.now() - startTime;

      if (!ok) {
        const video = await ctx.prisma.video.findUnique({
          where: { id: input.videoId },
          select: { videoUrl: true },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `封面生成失败 (${elapsed}ms)，视频 URL: ${video?.videoUrl?.slice(0, 80) ?? "未知"}。请查看生成日志了解详情。`,
        });
      }

      const video = await ctx.prisma.video.findUnique({
        where: { id: input.videoId },
        select: { coverUrl: true },
      });

      return { success: true, elapsed, coverUrl: video?.coverUrl };
    }),

  // 手动上传封面（base64 图片数据）
  uploadCover: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      videoId: z.string(),
      imageBase64: z.string().max(10 * 1024 * 1024),
    }))
    .mutation(async ({ ctx, input }) => {
      const video = await ctx.prisma.video.findUnique({
        where: { id: input.videoId },
        select: { id: true },
      });
      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND", message: "视频不存在" });
      }

      const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      if (imageBuffer.length < 100) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "图片数据无效" });
      }

      const result = await setCoverManually(input.videoId, imageBuffer);
      return { success: true, coverUrl: result.coverUrl };
    }),

});
