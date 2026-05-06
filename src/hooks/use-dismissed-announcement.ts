"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mikiacg-announcement-dismissed";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

interface DismissedRecord {
  /** 公告内容的 hash，用于检测公告是否更换 */
  hash: string;
  /** dismiss 时间戳 (ms) */
  at: number;
}

/** 给字符串做一个轻量级 hash（djb2），用于判断公告是否变化 */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * 公告横幅 dismiss 状态管理：
 * - 用户关闭后 24h 内不再显示
 * - 公告内容变更后状态自动失效（旧的 dismiss 不影响新公告）
 *
 * @param announcement 当前公告内容（用作 hash key），可为空
 * @returns [shown, dismiss]
 */
export function useDismissedAnnouncement(announcement: string | null | undefined): [boolean, () => void] {
  // 默认 hidden 避免 SSR/水合时闪一下
  const [hash, setHash] = useState<string>("");
  const [hidden, setHidden] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // 客户端从 localStorage 读取持久化的 dismiss 状态。
  // 这里需要在 effect 内同步初始化客户端状态——这是 use-localStorage 类 hook
  // 的标准用例（不会循环 setState），故针对性 disable 该 lint。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 仅在 announcement 变更时跑
  useEffect(() => {
    if (!announcement) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(true);
       
      setHydrated(true);
      return;
    }
    const h = hashString(announcement);
    let stillDismissed = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const rec = JSON.parse(raw) as DismissedRecord;
        if (rec.hash === h && Date.now() - rec.at < DISMISS_TTL_MS) {
          stillDismissed = true;
        }
      }
    } catch {}
     
    setHash(h);
     
    setHidden(stillDismissed);
     
    setHydrated(true);
  }, [announcement]);

  const dismiss = useCallback(() => {
    if (!hash) {
      setHidden(true);
      return;
    }
    try {
      const rec: DismissedRecord = { hash, at: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    } catch {}
    setHidden(true);
  }, [hash]);

  // 客户端 hydrate 完成后才显示，避免 SSR 闪烁
  const shown = hydrated && !hidden && !!announcement;
  return [shown, dismiss];
}
