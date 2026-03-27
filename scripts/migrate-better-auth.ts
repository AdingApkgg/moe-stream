/**
 * Better Auth 数据迁移脚本
 *
 * 为所有用户执行以下操作：
 * 1. 创建 credential Account 记录（将 User.password 复制到 Account.password）
 * 2. 将 username 改为小写（Better Auth username 插件要求），原始大小写存入 displayUsername
 *
 * 运行方式:
 *   开发环境: npx tsx scripts/migrate-better-auth.ts
 *   生产环境: NODE_ENV=production npx tsx scripts/migrate-better-auth.ts
 */

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// 根据 NODE_ENV 加载环境变量
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
  console.log("🔄 开始 Better Auth 数据迁移...\n");

  // 获取所有用户
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      displayUsername: true,
      password: true,
      role: true,
    },
  });

  console.log(`📋 共找到 ${users.length} 个用户\n`);

  let accountCreated = 0;
  let usernameFixed = 0;
  let emailFixed = 0;
  let skipped = 0;

  for (const user of users) {
    const changes: string[] = [];

    // 1. 检查并创建 credential Account
    if (user.password) {
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: "credential" },
      });

      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "credential",
            provider: "credential",
            providerAccountId: user.id,
            password: user.password,
          },
        });
        accountCreated++;
        changes.push("创建 credential Account");
      }
    }

    // 2. 规范化 username：小写存 username，原始大小写存 displayUsername
    const lowerUsername = user.username.toLowerCase();
    if (user.username !== lowerUsername || !user.displayUsername) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: lowerUsername,
          displayUsername: user.displayUsername || user.username,
        },
      });
      usernameFixed++;
      changes.push(`username: ${user.username} → ${lowerUsername}`);
    }

    // 3. 规范化 email：Better Auth 用 email.toLowerCase() 查询，数据库必须小写
    const lowerEmail = user.email.toLowerCase();
    if (user.email !== lowerEmail) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: lowerEmail },
      });
      emailFixed++;
      changes.push(`email: ${user.email} → ${lowerEmail}`);
    }

    if (changes.length > 0) {
      console.log(`  ✅ ${user.username} (${user.role}): ${changes.join(", ")}`);
    } else {
      skipped++;
    }
  }

  console.log("\n📊 迁移完成:");
  console.log(`  - 创建 credential Account: ${accountCreated}`);
  console.log(`  - 修复 username 大小写: ${usernameFixed}`);
  console.log(`  - 修复 email 大小写: ${emailFixed}`);
  console.log(`  - 无需修改: ${skipped}`);
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
