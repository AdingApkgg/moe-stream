/**
 * canUpload 默认权限回填脚本
 *
 * 背景：将 User.canUpload 默认值改为 true（默认拥有发布权限，发布后进入 PENDING 待审）。
 * 本脚本为存量用户回填 canUpload = true，仅跳过已封禁用户。
 *
 * 运行方式:
 *   开发环境: npx tsx scripts/migrate-can-upload.ts
 *   生产环境: NODE_ENV=production npx tsx scripts/migrate-can-upload.ts
 */

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production" });
} else {
  dotenv.config({ path: ".env.development" });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 开始回填 canUpload 字段...\n");

  const target = await prisma.user.count({
    where: { canUpload: false, isBanned: false },
  });
  const skipped = await prisma.user.count({
    where: { canUpload: false, isBanned: true },
  });

  console.log(`📊 待回填用户：${target} 个`);
  console.log(`⏭️  跳过封禁用户：${skipped} 个\n`);

  if (target === 0) {
    console.log("✅ 无需回填，所有非封禁用户都已具备发布权限。");
    return;
  }

  const result = await prisma.user.updateMany({
    where: { canUpload: false, isBanned: false },
    data: { canUpload: true },
  });

  console.log(`✅ 已为 ${result.count} 个用户开启发布权限`);
  console.log("\n提示：用户发布后默认进入 PENDING 待审，可在管理后台审核。");
}

main()
  .catch((err) => {
    console.error("❌ 迁移失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
