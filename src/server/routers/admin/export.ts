import { router, adminProcedure, requireScope } from "../../trpc";
import { z } from "zod";

export const adminExportRouter = router({
  // ========== 导出功能 ==========

  exportVideos: adminProcedure
    .use(requireScope("video:moderate"))
    .input(z.object({ videoIds: z.array(z.string()).min(1).max(5000) }))
    .query(async ({ ctx, input }) => {
      const videos = await ctx.prisma.video.findMany({
        where: { id: { in: input.videoIds } },
        include: {
          tags: { include: { tag: { select: { name: true } } } },
          seriesEpisodes: {
            include: {
              series: { select: { id: true, title: true, description: true, coverUrl: true, downloadUrl: true, downloadNote: true } },
            },
          },
        },
      });

      const mapVideo = (v: typeof videos[number]) => ({
        title: v.title,
        description: v.description || undefined,
        coverUrl: v.coverUrl || undefined,
        videoUrl: v.videoUrl,
        tagNames: v.tags.map((t) => t.tag.name),
        extraInfo: v.extraInfo || undefined,
      });

      const seriesMap = new Map<string, {
        title: string;
        description?: string;
        coverUrl?: string;
        downloadUrl?: string;
        downloadNote?: string;
        videosWithOrder: { video: typeof videos[number]; episodeNum: number }[];
      }>();
      const standalone: (typeof videos[number])[] = [];

      for (const v of videos) {
        if (v.seriesEpisodes.length > 0) {
          const ep = v.seriesEpisodes[0];
          const s = ep.series;
          if (!seriesMap.has(s.id)) {
            seriesMap.set(s.id, {
              title: s.title,
              description: s.description || undefined,
              coverUrl: s.coverUrl || undefined,
              downloadUrl: s.downloadUrl || undefined,
              downloadNote: s.downloadNote || undefined,
              videosWithOrder: [],
            });
          }
          seriesMap.get(s.id)!.videosWithOrder.push({ video: v, episodeNum: ep.episodeNum });
        } else {
          standalone.push(v);
        }
      }

      const series = [...seriesMap.values()].map((s) => ({
        seriesTitle: s.title,
        description: s.description,
        coverUrl: s.coverUrl,
        downloadUrl: s.downloadUrl,
        downloadNote: s.downloadNote,
        videos: s.videosWithOrder
          .sort((a, b) => a.episodeNum - b.episodeNum)
          .map((item) => mapVideo(item.video)),
      }));

      if (standalone.length > 0) {
        series.push({
          seriesTitle: "",
          description: undefined,
          coverUrl: undefined,
          downloadUrl: undefined,
          downloadNote: undefined,
          videos: standalone.map(mapVideo),
        });
      }

      return { series };
    }),

  exportGames: adminProcedure
    .use(requireScope("video:moderate"))
    .input(z.object({ gameIds: z.array(z.string()).min(1).max(5000) }))
    .query(async ({ ctx, input }) => {
      const games = await ctx.prisma.game.findMany({
        where: { id: { in: input.gameIds } },
        include: {
          tags: { include: { tag: { select: { name: true } } } },
        },
      });

      return games.map((g) => ({
        title: g.title,
        description: g.description || undefined,
        coverUrl: g.coverUrl || undefined,
        gameType: g.gameType || undefined,
        isFree: g.isFree,
        version: g.version || undefined,
        tagNames: g.tags.map((t) => t.tag.name),
        extraInfo: g.extraInfo || undefined,
      }));
    }),

  exportImages: adminProcedure
    .use(requireScope("video:moderate"))
    .input(z.object({ imageIds: z.array(z.string()).min(1).max(5000) }))
    .query(async ({ ctx, input }) => {
      const posts = await ctx.prisma.imagePost.findMany({
        where: { id: { in: input.imageIds } },
        include: {
          tags: { include: { tag: { select: { name: true } } } },
        },
      });

      return posts.map((p) => ({
        title: p.title,
        description: p.description || undefined,
        images: p.images as string[],
        tagNames: p.tags.map((t) => t.tag.name),
      }));
    }),

});
