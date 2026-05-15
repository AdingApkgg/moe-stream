"use client";

import { useEffect, useRef } from "react";
import { useAdImpression, useAdTracking } from "@/hooks/use-ad-tracking";
import { cn } from "@/lib/utils";

interface AdHtmlProps {
  /** HTML/JS 片段，将以 innerHTML 注入，并对其中的 <script> 标签重建以触发执行 */
  html: string;
  /** 广告 id，用于上报展示/点击 */
  adId: string;
  className?: string;
}

/**
 * 渲染自定义 HTML/JS 广告（如 Google AdSense、Cloudflare、百度联盟脚本片段）。
 *
 * 直接 innerHTML 注入的 <script> 不会执行，因此需要克隆为新的 script 节点重新挂载，
 * 这是 React 渲染第三方广告 SDK 的常见做法。
 */
export function AdHtml({ html, adId, className }: AdHtmlProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { trackEvent } = useAdTracking();
  useAdImpression(ref, adId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    const scripts = Array.from(el.querySelectorAll("script"));
    for (const oldScript of scripts) {
      const next = document.createElement("script");
      for (const attr of Array.from(oldScript.attributes)) {
        next.setAttribute(attr.name, attr.value);
      }
      next.text = oldScript.text;
      oldScript.parentNode?.replaceChild(next, oldScript);
    }
  }, [html]);

  return (
    <div
      ref={ref}
      data-ad-html={adId}
      className={cn("relative overflow-hidden", className)}
      onClick={() => trackEvent(adId, "click")}
      onAuxClick={(e) => {
        if (e.button === 1) trackEvent(adId, "click");
      }}
    />
  );
}
