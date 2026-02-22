import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "../src/lib/bcrypt-wasm";
import { config } from "dotenv";
import path from "node:path";

// 动态加载环境变量
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
config({ path: path.join(__dirname, "..", envFile) });

// 站长用户配置 - 通过环境变量设置，或在 .env 文件中配置
const OWNER_CONFIG = {
  email: process.env.OWNER_EMAIL || "admin@example.com",
  username: process.env.OWNER_USERNAME || "admin",
  password: process.env.OWNER_PASSWORD || "changeme123",
  nickname: process.env.OWNER_NICKNAME || "Admin",
};

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  console.log("Creating owner user...");

  try {
    // 检查是否已存在
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: OWNER_CONFIG.email },
          { username: OWNER_CONFIG.username },
        ],
      },
    });

    if (existing) {
      console.log(`User already exists: ${existing.email} (${existing.username})`);
      console.log(`Current role: ${existing.role}`);
      
      // 如果存在但不是 OWNER，升级为 OWNER
      if (existing.role !== "OWNER") {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: "OWNER" },
        });
        console.log("Upgraded to OWNER role!");
      }
      return;
    }

    // 加密密码
    const hashedPassword = await hash(OWNER_CONFIG.password, 12);

    // 创建站长用户
    const owner = await prisma.user.create({
      data: {
        email: OWNER_CONFIG.email,
        username: OWNER_CONFIG.username,
        password: hashedPassword,
        nickname: OWNER_CONFIG.nickname,
        role: "OWNER",
        emailVerified: new Date(), // 站长账号默认已验证
      },
    });

    console.log("Owner user created successfully!");
    console.log(`  Email: ${owner.email}`);
    console.log(`  Username: ${owner.username}`);
    console.log(`  Role: ${owner.role}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
