import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { hash } from "@/lib/bcrypt-wasm";
import { TRPCError } from "@trpc/server";
import { isSetupComplete, invalidateSetupCache } from "@/lib/setup";
import { invalidateCache } from "@/lib/redis";

export const setupRouter = router({
  checkStatus: publicProcedure.query(async () => {
    const complete = await isSetupComplete();
    return { needsSetup: !complete };
  }),

  createOwner: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        username: z.string().min(3).max(20),
        password: z.string().min(6),
        nickname: z.string().optional(),
        siteName: z.string().max(100).optional(),
        siteUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const complete = await isSetupComplete();
      if (complete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "初始配置已完成，无法再次执行",
        });
      }

      const existingUser = await ctx.prisma.user.findFirst({
        where: {
          OR: [{ email: input.email }, { username: input.username }],
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "邮箱或用户名已存在",
        });
      }

      const hashedPassword = await hash(input.password, 10);

      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          username: input.username.toLowerCase(),
          displayUsername: input.username,
          password: hashedPassword,
          nickname: input.nickname || input.username,
          role: "OWNER",
          canUpload: true,
        },
      });

      await ctx.prisma.account.create({
        data: {
          userId: user.id,
          type: "credential",
          provider: "credential",
          providerAccountId: user.id,
          password: hashedPassword,
        },
      });

      const siteUpdate: Record<string, unknown> = {};
      if (input.siteName) siteUpdate.siteName = input.siteName;
      if (input.siteUrl) siteUpdate.siteUrl = input.siteUrl;

      if (Object.keys(siteUpdate).length > 0) {
        await ctx.prisma.siteConfig.upsert({
          where: { id: "default" },
          create: { id: "default", ...siteUpdate },
          update: siteUpdate,
        });
        await invalidateCache("site:config");
        await invalidateCache("server:config");
      }

      await invalidateSetupCache();

      return { success: true, userId: user.id };
    }),
});
