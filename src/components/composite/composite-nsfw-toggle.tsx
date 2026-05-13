"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const COOKIE = "composite-hide-nsfw";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 年

/**
 * 综合页顶部 NSFW 显示开关：通过 cookie 控制服务端查询。
 * 切换后调用 router.refresh() 让 RSC 重新拉取数据，无需整页 reload。
 */
export function CompositeNsfwToggle({ hideNsfw }: { hideNsfw: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !hideNsfw;
    // 客户端写 cookie：next=true 时设置 "1"，否则清空
    document.cookie = next
      ? `${COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
      : `${COOKIE}=; path=/; max-age=0; samesite=lax`;
    startTransition(() => router.refresh());
  };

  const Icon = hideNsfw ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={hideNsfw ? "当前已隐藏 NSFW，点击恢复显示" : "当前显示全部内容，点击隐藏 NSFW"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors",
        hideNsfw
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
          : "border-border bg-muted text-foreground hover:bg-muted/70",
        pending && "opacity-60 cursor-wait",
      )}
    >
      <Icon className="h-4 w-4" />
      {hideNsfw ? "已隐藏 NSFW" : "显示全部"}
    </button>
  );
}
