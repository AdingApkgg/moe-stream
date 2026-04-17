/** 纯字符串/高亮逻辑，可在 Client Component 中安全导入（勿在此文件引入 Prisma） */

/** 将搜索串拆成用于 AND 匹配的分词（空格分隔） */
export function splitSearchTokens(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export type HighlightSegment = { text: string; hit: boolean };

/**
 * 按搜索关键词（支持多词、忽略大小写）将文本切成高亮片段；用于卡片标题/摘要。
 */
export function buildHighlightSegments(text: string, query: string | undefined | null): HighlightSegment[] {
  if (!text) return [{ text: "", hit: false }];
  const tokens = splitSearchTokens(query ?? "");
  if (tokens.length === 0) return [{ text, hit: false }];

  const lower = text.toLowerCase();
  const intervals: [number, number][] = [];

  for (const token of tokens) {
    const lt = token.toLowerCase();
    if (lt.length === 0) continue;
    let i = 0;
    while (i <= lower.length - lt.length) {
      const idx = lower.indexOf(lt, i);
      if (idx === -1) break;
      intervals.push([idx, idx + lt.length]);
      i = idx + 1;
    }
  }

  if (intervals.length === 0) return [{ text, hit: false }];

  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of intervals) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1]) merged.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }

  const out: HighlightSegment[] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

/** 建议排序：精确匹配 > 前缀 > 子串（均不区分大小写） */
export function suggestionTextRank(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  return 0;
}
