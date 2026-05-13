import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "dashboard-sidebar-collapsed";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const getSnapshot = () => localStorage.getItem(STORAGE_KEY) === "true";
const getServerSnapshot = () => false;

/** 后台侧边栏折叠状态，持久化到 localStorage */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    try {
      const next = String(localStorage.getItem(STORAGE_KEY) !== "true");
      localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
    } catch {}
  }, []);

  return { collapsed, toggle };
}
