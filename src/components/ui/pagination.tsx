"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  basePath?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  basePath,
  className,
}: PaginationProps) {
  const router = useRouter();
  const { play } = useSound();

  const go = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages || page === currentPage) return;
      play("navigate");
      onPageChange?.(page);
      if (basePath) {
        router.push(page === 1 ? basePath : `${basePath}/page/${page}`);
      }
    },
    [totalPages, currentPage, onPageChange, basePath, router, play],
  );

  // keyboard nav
  useEffect(() => {
    if (totalPages <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable ||
        t.tagName === "VIDEO"
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(currentPage - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(currentPage + 1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [currentPage, totalPages, go]);

  if (totalPages <= 1) return null;

  const pages = buildPages(currentPage, totalPages);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* 页码按钮行 */}
      <nav className="flex items-center gap-0.5" aria-label="分页">
        <PgBtn
          onClick={() => go(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="上一页"
        >
          ‹
        </PgBtn>

        {pages.map((p, i) =>
          p === "dots" ? (
            <span
              key={`d${i}`}
              className="inline-flex items-center justify-center h-8 min-w-8 px-1 text-sm text-muted-foreground select-none"
            >
              …
            </span>
          ) : (
            <PgBtn
              key={p}
              active={p === currentPage}
              onClick={() => go(p)}
            >
              {p}
            </PgBtn>
          ),
        )}

        <PgBtn
          onClick={() => go(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="下一页"
        >
          ›
        </PgBtn>
      </nav>

      {/* 跳页输入 */}
      {totalPages > 5 && (
        <JumpInput
          currentPage={currentPage}
          totalPages={totalPages}
          onJump={go}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  页码算法                                                           */
/* ------------------------------------------------------------------ */

type Slot = number | "dots";

function buildPages(cur: number, total: number): Slot[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const s = new Set<number>();
  // 始终显示首尾各 2 页
  s.add(1).add(2);
  s.add(total - 1).add(total);
  // 当前页 ± 1
  for (let i = cur - 1; i <= cur + 1; i++) {
    if (i >= 1 && i <= total) s.add(i);
  }

  const sorted = [...s].sort((a, b) => a - b);
  const out: Slot[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("dots");
    out.push(sorted[i]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  PgBtn — 页码按钮                                                  */
/* ------------------------------------------------------------------ */

function PgBtn({
  active,
  disabled,
  onClick,
  children,
  ...rest
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center select-none tabular-nums",
        "h-8 min-w-8 rounded px-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "pointer-events-none opacity-30",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  JumpInput — 跳页输入（hanime1 风格: [input] / total [跳转]）       */
/* ------------------------------------------------------------------ */

function JumpInput({
  currentPage,
  totalPages,
  onJump,
}: {
  currentPage: number;
  totalPages: number;
  onJump: (p: number) => void;
}) {
  const [val, setVal] = useState(String(currentPage));
  const inputRef = useRef<HTMLInputElement>(null);

  // 外部 currentPage 变化时同步
  useEffect(() => {
    setVal(String(currentPage));
  }, [currentPage]);

  const submit = () => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages && n !== currentPage) {
      onJump(n);
    } else {
      setVal(String(currentPage));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          inputMode="numeric"
          maxLength={String(totalPages).length}
          value={val}
          onFocus={() => inputRef.current?.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v === "") {
              setVal("");
              return;
            }
            const n = parseInt(v, 10);
            if (n > totalPages) {
              setVal(String(totalPages));
            } else {
              setVal(v);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className={cn(
            "h-8 rounded-l-md border border-r-0 bg-background text-center text-sm tabular-nums outline-none",
            "focus:border-primary focus:ring-1 focus:ring-primary/30",
          )}
          style={{ width: `${Math.max(String(totalPages).length, 2) * 0.7 + 1.2}em` }}
        />
        <span className="inline-flex items-center h-8 border border-l-0 rounded-r-md bg-muted/50 px-2 text-sm text-muted-foreground tabular-nums select-none">
          /&nbsp;{totalPages}
        </span>
      </div>
      <button
        type="button"
        onClick={submit}
        className={cn(
          "h-8 rounded-md px-3 text-sm font-medium transition-colors",
          "bg-accent text-accent-foreground hover:bg-accent/80",
        )}
      >
        跳转
      </button>
    </div>
  );
}
