"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

interface DraftEnvelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

const DRAFT_VERSION = 1;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

export interface UseFormDraftOptions<T> {
  /** 唯一 localStorage key（推荐带页面前缀，如 "moe.draft.video.create"）。*/
  key: string;
  /** 当前表单值（建议来自 react-hook-form 的 watch / useWatch）。*/
  value: T;
  /** 用户确认"恢复"时被调用，应把表单状态写回。*/
  onRestore: (data: T) => void;
  /** 关闭草稿（编辑既有内容时通常 false）。*/
  enabled?: boolean;
  /** 防抖时间（默认 800ms）。*/
  debounceMs?: number;
  /** 过期时间（默认 7 天）。*/
  ttlMs?: number;
  /** 判断当前 value 是否"空"（不保存空草稿）。默认：对象所有字段都 falsy 视为空。*/
  isEmpty?: (value: T) => boolean;
}

/**
 * 表单草稿自动保存：防抖写 localStorage，挂载时若发现非空草稿则用 toast 提示恢复。
 *
 * - 提交成功后调用 `clearDraft()` 清除草稿
 * - "恢复"按钮触发 `onRestore(data)`；"丢弃"按钮直接清除
 * - 超时（默认 7 天）静默丢弃
 */
export function useFormDraft<T>({
  key,
  value,
  onRestore,
  enabled = true,
  debounceMs = 800,
  ttlMs = DEFAULT_TTL_MS,
  isEmpty,
}: UseFormDraftOptions<T>) {
  const defaultIsEmpty = useCallback((v: T) => {
    if (v == null) return true;
    if (typeof v !== "object") return !v;
    return Object.values(v as Record<string, unknown>).every(
      (x) => x == null || x === "" || (Array.isArray(x) && x.length === 0),
    );
  }, []);
  const checkEmpty = isEmpty ?? defaultIsEmpty;

  const promptedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRestoreRef = useRef(onRestore);
  const checkEmptyRef = useRef(checkEmpty);
  useEffect(() => {
    onRestoreRef.current = onRestore;
    checkEmptyRef.current = checkEmpty;
  });

  // 挂载时检查并提示恢复
  useEffect(() => {
    if (!enabled || promptedRef.current || typeof window === "undefined") return;
    promptedRef.current = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const env = JSON.parse(raw) as DraftEnvelope<T>;
      if (!env || env.v !== DRAFT_VERSION) {
        window.localStorage.removeItem(key);
        return;
      }
      if (Date.now() - env.savedAt > ttlMs) {
        window.localStorage.removeItem(key);
        return;
      }
      if (checkEmptyRef.current(env.data)) {
        window.localStorage.removeItem(key);
        return;
      }
      const minutes = Math.max(1, Math.round((Date.now() - env.savedAt) / 60000));
      // Sonner Toaster 在客户端组件树深处挂载，hook 第一帧调用可能在 Toaster 之前；推迟到下一宏任务可靠
      setTimeout(() => {
        toast(`发现 ${minutes} 分钟前的未保存草稿`, {
          duration: 12000,
          action: {
            label: "恢复",
            onClick: () => onRestoreRef.current(env.data),
          },
          cancel: {
            label: "丢弃",
            onClick: () => window.localStorage.removeItem(key),
          },
        });
      }, 100);
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key, enabled, ttlMs]);

  // 防抖保存
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        if (checkEmptyRef.current(value)) {
          window.localStorage.removeItem(key);
          return;
        }
        const env: DraftEnvelope<T> = { v: DRAFT_VERSION, savedAt: Date.now(), data: value };
        window.localStorage.setItem(key, JSON.stringify(env));
      } catch {
        // 配额满或被禁用时静默
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, value, enabled, debounceMs]);

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  }, [key]);

  return { clearDraft };
}
