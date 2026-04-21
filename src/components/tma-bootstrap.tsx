"use client";

import { useEffect } from "react";
import Script from "next/script";
import { getTelegramWebApp, isTmaEnvironment } from "@/lib/telegram";

const TELEGRAM_SDK_URL = "https://telegram.org/js/telegram-web-app.js";

/**
 * Telegram Mini App (TMA) 引导层：
 *
 * 1. 加载官方 telegram-web-app.js（全局注入 window.Telegram.WebApp）
 * 2. 检测到 TMA 环境后调用 ready() + expand() 全屏展开
 * 3. 同步 Telegram 主题参数到 CSS 变量（`--tg-viewport-height`、`--tg-bottom-safe-area` 等）
 * 4. 给 <html> 加上 `data-tma` 属性，用于 CSS 条件样式
 * 5. 派发 `tma:ready` / `tma:viewport-changed` / `tma:theme-changed` 自定义事件，
 *    供 useIsTMA / useTelegramWebApp 订阅
 *
 * 非 TMA 环境下本组件几乎无副作用（只多一个 script 下载），不会破坏网页体验。
 */
export function TmaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const setHtmlFlag = (enabled: boolean) => {
      if (enabled) {
        document.documentElement.setAttribute("data-tma", "1");
      } else {
        document.documentElement.removeAttribute("data-tma");
      }
    };

    const updateViewportVars = () => {
      const tg = getTelegramWebApp();
      if (!tg) return;
      const root = document.documentElement;
      root.style.setProperty("--tg-viewport-height", `${tg.viewportHeight}px`);
      root.style.setProperty("--tg-viewport-stable-height", `${tg.viewportStableHeight}px`);
      // TMA 底部有 Close/MainButton 原生区域，stableHeight 已经排除了它们，
      // 但某些平台会因软键盘导致 viewportHeight 变小，这里取差值给业务侧用
      const diff = Math.max(0, tg.viewportHeight - tg.viewportStableHeight);
      root.style.setProperty("--tg-bottom-safe-area", `${diff}px`);
      window.dispatchEvent(new CustomEvent("tma:viewport-changed"));
    };

    const updateThemeVars = () => {
      const tg = getTelegramWebApp();
      if (!tg) return;
      const root = document.documentElement;
      const theme = tg.themeParams;
      const setVar = (key: string, value?: string) => {
        if (value) root.style.setProperty(key, value);
      };
      setVar("--tg-bg-color", theme.bg_color);
      setVar("--tg-text-color", theme.text_color);
      setVar("--tg-hint-color", theme.hint_color);
      setVar("--tg-link-color", theme.link_color);
      setVar("--tg-button-color", theme.button_color);
      setVar("--tg-button-text-color", theme.button_text_color);
      setVar("--tg-secondary-bg-color", theme.secondary_bg_color);

      if (tg.colorScheme) {
        root.setAttribute("data-tma-scheme", tg.colorScheme);
      }
      window.dispatchEvent(new CustomEvent("tma:theme-changed"));
    };

    const onSdkReady = () => {
      const tg = getTelegramWebApp();
      if (!tg) return;
      if (!isTmaEnvironment()) {
        // SDK 已加载但不是真正的 TMA 环境（如桌面 Telegram 的空 initData），
        // 不做任何副作用
        return;
      }

      setHtmlFlag(true);
      try {
        tg.ready();
        tg.expand();
      } catch (err) {
        console.warn("[TMA] ready/expand failed:", err);
      }

      updateViewportVars();
      updateThemeVars();

      tg.onEvent("viewportChanged", updateViewportVars);
      tg.onEvent("themeChanged", updateThemeVars);

      window.dispatchEvent(new CustomEvent("tma:ready"));
    };

    // 如果脚本已经加载（热更新或导航回来），立即执行；否则等待 onLoad 派发
    if (window.Telegram?.WebApp) {
      onSdkReady();
    } else {
      window.addEventListener("tma:sdk-loaded", onSdkReady, { once: true });
    }

    return () => {
      window.removeEventListener("tma:sdk-loaded", onSdkReady);
      const tg = getTelegramWebApp();
      if (tg) {
        try {
          tg.offEvent("viewportChanged", updateViewportVars);
          tg.offEvent("themeChanged", updateThemeVars);
        } catch {
          // ignore
        }
      }
      setHtmlFlag(false);
    };
  }, []);

  return (
    <Script
      src={TELEGRAM_SDK_URL}
      strategy="afterInteractive"
      onLoad={() => {
        window.dispatchEvent(new CustomEvent("tma:sdk-loaded"));
      }}
    />
  );
}
