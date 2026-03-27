import { router, adminProcedure, requireScope } from "../../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createS3Client } from "@/lib/s3-client";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

const policyInput = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(["local", "s3", "r2", "minio", "oss", "cos"]),
  endpoint: z.string().nullable().optional(),
  bucket: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  accessKey: z.string().nullable().optional(),
  secretKey: z.string().nullable().optional(),
  customDomain: z.string().nullable().optional(),
  pathPrefix: z.string().nullable().optional(),
  uploadDir: z.string().nullable().optional(),
  maxFileSize: z.number().int().positive().default(1073741824),
  allowedTypes: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const adminStoragePoliciesRouter = router({
  listStoragePolicies: adminProcedure.use(requireScope("settings:manage")).query(async ({ ctx }) => {
    const policies = await ctx.prisma.storagePolicy.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { files: true } } },
    });
    return policies.map((p) => ({
      ...p,
      maxFileSize: Number(p.maxFileSize),
      fileCount: p._count.files,
    }));
  }),

  createStoragePolicy: adminProcedure
    .use(requireScope("settings:manage"))
    .input(policyInput)
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await ctx.prisma.storagePolicy.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      const policy = await ctx.prisma.storagePolicy.create({
        data: {
          ...input,
          maxFileSize: BigInt(input.maxFileSize),
        },
      });
      return { ...policy, maxFileSize: Number(policy.maxFileSize) };
    }),

  updateStoragePolicy: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }).merge(policyInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.isDefault) {
        await ctx.prisma.storagePolicy.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const updateData: Record<string, unknown> = { ...data };
      if (data.maxFileSize !== undefined) {
        updateData.maxFileSize = BigInt(data.maxFileSize);
      }
      const policy = await ctx.prisma.storagePolicy.update({
        where: { id },
        data: updateData,
      });
      return { ...policy, maxFileSize: Number(policy.maxFileSize) };
    }),

  deleteStoragePolicy: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.userFile.count({
        where: { storagePolicyId: input.id, status: { not: "DELETED" } },
      });
      if (count > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `该策略下仍有 ${count} 个文件，请先迁移或删除`,
        });
      }
      await ctx.prisma.storagePolicy.delete({ where: { id: input.id } });
      return { success: true };
    }),

  testConnection: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        provider: z.enum(["local", "s3", "r2", "minio", "oss", "cos"]),
        endpoint: z.string().nullable().optional(),
        bucket: z.string().nullable().optional(),
        region: z.string().nullable().optional(),
        accessKey: z.string().nullable().optional(),
        secretKey: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.provider === "local") {
        return { success: true, message: "本地存储无需测试连通性" };
      }

      try {
        const client = createS3Client({
          provider: input.provider,
          endpoint: input.endpoint ?? null,
          bucket: input.bucket ?? null,
          region: input.region ?? null,
          accessKey: input.accessKey ?? null,
          secretKey: input.secretKey ?? null,
          customDomain: null,
          pathPrefix: null,
        });

        await client.send(new HeadBucketCommand({ Bucket: input.bucket! }));
        client.destroy();

        return { success: true, message: "连接成功" };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "连接失败",
        };
      }
    }),
});
