"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// 轻量级顶部导航进度条：监听 anchor 点击启动，pathname 变化完成
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialRef = useRef(true);
  const visibleRef = useRef(false);

  const start = () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    visibleRef.current = true;
    setVisible(true);
    setProgress(8);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) return p;
        return Math.min(85, p + (90 - p) * 0.08);
      });
    }, 200);
  };

  const finish = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    finishTimerRef.current = setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      setProgress(0);
    }, 250);
  };

  // 监听 anchor 点击启动进度
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank") return;
      if (link.hasAttribute("download")) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      try {
        const url = new URL(link.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      start();
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // 编程式导航的补偿：暴露全局事件
  useEffect(() => {
    const handler = () => start();
    window.addEventListener("nav:start", handler);
    return () => window.removeEventListener("nav:start", handler);
  }, []);

  // pathname 变化时完成进度；编程式导航兜底：没 start 也给一次短反馈
  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    if (!visibleRef.current) {
      visibleRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      setProgress(70);
    }
    finish();
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary pointer-events-none shadow-[0_0_10px_var(--primary)]"
      style={{
        transform: `scaleX(${progress / 100})`,
        transformOrigin: "left",
        transition: "transform 200ms ease-out, opacity 200ms ease-out",
        opacity: visible ? 1 : 0,
      }}
    />
  );
}
