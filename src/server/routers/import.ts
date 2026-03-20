import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { enqueueImport } from "@/lib/import-queue";
import { getProvider, type CloudProviderType } from "@/lib/cloud-providers";
import { redis } from "@/lib/redis";

const CLOUD_PROVIDERS = ["google", "onedrive", "dropbox", "url"] as const;

export const importRouter = router({
  /** Create an import task from a cloud provider or URL */
  createTask: protectedProcedure
    .input(
      z.object({
        provider: z.enum(CLOUD_PROVIDERS),
        sourceUrl: z.string().min(1).max(2000),
        sourceFileId: z.string().optional(),
        sourceName: z.string().min(1).max(500),
        sourceSize: z.number().int().nonnegative().optional(),
        sourceMimeType: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const siteConfig = await ctx.prisma.siteConfig.findUnique({
        where: { id: "default" },
        select: { cloudImportEnabled: true, fileUploadEnabled: true },
      });
      if (!siteConfig?.cloudImportEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "网盘导入功能未启用" });
      }
      if (!siteConfig?.fileUploadEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "文件上传功能未启用" });
      }

      // Check storage quota
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { storageQuota: true, storageUsed: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });

      if (input.sourceSize && user.storageUsed + BigInt(input.sourceSize) > user.storageQuota) {
        throw new TRPCError({ code: "FORBIDDEN", message: "存储空间不足" });
      }

      // Limit concurrent imports per user
      const activeCount = await ctx.prisma.importTask.count({
        where: {
          userId: ctx.session.user.id,
          status: { in: ["PENDING", "DOWNLOADING", "PROCESSING"] },
        },
      });
      if (activeCount >= 5) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "最多同时导入 5 个文件" });
      }

      const task = await ctx.prisma.importTask.create({
        data: {
          userId: ctx.session.user.id,
          provider: input.provider,
          sourceUrl: input.sourceUrl,
          sourceFileId: input.sourceFileId ?? null,
          sourceName: input.sourceName,
          sourceSize: input.sourceSize ? BigInt(input.sourceSize) : null,
          sourceMimeType: input.sourceMimeType ?? null,
          status: "PENDING",
        },
      });

      await enqueueImport(task.id);

      return {
        id: task.id,
        status: task.status,
      };
    }),

  /** Parse a URL to detect provider and extract file info */
  parseUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      for (const providerType of CLOUD_PROVIDERS) {
        try {
          const provider = getProvider(providerType as CloudProviderType);
          const info = await provider.parseShareUrl(input.url);
          if (info) {
            return {
              provider: providerType,
              providerName: provider.name,
              fileId: info.fileId ?? null,
              name: info.name,
              size: info.size ?? null,
              mimeType: info.mimeType ?? null,
            };
          }
        } catch {
          continue;
        }
      }

      return null;
    }),

  /** List import tasks for the current user */
  listTasks: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.importTask.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }

      return {
        items: items.map((t) => ({
          id: t.id,
          provider: t.provider,
          sourceName: t.sourceName,
          sourceSize: t.sourceSize ? Number(t.sourceSize) : null,
          status: t.status,
          progress: t.progress,
          downloadedBytes: Number(t.downloadedBytes),
          error: t.error,
          userFileId: t.userFileId,
          createdAt: t.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }),

  /** Cancel a pending/downloading import task */
  cancelTask: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.importTask.findUnique({
        where: { id: input.taskId },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
      if (task.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权操作" });
      }
      if (task.status === "COMPLETED" || task.status === "CANCELLED") {
        return { success: true };
      }

      await ctx.prisma.importTask.update({
        where: { id: input.taskId },
        data: { status: "CANCELLED" },
      });

      return { success: true };
    }),

  /** Get OAuth authorization URL for a cloud provider */
  getOAuthUrl: protectedProcedure
    .input(z.object({ provider: z.enum(["google", "onedrive"]) }))
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.prisma.siteConfig.findUnique({
        where: { id: "default" },
      });
      if (!config) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const siteUrl = config.siteUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const redirectUri = `${siteUrl}/api/cloud-auth/${input.provider}/callback`;

      if (input.provider === "google") {
        const clientId = config.oauthGoogleClientId;
        if (!clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "Google OAuth 未配置" });

        const scope = "https://www.googleapis.com/auth/drive.readonly";
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", scope);
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("state", ctx.session.user.id);
        return { url: url.toString() };
      }

      if (input.provider === "onedrive") {
        const clientId = config.oauthMicrosoftClientId;
        if (!clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "Microsoft OAuth 未配置" });

        const scope = "Files.Read.All offline_access";
        const url = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", scope);
        url.searchParams.set("state", ctx.session.user.id);
        return { url: url.toString() };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "不支持的提供商" });
    }),

  /** Check if user has a valid cloud token */
  hasToken: protectedProcedure
    .input(z.object({ provider: z.enum(CLOUD_PROVIDERS) }))
    .query(async ({ ctx, input }) => {
      if (input.provider === "url" || input.provider === "dropbox") {
        return { hasToken: true };
      }
      const token = await redis.get(`cloud:token:${ctx.session.user.id}:${input.provider}`);
      return { hasToken: !!token };
    }),
});
