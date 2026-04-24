"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { useIsTMA } from "@/hooks/use-tma";
import { getTelegramWebApp } from "@/lib/telegram";

/**
 * TMA 自动登录：在 Telegram Mini App 内打开且尚未登录时，
 * 自动用 `window.Telegram.WebApp.initData` 调 `/api/auth/sign-in/telegram` 完成登录。
 *
 * - 每次页面加载只尝试一次；失败不重试（下次刷新再试）
 * - 成功后整页 reload，确保 server components 拿到新的 session cookie
 * - 无 UI
 */
export function TmaAutoLogin() {
  const isTMA = useIsTMA();
  const { status } = useSession();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!isTMA) return;
    if (status !== "unauthenticated") return;
    if (triedRef.current) return;

    const webApp = getTelegramWebApp();
    const initData = webApp?.initData;
    if (!initData) return;

    triedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/sign-in/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
          credentials: "include",
        });
        if (res.ok) {
          window.location.reload();
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        console.warn("[auth] TMA auto sign-in failed:", res.status, data.message);
      } catch (err) {
        console.error("[auth] TMA auto sign-in error:", err);
      }
    })();
  }, [isTMA, status]);

  return null;
}
