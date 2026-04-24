"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Telegram Login Widget 回调页。
 *
 * oauth.telegram.org 校验通过后回到这里，用户数据有两种载体：
 * - **新版**：URL fragment `#tgAuthResult=<base64url(JSON)>`（`oauth.telegram.org` 当前主要行为）
 * - **旧版**：URL query `?id=..&first_name=..&hash=..`（一些老 flow 仍在用）
 *
 * 我们两种都兼容。按 query 里的 `intent` 分两种后端流程：
 * - `intent=link`：POST 到 /api/auth/link/telegram，为当前登录用户绑定 TG 账号
 * - 其他（默认）：POST 到 /api/auth/sign-in/telegram，完成登录并建会话
 */

const WIDGET_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"] as const;

/** Base64url → UTF-8 字符串（浏览器端）；无效输入返回 null */
function decodeBase64Url(s: string): string | null {
  try {
    const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

/** 从 URL fragment 提取 `tgAuthResult`，解码后展平为字符串字典 */
function widgetFromHash(hash: string): Record<string, string> | null {
  const m = hash.match(/[#&]tgAuthResult=([^&]+)/);
  if (!m) return null;
  const json = decodeBase64Url(decodeURIComponent(m[1]));
  if (!json) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.id == null || !obj.hash) return null;
  // id / auth_date 在 JSON 里是 number；后端 HMAC 按字符串拼接，这里统一转 string。
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}

/** 从 URL query 提取 widget 字段（旧版 login widget 格式） */
function widgetFromQuery(params: URLSearchParams): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const f of WIDGET_FIELDS) {
    const v = params.get(f);
    if (v !== null) out[f] = v;
  }
  if (!out.id || !out.hash) return null;
  return out;
}

type State = { kind: "loading" } | { kind: "error"; message: string };

export default function TelegramCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  const intent = searchParams.get("intent") === "link" ? "link" : "signIn";
  const callbackURL = searchParams.get("callbackURL") || (intent === "link" ? "/settings/account" : "/");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 优先 fragment（主流），fallback 到 query（兼容）
      const widget =
        (typeof window !== "undefined" ? widgetFromHash(window.location.hash) : null) ??
        widgetFromQuery(new URLSearchParams(searchParams.toString()));

      if (!widget) {
        if (!cancelled) setState({ kind: "error", message: "Telegram 回调参数不完整" });
        return;
      }

      const endpoint = intent === "link" ? "/api/auth/link/telegram" : "/api/auth/sign-in/telegram";
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widget, callbackURL }),
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
          if (intent === "link") {
            // 把错误码带回 settings 页，由其 LINK_ERROR_MESSAGES 渲染
            const target = new URL(callbackURL, window.location.origin);
            target.searchParams.set("link_error", "1");
            if (data.error) target.searchParams.set("error", data.error);
            window.location.assign(target.toString());
            return;
          }
          setState({ kind: "error", message: data.message || `登录失败（HTTP ${res.status}）` });
          return;
        }
        window.location.assign(callbackURL);
      } catch (err) {
        if (cancelled) return;
        console.error("[telegram-callback] error:", err);
        setState({ kind: "error", message: "网络错误，请稍后重试" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, intent, callbackURL]);

  const isLinkFlow = intent === "link";

  if (state.kind === "error") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">{isLinkFlow ? "Telegram 绑定失败" : "Telegram 登录失败"}</h1>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button onClick={() => router.push(isLinkFlow ? "/settings/account" : "/login")}>
          {isLinkFlow ? "返回设置" : "返回登录"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{isLinkFlow ? "正在绑定 Telegram…" : "正在完成 Telegram 登录…"}</p>
    </div>
  );
}
