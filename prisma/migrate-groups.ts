/**
 * 数据迁移脚本：创建系统内置用户组，并将现有用户按规则分配到对应组。
 * 同时同步 User.role 与所属组的 role。
 *
 * 运行方式：pnpm tsx prisma/migrate-groups.ts
 *
 * 迁移规则：
 *   - OWNER → 站长组
 *   - ADMIN + 全部 adminScopes → 全权管理组
 *   - ADMIN + 部分 adminScopes（含 video:moderate 或 comment:manage）→ 内容审核组
 *   - ADMIN + 其他 → 全权管理组（兜底）
 *   - USER + canUpload=true → 投稿用户组
 *   - USER + canUpload=false → 默认用户组
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import path from "node:path";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
config({ path: path.join(__dirname, "..", envFile) });

const ALL_ADMIN_SCOPES = [
  "video:moderate",
  "video:manage",
  "user:view",
  "user:manage",
  "tag:manage",
  "settings:manage",
  "comment:manage",
];

const GROUP_SEEDS = [
  {
    name: "默认用户组",
    description: "新注册用户的默认组",
    role: "USER" as const,
    permissions: {
      canUpload: false,
      canComment: true,
      canDanmaku: true,
      canChat: true,
      canDownload: false,
      adsEnabled: true,
    },
    adminScopes: undefined as string[] | undefined,
    storageQuota: BigInt(5368709120),
    isDefault: true,
    isSystem: true,
    color: "#6B7280",
    sortOrder: 0,
  },
  {
    name: "投稿用户组",
    description: "具有投稿权限的用户",
    role: "USER" as const,
    permissions: {
      canUpload: true,
      canComment: true,
      canDanmaku: true,
      canChat: true,
      canDownload: true,
      adsEnabled: true,
    },
    adminScopes: undefined as string[] | undefined,
    storageQuota: BigInt(21474836480),
    isDefault: false,
    isSystem: true,
    color: "#3B82F6",
    sortOrder: 1,
  },
  {
    name: "内容审核组",
    description: "负责内容审核的管理员",
    role: "ADMIN" as const,
    permissions: {
      canUpload: true,
      canComment: true,
      canDanmaku: true,
      canChat: true,
      canDownload: true,
      adsEnabled: false,
    },
    adminScopes: ["video:moderate", "comment:manage"],
    storageQuota: BigInt(21474836480),
    isDefault: false,
    isSystem: true,
    color: "#F59E0B",
    sortOrder: 2,
  },
  {
    name: "全权管理组",
    description: "拥有所有管理权限的管理员",
    role: "ADMIN" as const,
    permissions: {
      canUpload: true,
      canComment: true,
      canDanmaku: true,
      canChat: true,
      canDownload: true,
      adsEnabled: false,
    },
    adminScopes: ALL_ADMIN_SCOPES,
    storageQuota: BigInt(53687091200),
    isDefault: false,
    isSystem: true,
    color: "#EF4444",
    sortOrder: 3,
  },
  {
    name: "站长组",
    description: "站长专属组，拥有最高权限",
    role: "OWNER" as const,
    permissions: {
      canUpload: true,
      canComment: true,
      canDanmaku: true,
      canChat: true,
      canDownload: true,
      adsEnabled: false,
    },
    adminScopes: undefined as string[] | undefined,
    storageQuota: BigInt(107374182400),
    isDefault: false,
    isSystem: true,
    color: "#D97706",
    sortOrder: 99,
  },
];

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]);
  const prisma = new PrismaClient({ adapter });

  console.log("🔄 开始用户组迁移...\n");

  try {
    // 1. 创建/确认系统内置组
    console.log("📦 创建系统内置用户组...");
    const groupMap: Record<string, string> = {};

    for (const g of GROUP_SEEDS) {
      const group = await prisma.userGroup.upsert({
        where: { name: g.name },
        update: {},
        create: {
          name: g.name,
          description: g.description,
          role: g.role,
          permissions: g.permissions,
          adminScopes: g.adminScopes ?? undefined,
          storageQuota: g.storageQuota,
          isDefault: g.isDefault,
          isSystem: g.isSystem,
          color: g.color,
          sortOrder: g.sortOrder,
        },
      });
      groupMap[g.name] = group.id;
      console.log(`   ✓ ${g.name} (${group.id}) — role: ${g.role}`);
    }

    // 2. 查询所有未分配组的用户
    const usersToMigrate = await prisma.user.findMany({
      where: { groupId: null },
      select: { id: true, role: true, canUpload: true, adminScopes: true, username: true },
    });

    console.log(`\n👥 发现 ${usersToMigrate.length} 个未分配组的用户\n`);

    let defaultCount = 0;
    let uploaderCount = 0;
    let moderatorCount = 0;
    let fullAdminCount = 0;
    let ownerCount = 0;

    for (const user of usersToMigrate) {
      let targetGroupName: string;
      const scopes = (user.adminScopes as string[]) ?? [];

      if (user.role === "OWNER") {
        targetGroupName = "站长组";
        ownerCount++;
      } else if (user.role === "ADMIN") {
        const hasAllScopes = ALL_ADMIN_SCOPES.every((s) => scopes.includes(s));
        if (hasAllScopes) {
          targetGroupName = "全权管理组";
          fullAdminCount++;
        } else if (scopes.includes("video:moderate") || scopes.includes("comment:manage")) {
          targetGroupName = "内容审核组";
          moderatorCount++;
        } else {
          targetGroupName = "全权管理组";
          fullAdminCount++;
        }
      } else if (user.canUpload) {
        targetGroupName = "投稿用户组";
        uploaderCount++;
      } else {
        targetGroupName = "默认用户组";
        defaultCount++;
      }

      const targetGroupId = groupMap[targetGroupName];
      await prisma.user.update({
        where: { id: user.id },
        data: { groupId: targetGroupId },
      });
      console.log(`   ✓ ${user.username} (${user.role}) → ${targetGroupName}`);
    }

    console.log("\n📊 迁移统计：");
    console.log(`   默认用户组: ${defaultCount} 人`);
    console.log(`   投稿用户组: ${uploaderCount} 人`);
    console.log(`   内容审核组: ${moderatorCount} 人`);
    console.log(`   全权管理组: ${fullAdminCount} 人`);
    console.log(`   站长组: ${ownerCount} 人`);
    console.log(`\n✅ 用户组迁移完成！`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
