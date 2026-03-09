"use client";

import { useEffect, useRef, useCallback } from "react";

const FP_STORAGE_KEY = "_fp_vid";

let cachedVisitorId: string | null = null;
let loadPromise: Promise<string> | null = null;

async function loadFingerprint(): Promise<string> {
  if (cachedVisitorId) return cachedVisitorId;

  try {
    const stored = localStorage.getItem(FP_STORAGE_KEY);
    if (stored) {
      cachedVisitorId = stored;
      return stored;
    }
  } catch {}

  const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  cachedVisitorId = result.visitorId;

  try {
    localStorage.setItem(FP_STORAGE_KEY, result.visitorId);
  } catch {}

  return result.visitorId;
}

/**
 * React hook: 懒加载 FingerprintJS 并缓存 visitorId。
 * 首次渲染时异步初始化，后续调用 getVisitorId() 即可拿到结果。
 */
export function useFingerprint() {
  const visitorIdRef = useRef<string | null>(cachedVisitorId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loadPromise) loadPromise = loadFingerprint();
    loadPromise.then((id) => {
      visitorIdRef.current = id;
    });
  }, []);

  const getVisitorId = useCallback(async (): Promise<string> => {
    if (visitorIdRef.current) return visitorIdRef.current;
    if (!loadPromise) loadPromise = loadFingerprint();
    const id = await loadPromise;
    visitorIdRef.current = id;
    return id;
  }, []);

  return { getVisitorId };
}

/**
 * 非 hook 版本，可在任意客户端代码中使用（登录、注册等）。
 */
export async function getFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  if (!loadPromise) loadPromise = loadFingerprint();
  return loadPromise;
}
