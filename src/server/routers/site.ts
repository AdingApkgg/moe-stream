import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getPublicSiteConfig } from "@/lib/site-config";
import { prisma } from "@/lib/prisma";

const urlRegex = /^https?:\/\/.+/;

export const siteRouter = router({
  // 获取公开的网站配置（不需要登录）
  getConfig: publicProcedure.query(async () => {
    return getPublicSiteConfig();
  }),

  // 获取可见的友情链接
  getFriendLinks: publicProcedure.query(async () => {
    return prisma.friendLink.findMany({
      where: { visible: true },
      orderBy: [{ sort: "desc" }, { createdAt: "desc" }],
    });
  }),

  // 提交友链申请（默认不可见，需管理员审核）
  submitFriendLink: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "请填写站点名称").max(100),
        url: z.string().refine((v) => urlRegex.test(v), { message: "请输入有效的网址（以 http:// 或 https:// 开头）" }),
        logo: z.string().refine((v) => !v || urlRegex.test(v), { message: "Logo 地址格式不正确" }).optional(),
        description: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 检查是否已存在相同 URL 的友链
      const existing = await prisma.friendLink.findFirst({
        where: { url: input.url },
      });

      if (existing) {
        return { success: true, message: "该链接已收录或正在审核中" };
      }

      await prisma.friendLink.create({
        data: {
          name: input.name,
          url: input.url,
          logo: input.logo || null,
          description: input.description || null,
          visible: false,
        },
      });

      return { success: true, message: "提交成功，等待管理员审核" };
    }),
});
