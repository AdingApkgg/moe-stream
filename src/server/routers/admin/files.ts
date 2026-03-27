import { router, adminProcedure, requireScope } from "../../trpc";
import { z } from "zod";
import { deleteUserFile } from "@/lib/storage-policy";

export const adminFilesRouter = router({
  listFiles: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        userId: z.string().optional(),
        status: z.enum(["UPLOADING", "UPLOADED", "FAILED", "DELETED"]).optional(),
        mimePrefix: z.string().optional(),
        contentType: z.enum(["video", "game", "imagePost"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.userId) where.userId = input.userId;
      if (input.status) where.status = input.status;
      if (input.mimePrefix) where.mimeType = { startsWith: input.mimePrefix };
      if (input.contentType) where.contentType = input.contentType;

      const items = await ctx.prisma.userFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          user: { select: { id: true, username: true, nickname: true, avatar: true } },
          storagePolicy: { select: { id: true, name: true, provider: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }

      return {
        items: items.map((f) => ({
          id: f.id,
          filename: f.filename,
          url: f.url,
          mimeType: f.mimeType,
          size: Number(f.size),
          status: f.status,
          contentType: f.contentType,
          contentId: f.contentId,
          createdAt: f.createdAt.toISOString(),
          uploadedAt: f.uploadedAt?.toISOString() ?? null,
          user: f.user,
          storagePolicy: f.storagePolicy,
        })),
        nextCursor,
      };
    }),

  deleteFile: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.userFile.findUnique({
        where: { id: input.fileId },
        select: { userId: true },
      });
      if (!file) return { success: false };

      await deleteUserFile(input.fileId, file.userId);
      return { success: true };
    }),

  forceDetach: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.userFile.update({
        where: { id: input.fileId },
        data: { contentType: null, contentId: null },
      });
      return { success: true };
    }),

  getFileUserStats: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.prisma.user.findMany({
        where: { storageUsed: { gt: 0 } },
        orderBy: { storageUsed: "desc" },
        take: input.limit,
        select: {
          id: true,
          username: true,
          nickname: true,
          avatar: true,
          storageUsed: true,
          storageQuota: true,
          _count: { select: { files: true } },
        },
      });
      return users.map((u) => ({
        ...u,
        storageUsed: Number(u.storageUsed),
        storageQuota: Number(u.storageQuota),
        fileCount: u._count.files,
      }));
    }),

  cleanStale: adminProcedure.use(requireScope("settings:manage")).mutation(async ({ ctx }) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleFiles = await ctx.prisma.userFile.findMany({
      where: {
        status: "UPLOADING",
        createdAt: { lt: cutoff },
      },
    });

    let cleaned = 0;
    for (const file of staleFiles) {
      try {
        await deleteUserFile(file.id, file.userId);
        cleaned++;
      } catch {
        await ctx.prisma.userFile.update({
          where: { id: file.id },
          data: { status: "FAILED" },
        });
      }
    }
    return { cleaned, total: staleFiles.length };
  }),

  updateUserQuota: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        userId: z.string(),
        storageQuota: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { storageQuota: BigInt(input.storageQuota) },
      });
      return { success: true };
    }),
});
