import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "dashboard-sidebar-collapsed";
const EVENT = "dashboard-sidebar-collapsed-change";

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** 后台侧边栏折叠状态，持久化到 localStorage */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    try {
      const next = !(localStorage.getItem(STORAGE_KEY) === "true");
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {}
  }, []);

  return { collapsed, toggle };
}
