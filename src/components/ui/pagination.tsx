"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  basePath?: string;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, basePath, className }: PaginationProps) {
  const router = useRouter();
  const { play } = useSound();

  const handlePageChange = useCallback((page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    play("navigate");
    if (onPageChange) {
      onPageChange(page);
    }
    if (basePath) {
      const url = page === 1 ? basePath : `${basePath}/page/${page}`;
      router.push(url);
    }
  }, [totalPages, currentPage, onPageChange, basePath, router, play]);

  useEffect(() => {
    if (totalPages <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      const isVideo = tag === "VIDEO";
      if (isEditable || isVideo) return;

      if (e.key === "ArrowLeft" && currentPage > 1) {
        e.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (e.key === "ArrowRight" && currentPage < totalPages) {
        e.preventDefault();
        handlePageChange(currentPage + 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, totalPages, handlePageChange]);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];
    const siblings = 1;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    const leftBound = Math.max(2, currentPage - siblings);
    const rightBound = Math.min(totalPages - 1, currentPage + siblings);

    pages.push(1);

    if (leftBound > 2) {
      pages.push("ellipsis-start");
    } else if (leftBound === 2) {
      pages.push(2);
    }

    for (let i = leftBound; i <= rightBound; i++) {
      if (!pages.includes(i)) pages.push(i);
    }

    if (rightBound < totalPages - 1) {
      pages.push("ellipsis-end");
    } else if (rightBound === totalPages - 1) {
      pages.push(totalPages - 1);
    }

    if (!pages.includes(totalPages)) pages.push(totalPages);

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav className={cn("flex items-center justify-center gap-1 flex-wrap", className)}>
      <PageButton
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
      </PageButton>

      {pages.map((page) => {
        if (page === "ellipsis-start" || page === "ellipsis-end") {
          return (
            <EllipsisJump
              key={page}
              totalPages={totalPages}
              onJump={handlePageChange}
            />
          );
        }

        return (
          <PageButton
            key={page}
            active={currentPage === page}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </PageButton>
        );
      })}

      <PageButton
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="下一页"
      >
        <ChevronRight className="h-4 w-4" />
      </PageButton>

      {totalPages > 7 && (
        <span className="text-xs text-muted-foreground ml-1.5 tabular-nums hidden sm:inline">
          {currentPage}/{totalPages}
        </span>
      )}
    </nav>
  );
}

function PageButton({
  active,
  disabled,
  onClick,
  children,
  ...props
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
        "h-9 min-w-9 px-2 select-none",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-muted text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function EllipsisJump({
  totalPages,
  onJump,
}: {
  totalPages: number;
  onJump: (page: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const handleSubmit = () => {
    const page = parseInt(value, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onJump(page);
    }
    setEditing(false);
    setValue("");
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={1}
        max={totalPages}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setEditing(false); setValue(""); }
        }}
        onBlur={handleSubmit}
        placeholder={`1-${totalPages}`}
        className={cn(
          "h-9 w-16 rounded-md border bg-background px-1.5 text-center text-sm tabular-nums",
          "outline-none ring-2 ring-primary focus:ring-primary animate-in zoom-in-95 duration-150",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "group relative inline-flex items-center justify-center h-9 min-w-9 px-1.5 rounded-md transition-all duration-200 cursor-pointer select-none",
        "border border-dashed border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/10",
      )}
    >
      <span className="text-sm text-muted-foreground tracking-widest group-hover:hidden">···</span>
      <span className="text-xs font-medium text-primary hidden group-hover:inline">跳页</span>
    </button>
  );
}
