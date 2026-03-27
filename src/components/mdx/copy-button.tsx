"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 cursor-pointer"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
