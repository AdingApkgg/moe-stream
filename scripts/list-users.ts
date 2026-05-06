import { config } from "dotenv";
config({ path: ".env.development" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
  const p = new PrismaClient({ adapter });
  const users = await p.user.findMany({
    select: { id: true, username: true, nickname: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  console.table(users);
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
