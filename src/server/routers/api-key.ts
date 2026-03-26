import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { ALL_SCOPE_IDS } from "@/lib/api-scopes";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const scopeSchema = z
  .array(z.string().refine((s) => ALL_SCOPE_IDS.includes(s), { message: "无效的权限范围" }))
  .min(1, "至少选择一个权限范围");

export const apiKeyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.apiKey.findMany({
      where: { userId: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "名称不能为空").max(50, "名称最长 50 个字符"),
        scopes: scopeSchema,
        expiresAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const count = await ctx.prisma.apiKey.count({
        where: { userId: ctx.session.user.id },
      });
      if (count >= 10) {
        throw new TRPCError({ code: "FORBIDDEN", message: "最多创建 10 个 API Key" });
      }

      const raw = randomBytes(32).toString("hex");
      const key = `sk-${raw}`;
      const keyPrefix = `sk-${raw.slice(0, 8)}****`;

      const apiKey = await ctx.prisma.apiKey.create({
        data: {
          name: input.name,
          keyHash: hashApiKey(key),
          keyPrefix,
          scopes: input.scopes,
          expiresAt: input.expiresAt ?? null,
          userId: ctx.session.user.id,
        },
        select: { id: true, name: true, keyPrefix: true, scopes: true, createdAt: true },
      });

      return { ...apiKey, key };
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.apiKey.findUnique({
      where: { id: input.id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "API Key 不存在" });
    }
    await ctx.prisma.apiKey.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
