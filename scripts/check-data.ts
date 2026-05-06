import { config } from "dotenv";
config({ path: ".env.development" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
  const p = new PrismaClient({ adapter });
  const [v, i, g, t, u] = await Promise.all([
    p.video.count({ where: { status: "PUBLISHED" } }),
    p.imagePost.count({ where: { status: "PUBLISHED" } }),
    p.game.count({ where: { status: "PUBLISHED" } }),
    p.tag.count(),
    p.user.count(),
  ]);
  const gameAuthors = await p.$queryRaw<Array<{ c: number }>>`
    SELECT COUNT(DISTINCT "extraInfo"->>'originalAuthor')::int AS c
    FROM "Game"
    WHERE status = 'PUBLISHED'
      AND "extraInfo" ? 'originalAuthor'
      AND "extraInfo"->>'originalAuthor' <> ''
  `;
  const videoAuthors = await p.$queryRaw<Array<{ c: number }>>`
    SELECT COUNT(DISTINCT "extraInfo"->>'author')::int AS c
    FROM "Video"
    WHERE status = 'PUBLISHED'
      AND "extraInfo" ? 'author'
      AND "extraInfo"->>'author' <> ''
  `;
  console.log({
    videos: v,
    imagePosts: i,
    games: g,
    tags: t,
    users: u,
    distinctVideoAuthors: videoAuthors[0]?.c ?? 0,
    distinctGameAuthors: gameAuthors[0]?.c ?? 0,
  });
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
