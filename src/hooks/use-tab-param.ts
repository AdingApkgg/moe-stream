"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback } from "react";

/**
 * 将 Tab 状态同步到 URL search params，刷新/分享链接时自动恢复选中 Tab。
 * 切换 Tab 时会重置同页面的分页参数。
 */
export function useTabParam<T extends string>(
  defaultValue: T,
  key = "tab",
): [T, (tab: T) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [tab, setTabState] = useState<T>(() => {
    const val = searchParams.get(key);
    return (val as T) || defaultValue;
  });

  const setTab = useCallback(
    (newTab: T) => {
      setTabState(newTab);
      const params = new URLSearchParams(window.location.search);
      if (newTab === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, newTab);
      }
      params.delete("page");
      params.delete("gp");
      params.delete("ip");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${pathname}${qs ? `?${qs}` : ""}`,
      );
    },
    [key, defaultValue, pathname],
  );

  return [tab, setTab];
}
