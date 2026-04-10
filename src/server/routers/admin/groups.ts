import { router, adminProcedure, ownerProcedure, requireScope } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ADMIN_SCOPES } from "@/lib/constants";
import { DEFAULT_GROUP_PERMISSIONS, type GroupPermissions } from "@/lib/group-permissions";
import { Prisma } from "@/generated/prisma/client";

const permissionsSchema = z.object({
  canUpload: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canDanmaku: z.boolean().optional(),
  canChat: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  adsEnabled: z.boolean().optional(),
});

const groupRoleSchema = z.enum(["USER", "ADMIN", "OWNER"]);

export const adminGroupsRouter = router({
  listGroups: adminProcedure.use(requireScope("user:manage")).query(async ({ ctx }) => {
    const groups = await ctx.prisma.userGroup.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        role: true,
        permissions: true,
        adminScopes: true,
        storageQuota: true,
        isDefault: true,
        isSystem: true,
        color: true,
        sortOrder: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });

    return groups.map((g) => ({
      ...g,
      storageQuota: g.storageQuota.toString(),
      permissions: { ...DEFAULT_GROUP_PERMISSIONS, ...(g.permissions as Partial<GroupPermissions>) },
    }));
  }),

  getGroup: adminProcedure
    .use(requireScope("user:manage"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.prisma.userGroup.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          role: true,
          permissions: true,
          adminScopes: true,
          storageQuota: true,
          isDefault: true,
          isSystem: true,
          color: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { users: true } },
        },
      });

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户组不存在" });
      }

      return {
        ...group,
        storageQuota: group.storageQuota.toString(),
        permissions: { ...DEFAULT_GROUP_PERMISSIONS, ...(group.permissions as Partial<GroupPermissions>) },
      };
    }),

  createGroup: ownerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200).optional(),
        role: groupRoleSchema.default("USER"),
        permissions: permissionsSchema.optional(),
        adminScopes: z.array(z.string()).optional(),
        storageQuota: z.string().optional(),
        color: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.userGroup.findUnique({ where: { name: input.name } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "用户组名称已存在" });
      }

      if (input.role === "OWNER") {
        const ownerGroup = await ctx.prisma.userGroup.findFirst({ where: { role: "OWNER" } });
        if (ownerGroup) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "站长组已存在，不能创建多个" });
        }
      }

      const validScopes = input.adminScopes?.filter((s) => s in ADMIN_SCOPES);
      const permissions = { ...DEFAULT_GROUP_PERMISSIONS, ...input.permissions };

      const group = await ctx.prisma.userGroup.create({
        data: {
          name: input.name,
          description: input.description,
          role: input.role,
          permissions,
          adminScopes: validScopes?.length ? validScopes : undefined,
          storageQuota: input.storageQuota ? BigInt(input.storageQuota) : undefined,
          color: input.color,
        },
      });

      return { success: true, group: { ...group, storageQuota: group.storageQuota.toString() } };
    }),

  updateGroup: ownerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(200).optional().nullable(),
        role: groupRoleSchema.optional(),
        permissions: permissionsSchema.optional(),
        adminScopes: z.array(z.string()).optional().nullable(),
        storageQuota: z.string().optional(),
        color: z.string().max(20).optional().nullable(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.userGroup.findUnique({ where: { id: input.id } });
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户组不存在" });
      }

      if (input.role && input.role !== group.role) {
        if (group.role === "OWNER") {
          throw new TRPCError({ code: "FORBIDDEN", message: "不能修改站长组的角色级别" });
        }
        if (input.role === "OWNER") {
          const existingOwner = await ctx.prisma.userGroup.findFirst({ where: { role: "OWNER" } });
          if (existingOwner) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "站长组已存在，不能将其他组设为站长级别" });
          }
        }
      }

      if (input.name && input.name !== group.name) {
        const duplicate = await ctx.prisma.userGroup.findUnique({ where: { name: input.name } });
        if (duplicate) {
          throw new TRPCError({ code: "CONFLICT", message: "用户组名称已存在" });
        }
      }

      const validScopes = input.adminScopes === null ? null : input.adminScopes?.filter((s) => s in ADMIN_SCOPES);
      const currentPerms = { ...DEFAULT_GROUP_PERMISSIONS, ...(group.permissions as Partial<GroupPermissions>) };
      const newPerms = input.permissions ? { ...currentPerms, ...input.permissions } : undefined;
      const adminScopesData =
        validScopes === null ? Prisma.DbNull : validScopes !== undefined ? validScopes : undefined;

      const effectiveRole = input.role ?? group.role;

      const updated = await ctx.prisma.userGroup.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.role && { role: input.role }),
          ...(newPerms && { permissions: newPerms }),
          ...(adminScopesData !== undefined && { adminScopes: adminScopesData }),
          ...(input.storageQuota && { storageQuota: BigInt(input.storageQuota) }),
          ...(input.color !== undefined && { color: input.color }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        },
      });

      // 如果 role 变更了，同步该组所有成员的 User.role
      if (input.role && input.role !== group.role) {
        await ctx.prisma.user.updateMany({
          where: { groupId: input.id },
          data: { role: effectiveRole },
        });
      }

      return { success: true, group: { ...updated, storageQuota: updated.storageQuota.toString() } };
    }),

  deleteGroup: ownerProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.userGroup.findUnique({
      where: { id: input.id },
      select: { isSystem: true, isDefault: true, role: true },
    });

    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "用户组不存在" });
    }

    if (group.isSystem) {
      throw new TRPCError({ code: "FORBIDDEN", message: "系统内置组不可删除" });
    }

    if (group.role === "OWNER") {
      throw new TRPCError({ code: "FORBIDDEN", message: "站长组不可删除" });
    }

    const defaultGroup = await ctx.prisma.userGroup.findFirst({ where: { isDefault: true } });
    if (!defaultGroup) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "未找到默认用户组" });
    }

    // 将该组成员迁移到默认组，同时同步 role
    await ctx.prisma.$transaction([
      ctx.prisma.user.updateMany({
        where: { groupId: input.id },
        data: { groupId: defaultGroup.id, role: defaultGroup.role },
      }),
      ctx.prisma.userGroup.delete({ where: { id: input.id } }),
    ]);

    return { success: true };
  }),

  // 批量将用户分配到指定组，同时同步 User.role
  assignUsersToGroup: ownerProcedure
    .input(
      z.object({
        userIds: z.array(z.string()).min(1).max(100),
        groupId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.userGroup.findUnique({
        where: { id: input.groupId },
        select: { id: true, role: true },
      });
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户组不存在" });
      }

      const result = await ctx.prisma.user.updateMany({
        where: { id: { in: input.userIds } },
        data: { groupId: input.groupId, role: group.role },
      });

      return { success: true, count: result.count };
    }),

  setDefaultGroup: ownerProcedure.input(z.object({ groupId: z.string() })).mutation(async ({ ctx, input }) => {
    const group = await ctx.prisma.userGroup.findUnique({ where: { id: input.groupId } });
    if (!group) {
      throw new TRPCError({ code: "NOT_FOUND", message: "用户组不存在" });
    }

    if (group.role !== "USER") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "默认组必须是普通用户级别" });
    }

    await ctx.prisma.$transaction([
      ctx.prisma.userGroup.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      ctx.prisma.userGroup.update({
        where: { id: input.groupId },
        data: { isDefault: true },
      }),
    ]);

    return { success: true };
  }),
});
