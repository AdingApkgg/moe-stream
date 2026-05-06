"use client";

import { useEffect, useCallback, useState, useSyncExternalStore } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";

// 从 usehooks-ts 导出常用 hooks
export {
  useIsMounted,
  useEventListener,
  useOnClickOutside,
  useCopyToClipboard,
  useWindowSize,
  useScrollLock,
  useIsClient,
  useDocumentTitle,
  useInterval,
  useTimeout,
  useToggle,
  useCounter,
  useBoolean,
  useStep,
  useHover,
} from "usehooks-ts";

// ==================== useStableSession ====================
/**
 * 稳定的 Session Hook
 * 包装 useSession，提供统一的 API
 * Session 稳定性主要通过 Service Worker 排除 auth API 缓存和
 * SessionProvider 的 refetchInterval/refetchOnWindowFocus 配置来保证
 */
export function useStableSession() {
  const { data: session, status } = useSession();

  return {
    session,
    status,
    isLoading: status === "loading",
  };
}

// ==================== useRequireAuth ====================
// 统一的认证检查 hook，用于替代各页面重复的认证检查和重定向逻辑

interface UseRequireAuthOptions {
  /** 未登录时重定向的 URL，默认为 /login */
  redirectTo?: string;
  /** 是否在 URL 中包含回调地址 */
  includeCallback?: boolean;
  /** 自定义回调 URL */
  callbackUrl?: string;
}

interface UseRequireAuthReturn {
  /** 当前会话 */
  session: ReturnType<typeof useSession>["data"];
  /** 认证状态 */
  status: ReturnType<typeof useSession>["status"];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否已认证 */
  isAuthenticated: boolean;
}

/**
 * 认证检查 hook
 * 自动处理未登录用户的重定向
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}): UseRequireAuthReturn {
  const { redirectTo = "/login", includeCallback = true, callbackUrl } = options;

  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    if (status === "unauthenticated") {
      let url = redirectTo;
      if (includeCallback) {
        const callback = callbackUrl || pathname;
        url = `${redirectTo}?callbackUrl=${encodeURIComponent(callback)}`;
      }
      router.push(url);
    }
  }, [status, router, redirectTo, includeCallback, callbackUrl, pathname]);

  return {
    session,
    status,
    isLoading,
    isAuthenticated,
  };
}

// ==================== useDeviceInfo ====================
// 统一的设备信息获取 hook

interface DeviceInfo {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  touchSupport: boolean;
  colorDepth: number;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  connectionType: string | null;
}

interface UseDeviceInfoReturn {
  deviceInfo: DeviceInfo | null;
  isLoading: boolean;
  error: string | null;
}

// 设备信息只在客户端首次访问时计算一次，缓存复用
type DeviceInfoSnapshot = { info: DeviceInfo | null; error: string | null };
let cachedDeviceInfo: DeviceInfoSnapshot | undefined;
const SERVER_DEVICE_INFO: DeviceInfoSnapshot = { info: null, error: null };

function readDeviceInfo(): DeviceInfoSnapshot {
  if (cachedDeviceInfo) return cachedDeviceInfo;
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string };
    };
    const info: DeviceInfo = {
      userAgent: nav.userAgent || "",
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      language: nav.language || "",
      platform: nav.platform || "",
      cookiesEnabled: nav.cookieEnabled ?? false,
      doNotTrack: nav.doNotTrack === "1",
      touchSupport: "ontouchstart" in window || nav.maxTouchPoints > 0,
      colorDepth: window.screen.colorDepth || 24,
      deviceMemory: nav.deviceMemory ?? null,
      hardwareConcurrency: nav.hardwareConcurrency ?? null,
      connectionType: nav.connection?.effectiveType ?? null,
    };
    cachedDeviceInfo = { info, error: null };
  } catch (err) {
    cachedDeviceInfo = { info: null, error: err instanceof Error ? err.message : "获取设备信息失败" };
  }
  return cachedDeviceInfo;
}

const subscribeDeviceInfo = () => () => {};
const getServerDeviceInfo = (): DeviceInfoSnapshot => SERVER_DEVICE_INFO;

/**
 * 设备信息获取 hook
 * 在客户端收集设备信息，用于评论、访问记录等。
 * 用 useSyncExternalStore 实现：SSR 返回 null，客户端 hydration 后返回真实数据。
 */
export function useDeviceInfo(): UseDeviceInfoReturn {
  const snapshot = useSyncExternalStore(subscribeDeviceInfo, readDeviceInfo, getServerDeviceInfo);
  return {
    deviceInfo: snapshot.info,
    isLoading: snapshot === SERVER_DEVICE_INFO,
    error: snapshot.error,
  };
}

// ==================== useDebounce ====================
// 防抖 hook

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ==================== useLocalStorage ====================
// 本地存储 hook

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue];
}

// ==================== useMounted ====================
// 组件挂载状态 hook - 使用 useSyncExternalStore 避免 effect 中 setState

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getMountedServerSnapshot = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getMountedServerSnapshot);
}

// ==================== useMediaQuery ====================
// 媒体查询 hook - 使用 useSyncExternalStore 避免 effect 中 setState

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", callback);
      return () => mediaQuery.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
