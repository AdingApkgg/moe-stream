"use client";

import { useCallback, useMemo } from "react";
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

  const updateUrl = useCallback(
    (slugs: string[], excluded: string[]) => {
      const params = new URLSearchParams(searchParams.toString());

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

  const toggleTag = useCallback(
    (slug: string) => {
      const next = selectedSlugs.includes(slug) ? selectedSlugs.filter((s) => s !== slug) : [...selectedSlugs, slug];

      const nextExcluded = excludedSlugs.filter((s) => s !== slug);

      updateUrl(next, nextExcluded);
    },
    [selectedSlugs, excludedSlugs, updateUrl],
  );

  const toggleExclude = useCallback(
    (slug: string) => {
      const nextExcluded = excludedSlugs.includes(slug)
        ? excludedSlugs.filter((s) => s !== slug)
        : [...excludedSlugs, slug];

      const nextSelected = selectedSlugs.filter((s) => s !== slug);

      updateUrl(nextSelected, nextExcluded);
    },
    [selectedSlugs, excludedSlugs, updateUrl],
  );

  const clearAll = useCallback(() => {
    updateUrl([], []);
  }, [updateUrl]);

  const isSelected = useCallback((slug: string) => selectedSlugs.includes(slug), [selectedSlugs]);

  const isExcluded = useCallback((slug: string) => excludedSlugs.includes(slug), [excludedSlugs]);

  const hasFilter = selectedSlugs.length > 0 || excludedSlugs.length > 0;

  return {
    selectedSlugs,
    excludedSlugs,
    toggleTag,
    toggleExclude,
    clearAll,
    isSelected,
    isExcluded,
    hasFilter,
  };
}
