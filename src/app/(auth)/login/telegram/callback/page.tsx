"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Telegram Login Widget 回调页。
 *
 * oauth.telegram.org 校验通过后会以 GET 形式重定向到这里，将 user 字段作为 query 参数：
 *   id, first_name, last_name?, username?, photo_url?, auth_date, hash
 *
 * 本页只负责：
 * 1. 读取 query 参数 → POST 到 /api/auth/sign-in/telegram 完成验签 + 建会话
 * 2. 成功则跳转到 callbackURL（默认 /），失败则显示错误并返回登录页
 */

const WIDGET_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"] as const;

export default function TelegramCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 同步解析 query 参数，避免在 effect 里调用 setState 产生级联渲染
  const parsed = useMemo(() => {
    const widget: Record<string, string> = {};
    for (const field of WIDGET_FIELDS) {
      const value = searchParams.get(field);
      if (value !== null) widget[field] = value;
    }
    if (!widget.id || !widget.hash) {
      return { widget: null, callbackURL: "/" } as const;
    }
    return { widget, callbackURL: searchParams.get("callbackURL") || "/" } as const;
  }, [searchParams]);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!parsed.widget) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/sign-in/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widget: parsed.widget, callbackURL: parsed.callbackURL }),
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          setFetchError(data.message || `登录失败（HTTP ${res.status}）`);
          return;
        }
        window.location.assign(parsed.callbackURL);
      } catch (err) {
        if (cancelled) return;
        console.error("[telegram-callback] error:", err);
        setFetchError("网络错误，请稍后重试");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed]);

  const error = parsed.widget ? fetchError : "Telegram 回调参数不完整";

  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Telegram 登录失败</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => router.push("/login")}>返回登录</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">正在完成 Telegram 登录…</p>
    </div>
  );
}
