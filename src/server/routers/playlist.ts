import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";

const videoPreviewInclude = {
  uploader: {
    select: { id: true, username: true, nickname: true, avatar: true },
  },
  tags: {
    include: { tag: { select: { id: true, name: true, slug: true } } },
  },
  _count: { select: { likes: true, dislikes: true, confused: true, comments: true, favorites: true } },
} as const;

export const playlistRouter = router({
  // 获取当前用户的播放列表
  listMine: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = { userId: ctx.session.user.id };
      const [playlists, totalCount] = await Promise.all([
        ctx.prisma.playlist.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { items: true } },
            items: {
              take: 1,
              orderBy: { sortOrder: "asc" },
              include: { video: { select: { id: true, coverUrl: true, title: true } } },
            },
          },
        }),
        ctx.prisma.playlist.count({ where }),
      ]);

      return {
        playlists: playlists.map((p) => ({
          ...p,
          cover: p.items[0]?.video.coverUrl ?? null,
          items: undefined,
        })),
        totalCount,
        totalPages: Math.ceil(totalCount / input.limit),
        currentPage: input.page,
      };
    }),

  // 获取指定用户的公开播放列表
  listByUser: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = { userId: input.userId, isPublic: true };
      const [playlists, totalCount] = await Promise.all([
        ctx.prisma.playlist.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { items: true } },
            items: {
              take: 1,
              orderBy: { sortOrder: "asc" },
              include: { video: { select: { id: true, coverUrl: true, title: true } } },
            },
          },
        }),
        ctx.prisma.playlist.count({ where }),
      ]);

      return {
        playlists: playlists.map((p) => ({
          ...p,
          cover: p.items[0]?.video.coverUrl ?? null,
          items: undefined,
        })),
        totalCount,
        totalPages: Math.ceil(totalCount / input.limit),
        currentPage: input.page,
      };
    }),

  // 获取播放列表详情（含所有视频）
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const playlist = await ctx.prisma.playlist.findUnique({
      where: { id: input.id },
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true } },
        items: {
          orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
          include: {
            video: {
              include: videoPreviewInclude,
            },
          },
        },
      },
    });

    if (!playlist) {
      throw new TRPCError({ code: "NOT_FOUND", message: "播放列表不存在" });
    }

    // 私有列表仅创建者可见
    const currentUserId = ctx.session?.user?.id;
    if (!playlist.isPublic && playlist.userId !== currentUserId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "该播放列表不公开" });
    }

    // 过滤未发布视频
    const items = playlist.items.filter((i) => i.video && i.video.status === "PUBLISHED");

    return {
      ...playlist,
      items,
      itemCount: items.length,
    };
  }),

  // 创建播放列表
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().default(true),
        videoIds: z.array(z.string()).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.create({
        data: {
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
          userId: ctx.session.user.id,
          ...(input.videoIds?.length
            ? {
                items: {
                  create: input.videoIds.map((videoId, index) => ({
                    videoId,
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
      });

      return playlist;
    }),

  // 更新播放列表基本信息
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        isPublic: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const playlist = await ctx.prisma.playlist.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
      if (playlist.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己的播放列表" });
      }

      return ctx.prisma.playlist.update({
        where: { id },
        data,
      });
    }),

  // 删除播放列表
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const playlist = await ctx.prisma.playlist.findUnique({
      where: { id: input.id },
      select: { userId: true },
    });
    if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
    if (playlist.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己的播放列表" });
    }

    await ctx.prisma.playlist.delete({ where: { id: input.id } });
    return { success: true };
  }),

  // 向播放列表追加视频（去重，附加到末尾）
  addVideos: protectedProcedure
    .input(
      z.object({
        playlistId: z.string(),
        videoIds: z.array(z.string()).min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findUnique({
        where: { id: input.playlistId },
        select: { userId: true, _count: { select: { items: true } } },
      });
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
      if (playlist.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己的播放列表" });
      }

      const existingItems = await ctx.prisma.playlistItem.findMany({
        where: { playlistId: input.playlistId, videoId: { in: input.videoIds } },
        select: { videoId: true },
      });
      const existingIds = new Set(existingItems.map((i) => i.videoId));
      const toAdd = input.videoIds.filter((id) => !existingIds.has(id));

      if (toAdd.length === 0) return { success: true, addedCount: 0 };

      const baseOrder = playlist._count.items;
      await ctx.prisma.playlistItem.createMany({
        data: toAdd.map((videoId, index) => ({
          playlistId: input.playlistId,
          videoId,
          sortOrder: baseOrder + index,
        })),
        skipDuplicates: true,
      });

      await ctx.prisma.playlist.update({
        where: { id: input.playlistId },
        data: { updatedAt: new Date() },
      });

      return { success: true, addedCount: toAdd.length };
    }),

  // 从播放列表移除视频
  removeVideos: protectedProcedure
    .input(
      z.object({
        playlistId: z.string(),
        videoIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findUnique({
        where: { id: input.playlistId },
        select: { userId: true },
      });
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
      if (playlist.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己的播放列表" });
      }

      const result = await ctx.prisma.playlistItem.deleteMany({
        where: {
          playlistId: input.playlistId,
          videoId: { in: input.videoIds },
        },
      });

      return { success: true, removedCount: result.count };
    }),

  // 重新排序播放列表中的视频
  reorder: protectedProcedure
    .input(
      z.object({
        playlistId: z.string(),
        orderedVideoIds: z.array(z.string()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const playlist = await ctx.prisma.playlist.findUnique({
        where: { id: input.playlistId },
        select: { userId: true },
      });
      if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
      if (playlist.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己的播放列表" });
      }

      await ctx.prisma.$transaction(
        input.orderedVideoIds.map((videoId, index) =>
          ctx.prisma.playlistItem.updateMany({
            where: { playlistId: input.playlistId, videoId },
            data: { sortOrder: index },
          }),
        ),
      );

      return { success: true };
    }),

  // 查询视频在当前用户哪些播放列表中
  getPlaylistsContainingVideo: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const playlists = await ctx.prisma.playlist.findMany({
        where: {
          userId: ctx.session.user.id,
          items: { some: { videoId: input.videoId } },
        },
        select: { id: true, name: true },
      });
      return playlists;
    }),
});
