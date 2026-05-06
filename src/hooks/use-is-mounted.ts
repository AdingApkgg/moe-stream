"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 客户端挂载检测 Hook
 * 用 useSyncExternalStore 实现：SSR 返回 false，客户端 hydration 后返回 true
 * 不读取 ref，不在 effect 里 setState，符合 React Compiler 规范
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
