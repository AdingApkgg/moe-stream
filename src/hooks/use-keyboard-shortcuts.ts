"use client";

import { useEffect, useState, useCallback } from "react";

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable;
      const isVideo = tag === "VIDEO";

      // Esc: blur focused input (dialog close is handled by Radix)
      if (e.key === "Escape" && isEditable) {
        (target as HTMLElement).blur();
        return;
      }

      // Skip remaining shortcuts when focus is in editable or video
      if (isEditable || isVideo) return;

      // ? — show shortcuts help
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    showHelp,
    setShowHelp,
  };
}
