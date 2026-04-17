import { Prisma } from "@/generated/prisma/client";
import { splitSearchTokens } from "@/lib/search-text";

const insensitive = Prisma.QueryMode.insensitive;

/**
 * 视频/游戏/图帖：每个分词须至少命中标题、描述或任一标签名之一（分词之间 AND）。
 * 返回可放入 where.AND 的片段；无有效关键词时返回 undefined。
 *
 * 注意：**游戏列表**应改用 `buildGameSearchWhere` / `mergeGameSearchIntoWhere`，
 * 以额外命中 `GameAlias.name`（原作名 / 缩写 / 昵称）。
 */
export function buildContentSearchWhere(search: string | undefined | null): Prisma.VideoWhereInput | undefined {
  const tokens = search ? splitSearchTokens(search) : [];
  if (tokens.length === 0) return undefined;

  const tokenClause = (token: string): Prisma.VideoWhereInput => ({
    OR: [
      { title: { contains: token, mode: insensitive } },
      { description: { contains: token, mode: insensitive } },
      { tags: { some: { tag: { name: { contains: token, mode: insensitive } } } } },
    ],
  });

  if (tokens.length === 1) return tokenClause(tokens[0]!);
  return { AND: tokens.map(tokenClause) };
}

/**
 * 游戏专用：在 content 搜索基础上再命中 `GameAlias.name`（原作名 / 缩写 / 昵称）。
 */
export function buildGameSearchWhere(search: string | undefined | null): Prisma.GameWhereInput | undefined {
  const tokens = search ? splitSearchTokens(search) : [];
  if (tokens.length === 0) return undefined;

  const tokenClause = (token: string): Prisma.GameWhereInput => ({
    OR: [
      { title: { contains: token, mode: insensitive } },
      { description: { contains: token, mode: insensitive } },
      { tags: { some: { tag: { name: { contains: token, mode: insensitive } } } } },
      { aliases: { some: { name: { contains: token, mode: insensitive } } } },
    ],
  });

  if (tokens.length === 1) return tokenClause(tokens[0]!);
  return { AND: tokens.map(tokenClause) };
}

/**
 * 标签：每个分词须命中主名或任一别名（分词之间 AND）。
 */
export function buildTagSearchWhere(search: string | undefined | null): Prisma.TagWhereInput | undefined {
  const tokens = search ? splitSearchTokens(search) : [];
  if (tokens.length === 0) return undefined;

  const tokenClause = (token: string): Prisma.TagWhereInput => ({
    OR: [
      { name: { contains: token, mode: insensitive } },
      { aliases: { some: { name: { contains: token, mode: insensitive } } } },
    ],
  });

  if (tokens.length === 1) return tokenClause(tokens[0]!);
  return { AND: tokens.map(tokenClause) };
}

function mergeAnd<T extends { AND?: unknown }>(baseWhere: T, clause: unknown): T {
  const existingAnd = baseWhere.AND as unknown;
  const andArray = Array.isArray(existingAnd)
    ? [...(existingAnd as unknown[])]
    : existingAnd !== undefined
      ? [existingAnd]
      : [];
  return { ...baseWhere, AND: [...andArray, clause] } as T;
}

/** 把内容搜索条件并入已有 where（与 tagSlugs 等 AND 共存）。游戏请使用 mergeGameSearchIntoWhere。 */
export function mergeContentSearchIntoWhere(
  baseWhere: Prisma.VideoWhereInput,
  search: string | undefined | null,
): Prisma.VideoWhereInput;
export function mergeContentSearchIntoWhere(
  baseWhere: Prisma.GameWhereInput,
  search: string | undefined | null,
): Prisma.GameWhereInput;
export function mergeContentSearchIntoWhere(
  baseWhere: Prisma.ImagePostWhereInput,
  search: string | undefined | null,
): Prisma.ImagePostWhereInput;
export function mergeContentSearchIntoWhere(
  baseWhere: Prisma.VideoWhereInput | Prisma.GameWhereInput | Prisma.ImagePostWhereInput,
  search: string | undefined | null,
): Prisma.VideoWhereInput | Prisma.GameWhereInput | Prisma.ImagePostWhereInput {
  const clause = buildContentSearchWhere(search);
  if (!clause) return baseWhere;
  return mergeAnd(baseWhere, clause);
}

/** 游戏列表专用：把带 alias 的搜索条件合入已有 where */
export function mergeGameSearchIntoWhere(
  baseWhere: Prisma.GameWhereInput,
  search: string | undefined | null,
): Prisma.GameWhereInput {
  const clause = buildGameSearchWhere(search);
  if (!clause) return baseWhere;
  return mergeAnd(baseWhere, clause);
}

/** 把标签搜索条件并入已有 where */
export function mergeTagSearchIntoWhere(baseWhere: Prisma.TagWhereInput, search: string | undefined | null) {
  const clause = buildTagSearchWhere(search);
  if (!clause) return baseWhere;
  return mergeAnd(baseWhere, clause);
}
