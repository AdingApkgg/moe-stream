"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_HEIGHT = 80;

interface CollapsibleTagBarProps {
  children: ReactNode;
  className?: string;
}

export function CollapsibleTagBar({
  children,
  className,
}: CollapsibleTagBarProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [fullHeight, setFullHeight] = useState(COLLAPSED_HEIGHT);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      setFullHeight(h);
      setOverflows(h > COLLAPSED_HEIGHT + 4);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxH = expanded ? fullHeight : overflows ? COLLAPSED_HEIGHT : fullHeight;

  return (
    <div className={cn("relative", className)}>
      <div
        className="relative overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: maxH }}
      >
        <div ref={innerRef} className="flex flex-wrap gap-2 px-1 py-1">
          {children}
        </div>
        {!expanded && overflows && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
      {overflows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-center w-full py-1 text-xs text-muted-foreground hover:text-foreground transition-colors gap-1"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-300",
              expanded && "rotate-180",
            )}
          />
          {expanded ? "收起" : "展开更多"}
        </button>
      )}
    </div>
  );
}
