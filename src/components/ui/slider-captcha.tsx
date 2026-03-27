"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SliderCaptchaProps {
  onVerify: (percent: number) => void;
  error?: string;
}

const TRACK_WIDTH = 300;
const KNOB_SIZE = 40;
const MAX_DRAG = TRACK_WIDTH - KNOB_SIZE;

export function SliderCaptcha({ onVerify, error }: SliderCaptchaProps) {
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const fetchChallenge = useCallback(async () => {
    setVerified(false);
    setFailed(false);
    setDragX(0);
    setLoading(true);
    try {
      const res = await fetch(`/api/captcha?mode=slider&t=${Date.now()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setSvgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setSvgUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenge();
    return () => {
      setSvgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toPercent = (px: number) => Math.round((px / MAX_DRAG) * 100);

  const handleStart = useCallback(
    (clientX: number) => {
      if (verified || verifying) return;
      setDragging(true);
      setFailed(false);
      startXRef.current = clientX - dragX;
    },
    [verified, verifying, dragX],
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!dragging) return;
      const newX = Math.max(0, Math.min(MAX_DRAG, clientX - startXRef.current));
      setDragX(newX);
    },
    [dragging],
  );

  const handleEnd = useCallback(async () => {
    if (!dragging) return;
    setDragging(false);

    const userPercent = toPercent(dragX);
    setVerifying(true);
    try {
      const res = await fetch("/api/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "slider", captcha: String(userPercent), consume: false }),
      });
      const result = await res.json();
      if (result.valid) {
        setVerified(true);
        onVerify(userPercent);
      } else {
        setFailed(true);
        setTimeout(() => {
          setDragX(0);
          setFailed(false);
          fetchChallenge();
        }, 600);
      }
    } catch {
      setFailed(true);
      setTimeout(() => {
        setDragX(0);
        setFailed(false);
      }, 600);
    } finally {
      setVerifying(false);
    }
  }, [dragging, dragX, onVerify, fetchChallenge]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => handleEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragging, handleMove, handleEnd]);

  return (
    <div className="space-y-2">
      <div ref={trackRef} className="relative select-none touch-none" style={{ width: TRACK_WIDTH, height: KNOB_SIZE }}>
        {/* track background with SVG challenge image */}
        <div
          className={cn(
            "absolute inset-0 rounded-full border transition-colors overflow-hidden",
            verified
              ? "border-green-500/50 bg-green-500/10"
              : failed
                ? "border-destructive/50 bg-destructive/10"
                : "border-border bg-muted/50",
          )}
        >
          {svgUrl && !verified && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={svgUrl} alt="" className="absolute inset-0 w-full h-full pointer-events-none" draggable={false} />
          )}
        </div>

        {/* filled portion */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-colors",
            verified ? "bg-green-500/20" : "bg-primary/10",
          )}
          style={{ width: dragX + KNOB_SIZE / 2 }}
        />

        {/* hint text */}
        {!dragging && !verified && !verifying && dragX === 0 && !loading && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none select-none">
            拖动滑块到指定位置
          </span>
        )}

        {/* loading indicator */}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        )}

        {/* knob */}
        <div
          className={cn(
            "absolute top-0 flex items-center justify-center rounded-full border-2 shadow-sm cursor-grab active:cursor-grabbing transition-colors",
            verified
              ? "border-green-500 bg-green-500 text-white"
              : failed
                ? "border-destructive bg-destructive text-destructive-foreground"
                : verifying
                  ? "border-muted-foreground bg-muted cursor-wait"
                  : "border-primary bg-background text-primary hover:bg-primary/5",
          )}
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            left: dragX,
            transition: dragging ? "none" : "left 0.3s ease",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleStart(e.clientX);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) handleStart(e.touches[0].clientX);
          }}
        >
          {verified ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : verifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="opacity-60">
              <path
                d="M7 4l5 5-5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {(error || failed) && <p className="text-xs text-destructive">{error || "验证失败，请重试"}</p>}
        {verified && <p className="text-xs text-green-600">验证成功</p>}
        {verifying && <p className="text-xs text-muted-foreground">验证中...</p>}
        <button
          type="button"
          onClick={fetchChallenge}
          disabled={verifying}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors ml-auto disabled:opacity-50"
          title="刷新验证"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
