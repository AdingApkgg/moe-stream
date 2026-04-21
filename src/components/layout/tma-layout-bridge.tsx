"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsTMA, useTelegramWebApp } from "@/hooks/use-tma";

/**
 * 把 Next.js 路由与 Telegram Mini App 原生 BackButton 桥接：
 * - 非首页时显示 TG BackButton，点击调 router.back()
 * - 首页隐藏 BackButton
 * - 组件卸载时清理监听，避免离开 TMA 后仍绑定
 *
 * 纯副作用组件，无渲染。放在 AppLayout 内即可。
 */
export function TmaLayoutBridge() {
  const isTMA = useIsTMA();
  const tg = useTelegramWebApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isTMA || !tg) return;

    const handleBack = () => {
      // 优先用 history.back 保证浏览器回退栈一致；router.back 是对它的包装
      router.back();
    };

    const isHome = pathname === "/" || pathname === "";
    if (isHome) {
      tg.BackButton.hide();
      return;
    }

    tg.BackButton.onClick(handleBack);
    tg.BackButton.show();

    return () => {
      try {
        tg.BackButton.offClick(handleBack);
        tg.BackButton.hide();
      } catch {
        // ignore
      }
    };
  }, [isTMA, tg, pathname, router]);

  return null;
}
