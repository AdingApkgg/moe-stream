"use client";

import { useSyncExternalStore } from "react";
import { isTmaEnvironment, getTelegramWebApp, type TelegramWebApp } from "@/lib/telegram";

/**
 * 订阅 Telegram WebApp 就绪事件，用于 useSyncExternalStore。
 * TmaBootstrap 在检测到 SDK 后会派发 tma:ready 自定义事件。
 */
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("tma:ready", cb);
  window.addEventListener("tma:viewport-changed", cb);
  window.addEventListener("tma:theme-changed", cb);
  return () => {
    window.removeEventListener("tma:ready", cb);
    window.removeEventListener("tma:viewport-changed", cb);
    window.removeEventListener("tma:theme-changed", cb);
  };
}

/**
 * 判断当前是否在 Telegram Mini App 环境内。
 *
 * SSR 默认返回 false，客户端挂载后才会返回真实值。
 * 依赖 TmaBootstrap 组件先行加载 Telegram SDK。
 */
export function useIsTMA(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isTmaEnvironment(),
    () => false,
  );
}

/**
 * 获取 Telegram WebApp 实例（响应式），未进入 TMA 时为 null。
 */
export function useTelegramWebApp(): TelegramWebApp | null {
  return useSyncExternalStore(
    subscribe,
    () => (isTmaEnvironment() ? getTelegramWebApp() : null),
    () => null,
  );
}
