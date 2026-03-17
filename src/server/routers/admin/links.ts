import { router, adminProcedure, requireScope } from "../../trpc";
import { z } from "zod";

export const adminLinksRouter = router({
  // ========== 友情链接管理 ==========

  listFriendLinks: adminProcedure.use(requireScope("settings:manage")).query(async ({ ctx }) => {
    return ctx.prisma.friendLink.findMany({ orderBy: [{ sort: "desc" }, { createdAt: "desc" }] });
  }),

  createFriendLink: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        name: z.string().min(1).max(100),
        url: z.string().url(),
        logo: z.string().optional(),
        description: z.string().max(200).optional(),
        sort: z.number().int().default(0),
        visible: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.friendLink.create({ data: input });
    }),

  updateFriendLink: adminProcedure
    .use(requireScope("settings:manage"))
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        url: z.string().url().optional(),
        logo: z.string().optional(),
        description: z.string().max(200).optional(),
        sort: z.number().int().optional(),
        visible: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.friendLink.update({ where: { id }, data });
    }),

  deleteFriendLink: adminProcedure
    .use(requireScope("settings:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.friendLink.delete({ where: { id: input.id } });
      return { success: true };
    }),

});
