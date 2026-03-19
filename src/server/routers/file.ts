import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  initUpload,
  completeUpload,
  deleteUserFile,
} from "@/lib/storage-policy";

export const fileRouter = router({
  initUpload: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        size: z.number().int().positive(),
        mimeType: z.string().min(1),
        contentType: z.enum(["video", "game", "imagePost"]).optional(),
        contentId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const siteConfig = await ctx.prisma.siteConfig.findUnique({
        where: { id: "default" },
        select: { fileUploadEnabled: true },
      });
      if (!siteConfig?.fileUploadEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "文件上传功能未启用" });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { storageQuota: true, storageUsed: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });

      if (user.storageUsed + BigInt(input.size) > user.storageQuota) {
        throw new TRPCError({ code: "FORBIDDEN", message: "存储空间不足" });
      }

      if (input.contentType && input.contentId) {
        await verifyContentOwnership(
          ctx.prisma,
          input.contentType,
          input.contentId,
          ctx.session.user.id,
        );
      }

      try {
        const result = await initUpload({
          userId: ctx.session.user.id,
          filename: input.filename,
          size: input.size,
          mimeType: input.mimeType,
          contentType: input.contentType,
          contentId: input.contentId,
        });
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "初始化上传失败",
        });
      }
    }),

  completeUpload: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        uploadId: z.string().optional(),
        parts: z
          .array(z.object({ partNumber: z.number(), etag: z.string() }))
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await completeUpload({
          fileId: input.fileId,
          userId: ctx.session.user.id,
          uploadId: input.uploadId,
          parts: input.parts,
        });

        const file = await ctx.prisma.userFile.findUnique({
          where: { id: input.fileId },
        });
        return {
          id: file!.id,
          url: file!.url,
          filename: file!.filename,
          size: Number(file!.size),
          mimeType: file!.mimeType,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "完成上传失败",
        });
      }
    }),

  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        contentType: z.enum(["video", "game", "imagePost"]).optional(),
        contentId: z.string().optional(),
        mimePrefix: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.session.user.id,
        status: "UPLOADED",
      };
      if (input.contentType) where.contentType = input.contentType;
      if (input.contentId) where.contentId = input.contentId;
      if (input.mimePrefix) where.mimeType = { startsWith: input.mimePrefix };

      const items = await ctx.prisma.userFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop()!;
        nextCursor = next.id;
      }

      return {
        items: items.map(serializeFile),
        nextCursor,
      };
    }),

  getByContent: publicProcedure
    .input(
      z.object({
        contentType: z.enum(["video", "game", "imagePost"]),
        contentId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const files = await ctx.prisma.userFile.findMany({
        where: {
          contentType: input.contentType,
          contentId: input.contentId,
          status: "UPLOADED",
        },
        orderBy: { createdAt: "asc" },
      });
      return files.map(serializeFile);
    }),

  attach: protectedProcedure
    .input(
      z.object({
        fileId: z.string(),
        contentType: z.enum(["video", "game", "imagePost"]),
        contentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.userFile.findUnique({
        where: { id: input.fileId },
      });
      if (!file || file.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文件不存在" });
      }

      await verifyContentOwnership(
        ctx.prisma,
        input.contentType,
        input.contentId,
        ctx.session.user.id,
      );

      await ctx.prisma.userFile.update({
        where: { id: input.fileId },
        data: {
          contentType: input.contentType,
          contentId: input.contentId,
        },
      });

      return { success: true };
    }),

  detach: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await ctx.prisma.userFile.findUnique({
        where: { id: input.fileId },
      });
      if (!file || file.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "文件不存在" });
      }

      await ctx.prisma.userFile.update({
        where: { id: input.fileId },
        data: { contentType: null, contentId: null },
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteUserFile(input.fileId, ctx.session.user.id);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "删除失败",
        });
      }
    }),

  getStorageUsage: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { storageQuota: true, storageUsed: true },
    });
    return {
      used: Number(user?.storageUsed ?? 0),
      quota: Number(user?.storageQuota ?? 0),
    };
  }),
});

function serializeFile(f: {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: bigint;
  contentType: string | null;
  contentId: string | null;
  createdAt: Date;
  uploadedAt: Date | null;
}) {
  return {
    id: f.id,
    filename: f.filename,
    url: f.url,
    mimeType: f.mimeType,
    size: Number(f.size),
    contentType: f.contentType,
    contentId: f.contentId,
    createdAt: f.createdAt.toISOString(),
    uploadedAt: f.uploadedAt?.toISOString() ?? null,
  };
}

async function verifyContentOwnership(
  prisma: typeof import("@/lib/prisma").prisma,
  contentType: string,
  contentId: string,
  userId: string,
) {
  let ownerId: string | null = null;

  if (contentType === "video") {
    const v = await prisma.video.findUnique({
      where: { id: contentId },
      select: { uploaderId: true },
    });
    ownerId = v?.uploaderId ?? null;
  } else if (contentType === "game") {
    const g = await prisma.game.findUnique({
      where: { id: contentId },
      select: { uploaderId: true },
    });
    ownerId = g?.uploaderId ?? null;
  } else if (contentType === "imagePost") {
    const ip = await prisma.imagePost.findUnique({
      where: { id: contentId },
      select: { uploaderId: true },
    });
    ownerId = ip?.uploaderId ?? null;
  }

  if (!ownerId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "内容不存在" });
  }
  if (ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权操作此内容的附件" });
  }
}
