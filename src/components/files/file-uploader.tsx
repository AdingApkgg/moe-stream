"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { computeSHA256 } from "@/lib/file-hash";
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
  Zap,
  Pause,
  Play,
} from "lucide-react";

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

type UploadStatus =
  | "pending"
  | "hashing"
  | "checking"
  | "uploading"
  | "paused"
  | "completed"
  | "error";

interface FileUploadItem {
  file: File;
  id: string;
  status: UploadStatus;
  progress: number;
  hashProgress: number;
  hash?: string;
  fileId?: string;
  totalChunks?: number;
  completedChunks: number[];
  isFlashUpload?: boolean;
  result?: UploadedFile;
  error?: string;
  abortController?: AbortController;
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

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

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
  const pausedRef = useRef<Set<string>>(new Set());

  const checkHash = trpc.file.checkHash.useMutation();
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
    async (item: FileUploadItem): Promise<UploadedFile | null> => {
      const ac = new AbortController();
      updateItem(item.id, { status: "hashing", abortController: ac });

      // 1. Compute hash
      let hash: string;
      try {
        hash = await computeSHA256(
          item.file,
          (pct) => updateItem(item.id, { hashProgress: pct }),
          ac.signal,
        );
        updateItem(item.id, { hash });
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        throw err;
      }

      // 2. Flash upload check
      updateItem(item.id, { status: "checking" });
      try {
        const checkResult = await checkHash.mutateAsync({
          hash,
          size: item.file.size,
          mimeType: item.file.type || "application/octet-stream",
          filename: item.file.name,
          contentType,
          contentId,
        });

        if (checkResult.found) {
          return { ...checkResult.file, mimeType: checkResult.file.mimeType };
        }
      } catch {
        // Hash check failed — fall through to normal upload
      }

      // 3. Init upload
      updateItem(item.id, { status: "uploading", progress: 0 });
      const initResult = await initUpload.mutateAsync({
        filename: item.file.name,
        size: item.file.size,
        mimeType: item.file.type || "application/octet-stream",
        hash,
        contentType,
        contentId,
      });

      const totalChunks = initResult.totalChunks ?? 1;
      updateItem(item.id, {
        fileId: initResult.fileId,
        totalChunks,
      });

      // 4. Upload chunks
      if (initResult.isLocal) {
        // Local chunked upload
        for (let i = 0; i < totalChunks; i++) {
          if (ac.signal.aborted) return null;
          if (pausedRef.current.has(item.id)) {
            updateItem(item.id, { status: "paused" });
            return null;
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, item.file.size);
          const blob = item.file.slice(start, end);

          const formData = new FormData();
          formData.append("chunk", blob);

          const resp = await fetch(
            `/api/files/upload-chunk?fileId=${initResult.fileId}&index=${i}`,
            { method: "POST", body: formData, signal: ac.signal },
          );
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error || `Chunk ${i} failed`);
          }

          updateItem(item.id, {
            progress: Math.round(((i + 1) / totalChunks) * 100),
            completedChunks: [...(Array.from({ length: i + 1 }, (_, k) => k))],
          });
        }
      } else if (initResult.parts && initResult.uploadId) {
        // S3 multipart
        const parts: { partNumber: number; etag: string }[] = [];

        for (const part of initResult.parts) {
          if (ac.signal.aborted) return null;
          if (pausedRef.current.has(item.id)) {
            updateItem(item.id, { status: "paused" });
            return null;
          }

          const start = (part.partNumber - 1) * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, item.file.size);
          const blob = item.file.slice(start, end);

          const resp = await fetch(part.url, {
            method: "PUT",
            body: blob,
            signal: ac.signal,
          });
          if (!resp.ok) throw new Error(`Part ${part.partNumber} upload failed`);

          const etag = resp.headers.get("ETag") || "";
          parts.push({ partNumber: part.partNumber, etag });

          updateItem(item.id, {
            progress: Math.round((parts.length / initResult.parts!.length) * 100),
          });
        }

        const completed = await completeUpload.mutateAsync({
          fileId: initResult.fileId,
          uploadId: initResult.uploadId,
          parts,
          hash,
        });
        return completed;
      } else if (initResult.uploadUrl) {
        // S3 single PUT (small file)
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
          ac.signal.addEventListener("abort", () => xhr.abort());
          xhr.open("PUT", initResult.uploadUrl!);
          xhr.setRequestHeader(
            "Content-Type",
            item.file.type || "application/octet-stream",
          );
          xhr.send(item.file);
        });
      }

      // 5. Complete upload
      const completed = await completeUpload.mutateAsync({
        fileId: initResult.fileId,
        hash,
      });
      return completed;
    },
    [checkHash, initUpload, completeUpload, contentType, contentId, updateItem],
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
        hashProgress: 0,
        completedChunks: [],
      }));

      setItems((prev) => [...prev, ...newItems]);

      const results: UploadedFile[] = [];
      for (const item of newItems) {
        try {
          const result = await uploadFile(item);
          if (!result) continue; // paused or aborted

          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: "completed", progress: 100, result, isFlashUpload: !it.fileId }
                : it,
            ),
          );

          results.push(result);
          onFileUploaded?.(result);
        } catch (err) {
          if ((err as Error).name === "AbortError") continue;
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

  const handlePause = useCallback((itemId: string) => {
    pausedRef.current.add(itemId);
  }, []);

  const handleResume = useCallback(
    async (itemId: string) => {
      pausedRef.current.delete(itemId);
      const item = items.find((i) => i.id === itemId);
      if (!item || item.status !== "paused") return;

      updateItem(itemId, { status: "uploading" });

      try {
        const result = await uploadFile(item);
        if (result) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === itemId
                ? { ...it, status: "completed", progress: 100, result, isFlashUpload: !it.fileId }
                : it,
            ),
          );
          onFileUploaded?.(result);
          onAllComplete?.([result]);
        }
      } catch (err) {
        updateItem(itemId, {
          status: "error",
          error: err instanceof Error ? err.message : "上传失败",
        });
      }
    },
    [items, uploadFile, updateItem, onFileUploaded, onAllComplete],
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
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      item?.abortController?.abort();
      return prev.filter((i) => i.id !== id);
    });
    pausedRef.current.delete(id);
  }, []);

  const isUploading = items.some(
    (i) => i.status === "uploading" || i.status === "pending" || i.status === "hashing" || i.status === "checking",
  );

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
          支持断点续传和秒传
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
                {item.status === "completed" && item.isFlashUpload ? (
                  <Zap className="h-5 w-5 text-amber-500" />
                ) : item.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : item.status === "error" ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : item.status === "paused" ? (
                  <Pause className="h-5 w-5 text-muted-foreground" />
                ) : item.status === "uploading" ||
                  item.status === "hashing" ||
                  item.status === "checking" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                  {item.status === "hashing" && (
                    <span className="ml-2 text-primary">校验中 {item.hashProgress}%</span>
                  )}
                  {item.status === "checking" && (
                    <span className="ml-2 text-primary">查重中...</span>
                  )}
                  {item.status === "completed" && item.isFlashUpload && (
                    <span className="ml-2 text-amber-600 font-medium">秒传完成</span>
                  )}
                  {item.status === "paused" && (
                    <span className="ml-2 text-muted-foreground">已暂停</span>
                  )}
                  {item.error && (
                    <span className="text-destructive ml-2">{item.error}</span>
                  )}
                </p>
                {item.status === "hashing" && (
                  <Progress value={item.hashProgress} className="mt-1 h-1" />
                )}
                {(item.status === "uploading" || item.status === "paused") && (
                  <Progress value={item.progress} className="mt-1 h-1" />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "uploading" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePause(item.id);
                    }}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {item.status === "paused" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResume(item.id);
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {(item.status === "completed" ||
                  item.status === "error" ||
                  item.status === "paused") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
