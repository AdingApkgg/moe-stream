"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback } from "react";

/**
 * 将分页状态同步到 URL search params，浏览器返回时自动恢复页码。
 * 内部用 React state 驱动渲染，replaceState 同步 URL（不触发路由导航）。
 *
 * @param key - search param 名称，默认 "page"；同页面多分页器可传不同 key
 */
export function usePageParam(key = "page"): [number, (page: number) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [page, setPageState] = useState(() => {
    const val = searchParams.get(key);
    const n = val ? parseInt(val, 10) : 1;
    return isNaN(n) || n < 1 ? 1 : n;
  });

  const setPage = useCallback(
    (newPage: number) => {
      setPageState(newPage);
      const params = new URLSearchParams(window.location.search);
      if (newPage <= 1) {
        params.delete(key);
      } else {
        params.set(key, String(newPage));
      }
      const qs = params.toString();
      window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
    },
    [key, pathname],
  );

  return [page, setPage];
}
