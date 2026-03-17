import { router, adminProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { join } from "path";

export const adminBackupsRouter = router({
  // ========== 数据备份 ==========

  listBackups: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(5).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;

      const [records, total] = await Promise.all([
        ctx.prisma.backupRecord.findMany({
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.backupRecord.count(),
      ]);

      return {
        records: records.map((r) => ({
          ...r,
          size: r.size.toString(),
        })),
        total,
        page,
        pageSize,
      };
    }),

  triggerBackup: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({
      includeDatabase: z.boolean().default(true),
      includeUploads: z.boolean().default(true),
      includeConfig: z.boolean().default(true),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const { createBackup } = await import("@/lib/backup");

      const running = await ctx.prisma.backupRecord.findFirst({
        where: { status: { in: ["PENDING", "RUNNING"] } },
      });
      if (running) {
        throw new TRPCError({ code: "CONFLICT", message: "已有备份任务正在进行" });
      }

      const id = await createBackup({
        type: "MANUAL",
        includeDatabase: input?.includeDatabase ?? true,
        includeUploads: input?.includeUploads ?? true,
        includeConfig: input?.includeConfig ?? true,
      });

      return { id };
    }),

  deleteBackup: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { deleteBackupById } = await import("@/lib/backup");
      await deleteBackupById(input.id);
      return { success: true };
    }),

  getBackupDownloadUrl: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const record = await ctx.prisma.backupRecord.findUnique({
        where: { id: input.id },
      });
      if (!record || !record.storagePath || record.status !== "COMPLETED") {
        throw new TRPCError({ code: "NOT_FOUND", message: "备份文件不存在或未完成" });
      }

      const { getStorageConfig, getPresignedDownloadUrl } = await import("@/lib/s3-client");
      const storageConfig = await getStorageConfig();
      if (storageConfig.provider === "local") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "本地存储不支持下载链接" });
      }

      const url = await getPresignedDownloadUrl(storageConfig, record.storagePath, 3600);
      return { url };
    }),

  restoreBackup: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.prisma.backupRecord.findUnique({
        where: { id: input.id },
      });
      if (!record || record.status !== "COMPLETED") {
        throw new TRPCError({ code: "NOT_FOUND", message: "备份不存在或未完成" });
      }

      const { restoreBackupById } = await import("@/lib/backup");
      const result = await restoreBackupById(input.id);

      if (result.errors.length > 0 && !result.database && !result.uploads && !result.config) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.errors.join("; "),
        });
      }

      return result;
    }),

});
