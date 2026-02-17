"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
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
  const [jumpValue, setJumpValue] = useState("");
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

  const handleJump = () => {
    const page = parseInt(jumpValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      handlePageChange(page);
    }
    setJumpValue("");
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav className={cn("flex items-center justify-center gap-1 flex-wrap", className)}>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          );
        }

        return (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => handlePageChange(page)}
          >
            {page}
          </Button>
        );
      })}

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {totalPages > 5 && (
        <div className="flex items-center gap-1 ml-2">
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJump();
            }}
            placeholder={`${currentPage}/${totalPages}`}
            className="h-9 w-20 text-center text-sm"
          />
          <Button variant="outline" size="sm" className="h-9" onClick={handleJump}>
            跳转
          </Button>
        </div>
      )}
    </nav>
  );
}
