"use client";

import { useMemo, useSyncExternalStore } from "react";
import { md5 } from "@/lib/wasm-hash";

const QQ_EMAIL_RE = /^(\d{5,11})@qq\.com$/;

/**
 * 根据邮箱生成头像 URL（异步，WASM 加速 MD5）
 * - QQ 邮箱：使用 QQ 头像
 * - 其他邮箱：使用 WeAvatar（兼容 Gravatar）
 */
export async function getAvatarUrl(email: string | null | undefined, size = 80): Promise<string | undefined> {
  if (!email) return undefined;

  const normalizedEmail = email.toLowerCase().trim();

  const qqMatch = normalizedEmail.match(QQ_EMAIL_RE);
  if (qqMatch) {
    return `https://q1.qlogo.cn/g?b=qq&nk=${qqMatch[1]}&s=100`;
  }

  const hash = await md5(normalizedEmail);
  return `https://weavatar.com/avatar/${hash}?s=${size}&d=identicon`;
}

/**
 * React hook：根据邮箱异步生成头像 URL（WASM 加速）
 * 使用 useSyncExternalStore 避免 effect 中的 setState 问题。
 * 内置缓存，同一邮箱仅计算一次 MD5。
 */
const avatarCache = new Map<string, string>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function subscribeAvatarStore(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function resolveAvatarUrl(email: string, size: number): void {
  const key = `${email}|${size}`;
  if (avatarCache.has(key)) return;
  getAvatarUrl(email, size).then((result) => {
    if (result && !avatarCache.has(key)) {
      avatarCache.set(key, result);
      notifyListeners();
    }
  });
}

export function useAvatarUrl(email: string | null | undefined, size = 80): string | undefined {
  const key = email ? `${email}|${size}` : "";

  useMemo(() => {
    if (email) resolveAvatarUrl(email, size);
  }, [email, size]);

  return useSyncExternalStore(
    subscribeAvatarStore,
    () => (key ? avatarCache.get(key) : undefined),
    () => undefined,
  );
}
