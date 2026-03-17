import { router, adminProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const adminSeriesRouter = router({
  // ==================== 合集管理 ====================

  getSeriesStats: adminProcedure.use(requireScope("video:moderate")).query(async ({ ctx }) => {
    const [total, totalEpisodes] = await Promise.all([
      ctx.prisma.series.count(),
      ctx.prisma.seriesEpisode.count(),
    ]);

    return { total, totalEpisodes };
  }),

  listAllSeries: adminProcedure
    .use(requireScope("video:moderate"))
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, search } = input;

      const where: Prisma.SeriesWhereInput = {};
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [series, totalCount] = await Promise.all([
        ctx.prisma.series.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            creator: {
              select: { id: true, username: true, nickname: true, avatar: true },
            },
            _count: { select: { episodes: true } },
            episodes: {
              take: 1,
              orderBy: { episodeNum: "asc" },
              include: {
                video: {
                  select: { id: true, coverUrl: true, title: true },
                },
              },
            },
          },
        }),
        ctx.prisma.series.count({ where }),
      ]);

      return {
        series,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),

  getSeriesDetail: adminProcedure
    .use(requireScope("video:moderate"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const series = await ctx.prisma.series.findUnique({
        where: { id: input.id },
        include: {
          creator: {
            select: { id: true, username: true, nickname: true, avatar: true },
          },
          episodes: {
            orderBy: { episodeNum: "asc" },
            include: {
              video: {
                select: {
                  id: true,
                  title: true,
                  coverUrl: true,
                  videoUrl: true,
                  duration: true,
                  views: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!series) {
        throw new TRPCError({ code: "NOT_FOUND", message: "合集不存在" });
      }

      return series;
    }),

  adminUpdateSeries: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(100).optional(),
      description: z.string().max(2000).optional().nullable(),
      coverUrl: z.string().optional().nullable(),
      downloadUrl: z.string().optional().nullable(),
      downloadNote: z.string().max(1000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const series = await ctx.prisma.series.findUnique({
        where: { id: input.id },
      });

      if (!series) {
        throw new TRPCError({ code: "NOT_FOUND", message: "合集不存在" });
      }

      const { id, ...data } = input;
      const updateData: Prisma.SeriesUpdateInput = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.coverUrl !== undefined) updateData.coverUrl = data.coverUrl || null;
      if (data.downloadUrl !== undefined) updateData.downloadUrl = data.downloadUrl || null;
      if (data.downloadNote !== undefined) updateData.downloadNote = data.downloadNote;

      return ctx.prisma.series.update({
        where: { id },
        data: updateData,
      });
    }),

  adminDeleteSeries: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({ seriesId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const series = await ctx.prisma.series.findUnique({
        where: { id: input.seriesId },
      });

      if (!series) {
        throw new TRPCError({ code: "NOT_FOUND", message: "合集不存在" });
      }

      await ctx.prisma.series.delete({
        where: { id: input.seriesId },
      });

      return { success: true };
    }),

  adminRemoveEpisode: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      seriesId: z.string(),
      videoId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.seriesEpisode.delete({
        where: {
          seriesId_videoId: {
            seriesId: input.seriesId,
            videoId: input.videoId,
          },
        },
      });

      return { success: true };
    }),

  adminBatchDeleteSeries: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({
      seriesIds: z.array(z.string()).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.series.deleteMany({
        where: { id: { in: input.seriesIds } },
      });

      return { success: true, count: result.count };
    }),

});
