"use client";

import { useEffect, useRef, useState } from "react";

export interface UseInViewOnceOptions {
  /** 为 true 时不监听可视区域，视为始终已进入（用于首屏优先解码） */
  disabled?: boolean;
  /** 略提前于进入视口即触发，实现「预加载」感 */
  rootMargin?: string;
}

// 共享 IntersectionObserver 池：相同 rootMargin 复用同一个 observer，
// 避免列表场景下每张卡片各起一个 observer 实例（24+ 个实例的滚动开销很可观）。
const observerPool = new Map<string, IntersectionObserver>();
const elementCallbacks = new WeakMap<Element, () => void>();

function getSharedObserver(rootMargin: string): IntersectionObserver {
  const cached = observerPool.get(rootMargin);
  if (cached) return cached;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = elementCallbacks.get(entry.target);
        if (!cb) continue;
        cb();
        observer.unobserve(entry.target);
        elementCallbacks.delete(entry.target);
      }
    },
    { root: null, rootMargin, threshold: 0 },
  );
  observerPool.set(rootMargin, observer);
  return observer;
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

    const observer = getSharedObserver(rootMargin);
    elementCallbacks.set(el, () => setEntered(true));
    observer.observe(el);

    return () => {
      observer.unobserve(el);
      elementCallbacks.delete(el);
    };
  }, [disabled, rootMargin]);

  return { ref, inView };
}
