import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { hash } from "@/lib/bcrypt-wasm";
import { TRPCError } from "@trpc/server";
import { isSetupComplete, invalidateSetupCache } from "@/lib/setup";
import { reloadPublicSiteConfig } from "@/lib/site-config";
import { reloadServerConfig } from "@/lib/server-config";

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
      }),
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

      // 确保站长组和默认组存在
      const ownerGroup = await ctx.prisma.userGroup.upsert({
        where: { name: "站长组" },
        update: {},
        create: {
          name: "站长组",
          description: "站长专属组，拥有最高权限",
          role: "OWNER",
          permissions: {
            canUpload: true,
            canComment: true,
            canDanmaku: true,
            canChat: true,
            canDownload: true,
            adsEnabled: false,
          },
          storageQuota: BigInt(107374182400),
          isSystem: true,
          color: "#D97706",
          sortOrder: 99,
        },
      });
      await ctx.prisma.userGroup.upsert({
        where: { name: "默认用户组" },
        update: {},
        create: {
          name: "默认用户组",
          description: "新注册用户的默认组",
          role: "USER",
          permissions: {
            canUpload: false,
            canComment: true,
            canDanmaku: true,
            canChat: true,
            canDownload: false,
            adsEnabled: true,
          },
          storageQuota: BigInt(5368709120),
          isDefault: true,
          isSystem: true,
          color: "#6B7280",
          sortOrder: 0,
        },
      });

      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          username: input.username.toLowerCase(),
          displayUsername: input.username,
          password: hashedPassword,
          nickname: input.nickname || input.username,
          role: "OWNER",
          canUpload: true,
          groupId: ownerGroup.id,
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
        await reloadPublicSiteConfig();
        await reloadServerConfig();
      }

      await invalidateSetupCache();

      return { success: true, userId: user.id };
    }),
});
