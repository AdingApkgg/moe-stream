-- 搜索性能：pg_trgm GIN 索引，加速 ILIKE '%关键词%'（Prisma contains + insensitive）
-- 在已通过 db push / 迁移建好表的数据库上执行：pnpm db:search-indexes
-- 需 CREATE EXTENSION 权限；生产大表可改为 CREATE INDEX CONCURRENTLY 单独跑
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Video_title_trgm_idx" ON "Video" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Video_description_trgm_idx" ON "Video" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Game_title_trgm_idx" ON "Game" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Game_description_trgm_idx" ON "Game" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ImagePost_title_trgm_idx" ON "ImagePost" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ImagePost_description_trgm_idx" ON "ImagePost" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Tag_name_trgm_idx" ON "Tag" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "TagAlias_name_trgm_idx" ON "TagAlias" USING gin ("name" gin_trgm_ops);
