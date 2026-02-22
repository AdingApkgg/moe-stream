"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle, FolderOpen, X } from "lucide-react";

interface DropZoneProps {
  id: string;
  accept?: string;
  fileName?: string;
  summary?: string;
  hint?: string;
  onFile: (file: File) => void;
  onClear?: () => void;
  hasData?: boolean;
}

export function DropZone({ id, accept = ".json", fileName, summary, hint, onFile, onClear, hasData }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-all cursor-pointer",
        dragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        hasData && "border-green-500/50 bg-green-500/5"
      )}
      onClick={() => document.getElementById(id)?.click()}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {hasData ? (
        <>
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div className="text-center">
            <p className="font-medium">{fileName}</p>
            {summary && <p className="text-sm text-muted-foreground mt-1">{summary}</p>}
          </div>
          {onClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
            >
              <X className="h-3 w-3 mr-1" /> 清除
            </Button>
          )}
        </>
      ) : (
        <>
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">拖入文件或点击选择</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
        </>
      )}
    </div>
  );
}
