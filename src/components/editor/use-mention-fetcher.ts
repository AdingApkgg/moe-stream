"use client";

import { useCallback } from "react";
import { trpc } from "@/lib/trpc";
import type { MentionFetcher } from "./extensions/mention";

/** 用 trpc utils 返回一个可在 Tiptap suggestion 内使用的 @mention 取数函数。*/
export function useMentionFetcher(): MentionFetcher {
  const utils = trpc.useUtils();

  return useCallback<MentionFetcher>(
    async (query) => {
      const q = query.trim();
      if (!q) return [];
      try {
        const result = await utils.user.search.fetch({ query: q, limit: 8 });
        return result.users.map((u) => ({
          id: u.id,
          label: u.nickname || u.username,
          username: u.username,
          avatar: u.avatar ?? null,
        }));
      } catch {
        return [];
      }
    },
    [utils],
  );
}
