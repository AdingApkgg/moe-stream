import { router, adminProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getServerConfig } from "@/lib/server-config";
import { STICKER_PRESETS, resolvePresetItems, resolveExternalUrl } from "@/lib/sticker-presets";
import { getAdminBatchLimit } from "./shared";
import { processSticker } from "./shared";

export const adminStickersRouter = router({
  // ==================== 贴图包管理 ====================

  listStickerPacks: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.stickerPack.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { stickers: true } } },
    });
  }),

  createStickerPack: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        slug: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9-]+$/),
        coverUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.stickerPack.create({
        data: {
          name: input.name,
          slug: input.slug,
          coverUrl: input.coverUrl,
        },
      });
    }),

  updateStickerPack: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        slug: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
        coverUrl: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.stickerPack.update({ where: { id }, data });
    }),

  deleteStickerPack: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.stickerPack.delete({ where: { id: input.id } });
    return { success: true };
  }),

  listStickers: adminProcedure.input(z.object({ packId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.prisma.sticker.findMany({
      where: { packId: input.packId },
      orderBy: { sortOrder: "asc" },
    });
  }),

  addSticker: adminProcedure
    .input(
      z.object({
        packId: z.string(),
        name: z.string().min(1).max(50),
        imageUrl: z.string(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const maxSort = await ctx.prisma.sticker.aggregate({
        where: { packId: input.packId },
        _max: { sortOrder: true },
      });
      return ctx.prisma.sticker.create({
        data: {
          packId: input.packId,
          name: input.name,
          imageUrl: input.imageUrl,
          width: input.width,
          height: input.height,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
    }),

  updateSticker: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        imageUrl: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.sticker.update({ where: { id }, data });
    }),

  deleteSticker: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.sticker.delete({ where: { id: input.id } });
    return { success: true };
  }),

  reorderStickers: adminProcedure
    .input(
      z.object({
        packId: z.string(),
        stickerIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.stickerIds.map((id, index) => ctx.prisma.sticker.update({ where: { id }, data: { sortOrder: index } })),
      );
      return { success: true };
    }),

  reorderStickerPacks: adminProcedure
    .input(z.object({ packIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.packIds.map((id, index) => ctx.prisma.stickerPack.update({ where: { id }, data: { sortOrder: index } })),
      );
      return { success: true };
    }),

  importStickersFromUrl: adminProcedure
    .input(
      z.object({
        packId: z.string(),
        items: z
          .array(
            z.object({
              url: z.string().url(),
              name: z.string().optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const config = await getServerConfig();
      const stickerDir = join(config.uploadDir, "sticker");
      if (!existsSync(stickerDir)) {
        await mkdir(stickerDir, { recursive: true });
      }

      const maxSort = await ctx.prisma.sticker.aggregate({
        where: { packId: input.packId },
        _max: { sortOrder: true },
      });
      let nextSort = (maxSort._max.sortOrder ?? -1) + 1;

      let success = 0;
      const errors: string[] = [];

      for (const item of input.items) {
        try {
          const res = await fetch(item.url, { signal: AbortSignal.timeout(15000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = Buffer.from(await res.arrayBuffer());

          const { data: processed, filename, width, height } = await processSticker(buffer, "import");
          await writeFile(join(stickerDir, filename), processed);

          const stickerName =
            item.name ||
            item.url
              .split("/")
              .pop()
              ?.replace(/\.[^.]+$/, "") ||
            "sticker";
          await ctx.prisma.sticker.create({
            data: {
              packId: input.packId,
              name: stickerName.slice(0, 50),
              imageUrl: `/uploads/sticker/${filename}`,
              width,
              height,
              sortOrder: nextSort++,
            },
          });
          success++;
        } catch (e) {
          errors.push(`${item.url}: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }

      return { success, failed: errors.length, errors };
    }),

  listStickerPresets: adminProcedure.query(() => {
    return STICKER_PRESETS.map(({ id, name, slug, source, description, preview }) => ({
      id,
      name,
      slug,
      source,
      description,
      preview,
    }));
  }),

  importPresetPack: adminProcedure
    .input(
      z.object({
        presetId: z.string(),
        customName: z.string().min(1).max(50).optional(),
        customSlug: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const preset = STICKER_PRESETS.find((p) => p.id === input.presetId);
      if (!preset) throw new TRPCError({ code: "NOT_FOUND", message: "预设不存在" });

      const packName = input.customName || preset.name;
      const packSlug = input.customSlug || preset.slug;

      const existing = await ctx.prisma.stickerPack.findUnique({ where: { slug: packSlug } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: `Slug "${packSlug}" 已被占用` });

      const items = await resolvePresetItems(preset);
      if (items.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "预设中没有贴图" });

      const config = await getServerConfig();
      const stickerDir = join(config.uploadDir, "sticker");
      if (!existsSync(stickerDir)) {
        await mkdir(stickerDir, { recursive: true });
      }

      const pack = await ctx.prisma.stickerPack.create({
        data: {
          name: packName,
          slug: packSlug,
          isActive: true,
          sortOrder: 0,
        },
      });

      let success = 0;
      const errors: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const res = await fetch(item.url, { signal: AbortSignal.timeout(15000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = Buffer.from(await res.arrayBuffer());

          const { data: processed, filename, width, height } = await processSticker(buffer, "preset");
          await writeFile(join(stickerDir, filename), processed);

          await ctx.prisma.sticker.create({
            data: {
              packId: pack.id,
              name: item.name.slice(0, 50),
              imageUrl: `/uploads/sticker/${filename}`,
              width,
              height,
              sortOrder: i,
            },
          });
          success++;
        } catch (e) {
          errors.push(`${item.name}: ${e instanceof Error ? e.message : "未知错误"}`);
        }
      }

      if (success > 0) {
        const firstSticker = await ctx.prisma.sticker.findFirst({
          where: { packId: pack.id },
          orderBy: { sortOrder: "asc" },
        });
        if (firstSticker) {
          await ctx.prisma.stickerPack.update({
            where: { id: pack.id },
            data: { coverUrl: firstSticker.imageUrl },
          });
        }
      }

      return {
        packId: pack.id,
        packName,
        total: items.length,
        success,
        failed: errors.length,
        errors: errors.slice(0, 10),
      };
    }),

  importFromExternalUrl: adminProcedure
    .input(
      z.object({
        url: z.string().url(),
        slugPrefix: z
          .string()
          .min(1)
          .max(30)
          .regex(/^[a-z0-9-]+$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolvedPacks = await resolveExternalUrl(input.url);
      const totalItems = resolvedPacks.reduce((s, p) => s + p.items.length, 0);
      if (totalItems === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "未检测到有效贴图" });
      }

      const config = await getServerConfig();
      const stickerDir = join(config.uploadDir, "sticker");
      if (!existsSync(stickerDir)) {
        await mkdir(stickerDir, { recursive: true });
      }

      const existingSlugs = new Set(
        (await ctx.prisma.stickerPack.findMany({ select: { slug: true } })).map((p) => p.slug),
      );

      const autoSlug = (name: string, idx: number): string => {
        const base =
          (input.slugPrefix ? `${input.slugPrefix}-` : "") +
          (name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || `pack-${idx}`);
        let slug = base;
        let n = 2;
        while (existingSlugs.has(slug)) {
          slug = `${base}-${n++}`;
        }
        existingSlugs.add(slug);
        return slug;
      };

      const packResults: {
        packName: string;
        total: number;
        success: number;
        failed: number;
        errors: string[];
      }[] = [];

      for (let pi = 0; pi < resolvedPacks.length; pi++) {
        const rp = resolvedPacks[pi];
        const packSlug = autoSlug(rp.packName, pi);

        const pack = await ctx.prisma.stickerPack.create({
          data: { name: rp.packName, slug: packSlug, isActive: true, sortOrder: 0 },
        });

        let success = 0;
        const errors: string[] = [];

        for (let i = 0; i < rp.items.length; i++) {
          const item = rp.items[i];
          try {
            const res = await fetch(item.url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());

            const { data: processed, filename, width, height } = await processSticker(buffer, "ext");
            await writeFile(join(stickerDir, filename), processed);

            await ctx.prisma.sticker.create({
              data: {
                packId: pack.id,
                name: item.name.slice(0, 50),
                imageUrl: `/uploads/sticker/${filename}`,
                width,
                height,
                sortOrder: i,
              },
            });
            success++;
          } catch (e) {
            errors.push(`${item.name}: ${e instanceof Error ? e.message : "未知错误"}`);
          }
        }

        if (success > 0) {
          const firstSticker = await ctx.prisma.sticker.findFirst({
            where: { packId: pack.id },
            orderBy: { sortOrder: "asc" },
          });
          if (firstSticker) {
            await ctx.prisma.stickerPack.update({
              where: { id: pack.id },
              data: { coverUrl: firstSticker.imageUrl },
            });
          }
        }

        packResults.push({
          packName: rp.packName,
          total: rp.items.length,
          success,
          failed: errors.length,
          errors: errors.slice(0, 5),
        });
      }

      const totalSuccess = packResults.reduce((s, p) => s + p.success, 0);
      const totalFailed = packResults.reduce((s, p) => s + p.failed, 0);

      return {
        packs: packResults,
        totalPacks: packResults.length,
        totalItems,
        totalSuccess,
        totalFailed,
      };
    }),

  transferWorkItems: adminProcedure
    .use(requireScope("video:manage"))
    .input(
      z.object({
        itemIds: z.array(z.string()).min(1),
        contentType: z.enum(["video", "game", "image", "series"]),
        toUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const batchLimit = await getAdminBatchLimit(ctx.prisma);
      if (input.itemIds.length > batchLimit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `批量操作上限为 ${batchLimit} 个，当前 ${input.itemIds.length} 个，请在系统设置中调整`,
        });
      }

      const toUser = await ctx.prisma.user.findUnique({
        where: { id: input.toUserId },
        select: { id: true, username: true },
      });
      if (!toUser) throw new TRPCError({ code: "NOT_FOUND", message: "目标用户不存在" });

      let count = 0;
      switch (input.contentType) {
        case "video": {
          const result = await ctx.prisma.video.updateMany({
            where: { id: { in: input.itemIds } },
            data: { uploaderId: input.toUserId },
          });
          count = result.count;
          break;
        }
        case "game": {
          const result = await ctx.prisma.game.updateMany({
            where: { id: { in: input.itemIds } },
            data: { uploaderId: input.toUserId },
          });
          count = result.count;
          break;
        }
        case "image": {
          const result = await ctx.prisma.imagePost.updateMany({
            where: { id: { in: input.itemIds } },
            data: { uploaderId: input.toUserId },
          });
          count = result.count;
          break;
        }
        case "series": {
          const result = await ctx.prisma.series.updateMany({
            where: { id: { in: input.itemIds } },
            data: { creatorId: input.toUserId },
          });
          count = result.count;
          break;
        }
      }

      return { success: true, count };
    }),

  searchUsersForTransfer: adminProcedure
    .use(requireScope("video:manage"))
    .input(z.object({ search: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: input.search, mode: "insensitive" } },
            { nickname: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
            { id: input.search },
          ],
        },
        take: 10,
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
        },
      });

      return users;
    }),

  getStickerUsageStats: adminProcedure.query(async ({ ctx }) => {
    const [commentRows, gameCommentRows, imageCommentRows] = await Promise.all([
      ctx.prisma.$queryRaw<{ sticker_id: string; cnt: bigint }[]>`
        SELECT m[1] AS sticker_id, COUNT(*)::bigint AS cnt
        FROM "Comment", LATERAL regexp_matches(content, '\\[sticker:[a-z0-9-]+:([a-zA-Z0-9_-]+)\\]', 'g') AS m
        WHERE content LIKE '%[sticker:%'
        GROUP BY m[1]`,
      ctx.prisma.$queryRaw<{ sticker_id: string; cnt: bigint }[]>`
        SELECT m[1] AS sticker_id, COUNT(*)::bigint AS cnt
        FROM "GameComment", LATERAL regexp_matches(content, '\\[sticker:[a-z0-9-]+:([a-zA-Z0-9_-]+)\\]', 'g') AS m
        WHERE content LIKE '%[sticker:%'
        GROUP BY m[1]`,
      ctx.prisma.$queryRaw<{ sticker_id: string; cnt: bigint }[]>`
        SELECT m[1] AS sticker_id, COUNT(*)::bigint AS cnt
        FROM "ImagePostComment", LATERAL regexp_matches(content, '\\[sticker:[a-z0-9-]+:([a-zA-Z0-9_-]+)\\]', 'g') AS m
        WHERE content LIKE '%[sticker:%'
        GROUP BY m[1]`,
    ]);

    const usageMap: Record<string, number> = {};
    for (const rows of [commentRows, gameCommentRows, imageCommentRows]) {
      for (const row of rows) {
        usageMap[row.sticker_id] = (usageMap[row.sticker_id] || 0) + Number(row.cnt);
      }
    }

    const totalUsage = Object.values(usageMap).reduce((a, b) => a + b, 0);
    return { usageMap, totalUsage };
  }),
});
