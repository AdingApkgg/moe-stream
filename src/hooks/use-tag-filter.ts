"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface UseTagFilterOptions {
  /** URL 参数名（默认 tags） */
  paramName?: string;
  /** 排除标签 URL 参数名（默认 exclude） */
  excludeParamName?: string;
}

/**
 * 多标签筛选 hook（AND + 排除），状态同步到 URL。
 *
 * - 左键点击标签 → 加入 / 移除筛选（AND 逻辑）
 * - 右键点击标签 → 加入 / 移除排除列表
 */
export function useTagFilter(opts: UseTagFilterOptions = {}) {
  const { paramName = "tags", excludeParamName = "exclude" } = opts;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedSlugs = useMemo(() => {
    const raw = searchParams.get(paramName);
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams, paramName]);

  const excludedSlugs = useMemo(() => {
    const raw = searchParams.get(excludeParamName);
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams, excludeParamName]);

  // 当 URL 有标签参数时通过 URL 驱动；否则用本地 state 做 fallback
  // 使用 selectedTagId 保持向后兼容单标签模式
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const updateUrl = useCallback(
    (slugs: string[], excluded: string[]) => {
      const params = new URLSearchParams(searchParams.toString());

      // 重置页码
      params.delete("page");

      if (slugs.length > 0) {
        params.set(paramName, slugs.join(","));
      } else {
        params.delete(paramName);
      }

      if (excluded.length > 0) {
        params.set(excludeParamName, excluded.join(","));
      } else {
        params.delete(excludeParamName);
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname, paramName, excludeParamName],
  );

  /** 切换标签的 AND 筛选状态 */
  const toggleTag = useCallback(
    (slug: string) => {
      const next = selectedSlugs.includes(slug)
        ? selectedSlugs.filter((s) => s !== slug)
        : [...selectedSlugs, slug];

      // 如果正在排除，从排除列表移除
      const nextExcluded = excludedSlugs.filter((s) => s !== slug);

      updateUrl(next, nextExcluded);
    },
    [selectedSlugs, excludedSlugs, updateUrl],
  );

  /** 切换标签的排除状态 */
  const toggleExclude = useCallback(
    (slug: string) => {
      const nextExcluded = excludedSlugs.includes(slug)
        ? excludedSlugs.filter((s) => s !== slug)
        : [...excludedSlugs, slug];

      // 如果正在选择，从选择列表移除
      const nextSelected = selectedSlugs.filter((s) => s !== slug);

      updateUrl(nextSelected, nextExcluded);
    },
    [selectedSlugs, excludedSlugs, updateUrl],
  );

  /** 清除所有筛选 */
  const clearAll = useCallback(() => {
    updateUrl([], []);
    setSelectedTagId(null);
  }, [updateUrl]);

  /** 标签是否被选中 */
  const isSelected = useCallback(
    (slug: string) => selectedSlugs.includes(slug),
    [selectedSlugs],
  );

  /** 标签是否被排除 */
  const isExcluded = useCallback(
    (slug: string) => excludedSlugs.includes(slug),
    [excludedSlugs],
  );

  const hasFilter = selectedSlugs.length > 0 || excludedSlugs.length > 0;

  return {
    selectedSlugs,
    excludedSlugs,
    selectedTagId,
    setSelectedTagId,
    toggleTag,
    toggleExclude,
    clearAll,
    isSelected,
    isExcluded,
    hasFilter,
  };
}
