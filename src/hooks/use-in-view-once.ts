"use client";

import { useEffect, useRef, useState } from "react";

export interface UseInViewOnceOptions {
  /** 为 true 时不监听可视区域，视为始终已进入（用于首屏优先解码） */
  disabled?: boolean;
  /** 略提前于进入视口即触发，实现「预加载」感 */
  rootMargin?: string;
}

/**
 * 元素进入视口（含 rootMargin）一次后 inView 为 true，用于懒挂载媒体资源。
 */
export function useInViewOnce<T extends Element>(options: UseInViewOnceOptions = {}) {
  const { disabled = false, rootMargin = "280px 0px" } = options;
  const ref = useRef<T | null>(null);
  const [entered, setEntered] = useState(false);
  const inView = disabled || entered;

  useEffect(() => {
    if (disabled) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setEntered(true);
            observer.disconnect();
            return;
          }
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [disabled, rootMargin]);

  return { ref, inView };
}
