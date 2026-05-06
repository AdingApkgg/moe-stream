"use client";

import { Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useStableSession } from "@/lib/hooks";
import { toast } from "@/lib/toast-with-sound";

interface HoverFavoriteButtonProps {
  /** 当前是否已收藏（来自父组件的 favoritedMap 查询） */
  favorited: boolean;
  /**
   * 切换收藏的回调，由调用方包装具体的 trpc mutation。
   * 期望返回 Promise，resolve 值是切换后新的 favorited 状态。
   */
  onToggle: () => Promise<boolean>;
  /** 未登录时跳转的 callbackUrl（通常是当前内容详情页） */
  unauthCallbackUrl: string;
  className?: string;
}

/**
 * 视频/图片/游戏卡片左下角的浮动收藏按钮。
 * 参考 hanime1.me：hover 时浮出，移动端隐藏（避免误触 + 节省列表空间）。
 * 未登录时点击跳到登录页（带 callbackUrl）。
 *
 * 调用方需要传入：当前 favorited 状态 + 切换回调 + 未登录 callbackUrl，
 * 不直接耦合到具体的 trpc procedure。
 */
export function HoverFavoriteButton({ favorited, onToggle, unauthCallbackUrl, className }: HoverFavoriteButtonProps) {
  const router = useRouter();
  const { session } = useStableSession();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const isFavorited = optimistic ?? favorited;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session?.user) {
      router.push(`/login?callbackUrl=${encodeURIComponent(unauthCallbackUrl)}`);
      return;
    }
    if (pending) return;
    setOptimistic(!isFavorited);
    setPending(true);
    try {
      const next = await onToggle();
      setOptimistic(next);
      toast.success(next ? "已收藏" : "已取消收藏");
    } catch {
      setOptimistic(null);
      toast.error("操作失败，请稍后再试");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorited ? "取消收藏" : "加入收藏"}
      aria-pressed={isFavorited}
      className={cn(
        "absolute bottom-1.5 left-1.5 grid h-8 w-8 place-items-center rounded-full",
        "bg-black/55 backdrop-blur-sm text-white shadow-lg",
        "transition-[opacity,transform,background-color] duration-200",
        "hidden md:grid",
        isFavorited ? "opacity-100" : "opacity-0 group-hover:opacity-100 -translate-y-0.5 group-hover:translate-y-0",
        "hover:bg-black/75 active:scale-90",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn("h-4 w-4 transition-colors", isFavorited ? "fill-pink-500 text-pink-500" : "text-white")}
        />
      )}
    </button>
  );
}
