"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * 检测用户是否开启"减少动画"偏好
 * 使用 useSyncExternalStore 订阅 matchMedia，无 cascading render 开销
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
