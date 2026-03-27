import { prisma } from "@/lib/prisma";

const CHUNK_SIZE = 20;

async function chunked<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    await Promise.all(items.slice(i, i + CHUNK_SIZE).map(fn));
  }
}

async function refreshOne(tagId: string): Promise<void> {
  const [videoCount, gameCount, imagePostCount] = await Promise.all([
    prisma.tagOnVideo.count({ where: { tagId } }),
    prisma.tagOnGame.count({ where: { tagId } }),
    prisma.tagOnImagePost.count({ where: { tagId } }),
  ]);

  await prisma.tag.update({
    where: { id: tagId },
    data: { videoCount, gameCount, imagePostCount },
  });
}

/**
 * 更新指定标签的预计算使用统计。
 * 在内容创建/更新/删除后调用，传入受影响的 tagId 列表。
 */
export async function refreshTagCounts(tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  const unique = [...new Set(tagIds)];
  await chunked(unique, refreshOne);
}

/**
 * 全量重算所有标签的使用统计。
 * 用于数据迁移或手动修复场景。
 */
export async function refreshAllTagCounts(): Promise<number> {
  const tags = await prisma.tag.findMany({ select: { id: true } });
  await chunked(
    tags.map((t) => t.id),
    refreshOne,
  );
  return tags.length;
}

/**
 * 解析蕴含关系并返回扩展后的 tagId 列表（浅展开，仅一层）。
 * 例如：添加标签 A，而 A implies B，则返回 [A, B]。
 * 注意：不会递归展开（即 B implies C 时不会自动包含 C）。
 */
export async function expandImplications(tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];

  const implications = await prisma.tagImplication.findMany({
    where: { sourceTagId: { in: tagIds } },
    select: { targetTagId: true },
  });

  const expanded = new Set(tagIds);
  for (const impl of implications) {
    expanded.add(impl.targetTagId);
  }

  return [...expanded];
}
