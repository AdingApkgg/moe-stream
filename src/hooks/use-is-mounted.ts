"use client";

import { useIsMounted as useIsMountedFn } from "usehooks-ts";

/**
 * 客户端挂载检测 Hook
 * 纯 React hook，不依赖 framer-motion，避免不必要的 bundle 开销
 */
export function useIsMounted(): boolean {
  const isMountedFn = useIsMountedFn();
  return isMountedFn();
}
