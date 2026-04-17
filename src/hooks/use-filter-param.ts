"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useState, useCallback } from "react";

const PAGE_KEYS = ["page", "gp", "ip"] as const;

/**
 * 将枚举筛选（排序、时间范围等）同步到 URL，切换时重置分页参数。
 */
export function useSearchEnumParam<T extends string>(
  key: string,
  defaultValue: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [value, setValueState] = useState<T>(() => {
    const raw = searchParams.get(key);
    return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : defaultValue;
  });

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      const params = new URLSearchParams(window.location.search);
      if (next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      for (const pk of PAGE_KEYS) {
        params.delete(pk);
      }
      const qs = params.toString();
      window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
    },
    [key, defaultValue, pathname],
  );

  return [value, setValue];
}
