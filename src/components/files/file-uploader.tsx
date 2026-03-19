"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-with-sound";
import {
  Upload,
  X,
  FileIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface FileUploadItem {
  file: File;
  id: string;
  status: "pending" | "uploading" | "completed" | "error";
  progress: number;
  result?: UploadedFile;
  error?: string;
}

interface FileUploaderProps {
  contentType?: "video" | "game" | "imagePost";
  contentId?: string;
  accept?: string;
  maxFiles?: number;
  onFileUploaded?: (file: UploadedFile) => void;
  onAllComplete?: (files: UploadedFile[]) => void;
  className?: string;
}

const PART_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploader({
  contentType,
  contentId,
  accept,
  maxFiles = 10,
  onFileUploaded,
  onAllComplete,
  className,
}: FileUploaderProps) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initUpload = trpc.file.initUpload.useMutation();
  const completeUpload = trpc.file.completeUpload.useMutation();

  const updateItem = useCallback(
    (id: string, patch: Partial<FileUploadItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const uploadFile = useCallback(
    async (item: FileUploadItem) => {
      updateItem(item.id, { status: "uploading", progress: 0 });

      try {
        const initResult = await initUpload.mutateAsync({
          filename: item.file.name,
          size: item.file.size,
          mimeType: item.file.type || "application/octet-stream",
          contentType,
          contentId,
        });

        if (initResult.isLocal) {
          const formData = new FormData();
          formData.append("file", item.file);

          const xhr = new XMLHttpRequest();
          await new Promise<void>((resolve, reject) => {
            xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) {
                updateItem(item.id, {
                  progress: Math.round((e.loaded / e.total) * 100),
                });
              }
            });
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`Upload failed: ${xhr.status}`));
            });
            xhr.addEventListener("error", () => reject(new Error("上传失败")));
            xhr.open("POST", initResult.uploadUrl!);
            xhr.send(formData);
          });

          const completed = await completeUpload.mutateAsync({
            fileId: initResult.fileId,
          });
          return completed;
        }

        if (initResult.parts && initResult.uploadId) {
          const parts: { partNumber: number; etag: string }[] = [];

          for (const part of initResult.parts) {
            const start = (part.partNumber - 1) * PART_SIZE;
            const end = Math.min(start + PART_SIZE, item.file.size);
            const blob = item.file.slice(start, end);

            const resp = await fetch(part.url, {
              method: "PUT",
              body: blob,
            });

            if (!resp.ok) throw new Error(`Part ${part.partNumber} upload failed`);

            const etag = resp.headers.get("ETag") || "";
            parts.push({ partNumber: part.partNumber, etag });

            const uploaded = end;
            updateItem(item.id, {
              progress: Math.round((uploaded / item.file.size) * 100),
            });
          }

          const completed = await completeUpload.mutateAsync({
            fileId: initResult.fileId,
            uploadId: initResult.uploadId,
            parts,
          });
          return completed;
        }

        if (initResult.uploadUrl) {
          const xhr = new XMLHttpRequest();
          await new Promise<void>((resolve, reject) => {
            xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) {
                updateItem(item.id, {
                  progress: Math.round((e.loaded / e.total) * 100),
                });
              }
            });
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`Upload failed: ${xhr.status}`));
            });
            xhr.addEventListener("error", () => reject(new Error("上传失败")));
            xhr.open("PUT", initResult.uploadUrl!);
            xhr.setRequestHeader(
              "Content-Type",
              item.file.type || "application/octet-stream",
            );
            xhr.send(item.file);
          });

          const completed = await completeUpload.mutateAsync({
            fileId: initResult.fileId,
          });
          return completed;
        }

        throw new Error("未知的上传方式");
      } catch (err) {
        throw err;
      }
    },
    [initUpload, completeUpload, contentType, contentId, updateItem],
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      const remaining = maxFiles - items.filter((i) => i.status !== "error").length;
      const toUpload = files.slice(0, Math.max(0, remaining));

      if (toUpload.length === 0) {
        toast.error(`最多同时上传 ${maxFiles} 个文件`);
        return;
      }

      const newItems: FileUploadItem[] = toUpload.map((file) => ({
        file,
        id: crypto.randomUUID(),
        status: "pending" as const,
        progress: 0,
      }));

      setItems((prev) => [...prev, ...newItems]);

      const results: UploadedFile[] = [];
      for (const item of newItems) {
        try {
          const result = await uploadFile(item);
          updateItem(item.id, {
            status: "completed",
            progress: 100,
            result,
          });
          results.push(result);
          onFileUploaded?.(result);
        } catch (err) {
          updateItem(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "上传失败",
          });
          toast.error(
            `${item.file.name}: ${err instanceof Error ? err.message : "上传失败"}`,
          );
        }
      }

      if (results.length > 0) {
        onAllComplete?.(results);
      }
    },
    [items, maxFiles, uploadFile, updateItem, onFileUploaded, onAllComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      processFiles(files);
      e.target.value = "";
    },
    [processFiles],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const isUploading = items.some((i) => i.status === "uploading" || i.status === "pending");

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          拖拽文件到此处，或点击选择文件
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          支持图片、视频、压缩包等文件
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="shrink-0">
                {item.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : item.status === "error" ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : item.status === "uploading" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                  {item.error && (
                    <span className="text-destructive ml-2">{item.error}</span>
                  )}
                </p>
                {(item.status === "uploading" || item.status === "pending") && (
                  <Progress value={item.progress} className="mt-1 h-1" />
                )}
              </div>
              {(item.status === "completed" || item.status === "error") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
