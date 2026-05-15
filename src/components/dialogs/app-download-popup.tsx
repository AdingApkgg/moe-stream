"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useSiteConfig } from "@/contexts/site-config";
import { parseDeviceInfo } from "@/lib/device-info";

const STORAGE_KEY = "mikiacg-app-download-dismissed";

interface DismissedRecord {
  hash: string;
  at: number;
}

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

/** 把 device-info 的 OS 名归一化为我们配置里的平台 ID */
function osToPlatformId(os: string | null): "ios" | "android" | "windows" | "macos" | null {
  if (!os) return null;
  const lower = os.toLowerCase();
  if (lower === "ios" || lower.startsWith("ios")) return "ios";
  if (lower === "android" || lower.startsWith("android")) return "android";
  if (lower === "windows" || lower.startsWith("windows")) return "windows";
  if (lower === "mac os" || lower === "macos" || lower.startsWith("mac")) return "macos";
  return null;
}

/**
 * 全局 APP 下载推荐弹窗。
 * - 仅在管理员后台配置启用且当前用户的设备平台在白名单内时展示
 * - 进站后延迟 delayMs 展示，避免阻塞首屏
 * - 用户关闭后 cooldownHours 内不再弹出（配置或链接变更后自动失效）
 */
export function AppDownloadPopup() {
  const cfg = useSiteConfig();
  const popup = cfg?.appDownloadPopup;

  const [open, setOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!popup || !popup.enabled) return;
    if (typeof window === "undefined") return;

    const device = parseDeviceInfo(navigator.userAgent);
    const platformId = osToPlatformId(device.os);
    if (!platformId) return;
    if (popup.platforms.length > 0 && !popup.platforms.includes(platformId)) return;

    const platformUrl = popup.urls[platformId];
    const url = platformUrl || popup.urls.fallback;
    if (!url) return;

    // 冷却检查
    const fingerprint = [
      popup.title ?? "",
      popup.description ?? "",
      popup.image ?? "",
      url,
      popup.platforms.join(","),
    ].join("|");
    const h = hashString(fingerprint);
    const cooldownMs = Math.max(0, popup.cooldownHours) * 60 * 60 * 1000;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && cooldownMs > 0) {
        const rec = JSON.parse(raw) as DismissedRecord;
        if (rec.hash === h && Date.now() - rec.at < cooldownMs) return;
      }
    } catch {}

    const delay = Math.max(0, popup.delayMs);
    const t = window.setTimeout(() => {
      setDownloadUrl(url);
      setOpen(true);
    }, delay);
    return () => window.clearTimeout(t);
    // 完整依赖于 popup 对象的几个原始字段——直接以 popup 引用变更触发
  }, [popup]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && popup) {
      try {
        const fingerprint = [
          popup.title ?? "",
          popup.description ?? "",
          popup.image ?? "",
          downloadUrl ?? "",
          popup.platforms.join(","),
        ].join("|");
        const rec: DismissedRecord = { hash: hashString(fingerprint), at: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
      } catch {}
    }
  };

  if (!popup || !popup.enabled || !downloadUrl) return null;

  const title = popup.title || "下载客户端 APP";
  const buttonText = popup.buttonText || "立即下载";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {popup.image ? (
            <div className="flex justify-center mb-2">
              {/* biome-ignore lint/performance/noImgElement: 站点配置图标，避免 next/image 远程域名白名单限制 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={popup.image} alt="" className="h-20 w-20 rounded-2xl object-cover shadow-md" loading="lazy" />
            </div>
          ) : null}
          <DialogTitle className="text-center">{title}</DialogTitle>
          {popup.description ? (
            <DialogDescription className="text-center whitespace-pre-wrap">{popup.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" onClick={() => handleOpenChange(false)}>
              <Download className="mr-2 h-4 w-4" />
              {buttonText}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
