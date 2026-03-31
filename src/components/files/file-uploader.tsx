"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { computeSHA256 } from "@/lib/file-hash";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-with-sound";
import {
  X,
  FileIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Pause,
  Play,
  FileVideo,
  FileImage,
  FileArchive,
  FileAudio,
  HardDriveUpload,
  ShieldCheck,
  ArrowUpFromLine,
} from "lucide-react";

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

type UploadStatus = "pending" | "hashing" | "checking" | "uploading" | "paused" | "completed" | "error";

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
  uploadStartTime?: number;
  uploadedBytes?: number;
  speed?: number;
}

interface FileUploaderProps {
  contentType?: "video" | "game" | "imagePost";
  contentId?: string;
  accept?: string;
  maxFiles?: number;
  onFileUploaded?: (file: UploadedFile) => void;
  onAllComplete?: (files: UploadedFile[]) => void;
  className?: string;
  compact?: boolean;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

function getFileTypeIcon(file: File) {
  const type = file.type;
  if (type.startsWith("video/") || file.name.endsWith(".m3u8")) return FileVideo;
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("audio/")) return FileAudio;
  if (
    type.includes("zip") ||
    type.includes("rar") ||
    type.includes("7z") ||
    type.includes("tar") ||
    type.includes("gz") ||
    type.includes("compressed")
  )
    return FileArchive;
  return FileIcon;
}

function getAcceptDescription(accept?: string): string {
  if (!accept) return "所有文件";
  const parts = accept.split(",").map((s) => s.trim());
  const descriptions: string[] = [];
  for (const p of parts) {
    if (p === "video/*" || p === ".m3u8") descriptions.push("视频");
    else if (p === "image/*") descriptions.push("图片");
    else if (p === "audio/*") descriptions.push("音频");
    else if (p.startsWith(".")) descriptions.push(p.toUpperCase());
  }
  return [...new Set(descriptions)].join("、") || "所有文件";
}

function validateFileType(file: File, accept?: string): boolean {
  if (!accept) return true;
  const parts = accept.split(",").map((s) => s.trim());
  for (const p of parts) {
    if (p.endsWith("/*")) {
      const prefix = p.replace("/*", "/");
      if (file.type.startsWith(prefix)) return true;
    } else if (p.startsWith(".")) {
      if (file.name.toLowerCase().endsWith(p.toLowerCase())) return true;
    } else if (file.type === p) {
      return true;
    }
  }
  return false;
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "等待中",
  hashing: "校验中",
  checking: "查重中",
  uploading: "上传中",
  paused: "已暂停",
  completed: "已完成",
  error: "上传失败",
};

export function FileUploader({
  contentType,
  contentId,
  accept,
  maxFiles = 10,
  onFileUploaded,
  onAllComplete,
  className,
  compact,
}: FileUploaderProps) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pausedRef = useRef<Set<string>>(new Set());
  const dragCounterRef = useRef(0);

  const checkHash = trpc.file.checkHash.useMutation();
  const initUpload = trpc.file.initUpload.useMutation();
  const completeUpload = trpc.file.completeUpload.useMutation();

  const updateItem = useCallback((id: string, patch: Partial<FileUploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const uploadFile = useCallback(
    async (item: FileUploadItem): Promise<UploadedFile | null> => {
      const ac = new AbortController();
      updateItem(item.id, { status: "hashing", abortController: ac });

      let hash: string;
      try {
        hash = await computeSHA256(item.file, (pct) => updateItem(item.id, { hashProgress: pct }), ac.signal);
        updateItem(item.id, { hash });
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        throw err;
      }

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
        // fall through to normal upload
      }

      const uploadStart = Date.now();
      updateItem(item.id, { status: "uploading", progress: 0, uploadStartTime: uploadStart, uploadedBytes: 0 });
      const initResult = await initUpload.mutateAsync({
        filename: item.file.name,
        size: item.file.size,
        mimeType: item.file.type || "application/octet-stream",
        hash,
        contentType,
        contentId,
      });

      const totalChunks = initResult.totalChunks ?? 1;
      updateItem(item.id, { fileId: initResult.fileId, totalChunks });

      const trackProgress = (loaded: number) => {
        const elapsed = (Date.now() - uploadStart) / 1000;
        const speed = elapsed > 0 ? loaded / elapsed : 0;
        updateItem(item.id, {
          progress: Math.round((loaded / item.file.size) * 100),
          uploadedBytes: loaded,
          speed,
        });
      };

      if (initResult.isLocal) {
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

          const resp = await fetch(`/api/files/upload-chunk?fileId=${initResult.fileId}&index=${i}`, {
            method: "POST",
            body: formData,
            signal: ac.signal,
          });
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error || `Chunk ${i} failed`);
          }

          trackProgress(end);
          updateItem(item.id, {
            completedChunks: [...Array.from({ length: i + 1 }, (_, k) => k)],
          });
        }
      } else if (initResult.parts && initResult.uploadId) {
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

          trackProgress(end);
        }

        const completed = await completeUpload.mutateAsync({
          fileId: initResult.fileId,
          uploadId: initResult.uploadId,
          parts,
          hash,
        });
        return completed;
      } else if (initResult.uploadUrl) {
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              trackProgress(e.loaded);
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          });
          xhr.addEventListener("error", () => reject(new Error("上传失败")));
          ac.signal.addEventListener("abort", () => xhr.abort());
          xhr.open("PUT", initResult.uploadUrl!);
          xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
          xhr.send(item.file);
        });
      }

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
      const rejected = files.filter((f) => !validateFileType(f, accept));
      if (rejected.length > 0) {
        toast.error(`${rejected.length} 个文件类型不支持`, {
          description: `仅支持 ${getAcceptDescription(accept)}`,
        });
      }

      const valid = files.filter((f) => validateFileType(f, accept));
      const remaining = maxFiles - items.filter((i) => i.status !== "error").length;
      const toUpload = valid.slice(0, Math.max(0, remaining));

      if (valid.length > 0 && toUpload.length === 0) {
        toast.error(`最多同时上传 ${maxFiles} 个文件`);
        return;
      }
      if (toUpload.length === 0) return;

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
          if (!result) continue;

          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "completed", progress: 100, result, isFlashUpload: !it.fileId } : it,
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
          toast.error(`${item.file.name}: ${err instanceof Error ? err.message : "上传失败"}`);
        }
      }

      if (results.length > 0) {
        onAllComplete?.(results);
      }
    },
    [items, maxFiles, accept, uploadFile, updateItem, onFileUploaded, onAllComplete],
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
              it.id === itemId ? { ...it, status: "completed", progress: 100, result, isFlashUpload: !it.fileId } : it,
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

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
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

  const acceptDesc = getAcceptDescription(accept);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed text-center transition-all duration-200 cursor-pointer group",
          compact ? "p-4" : "p-6",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01] shadow-sm shadow-primary/10"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30",
          isUploading && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div
          className={cn(
            "mx-auto rounded-full p-2.5 w-fit transition-colors duration-200",
            compact ? "mb-1.5" : "mb-2.5",
            isDragOver
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
          )}
        >
          {isDragOver ? (
            <ArrowUpFromLine className={cn("animate-bounce", compact ? "h-5 w-5" : "h-6 w-6")} />
          ) : (
            <HardDriveUpload className={compact ? "h-5 w-5" : "h-6 w-6"} />
          )}
        </div>
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          {isDragOver ? "松开即可上传" : "拖拽文件到此处，或点击选择"}
        </p>
        <div
          className={cn(
            "flex items-center justify-center gap-2 text-muted-foreground/60 mt-1",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <span>支持 {acceptDesc}</span>
          <span className="inline-block w-0.5 h-0.5 rounded-full bg-current" />
          <span>秒传 & 断点续传</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const TypeIcon = getFileTypeIcon(item.file);
            const isActive = item.status === "uploading" || item.status === "hashing" || item.status === "checking";
            const eta =
              item.status === "uploading" && item.speed && item.speed > 0 && item.uploadedBytes != null
                ? Math.ceil((item.file.size - item.uploadedBytes) / item.speed)
                : null;

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  item.status === "completed" && "bg-green-500/5 border-green-500/20",
                  item.status === "error" && "bg-destructive/5 border-destructive/20",
                )}
              >
                <div className="shrink-0 relative">
                  {item.status === "completed" && item.isFlashUpload ? (
                    <div className="relative">
                      <TypeIcon className="h-5 w-5 text-amber-500" />
                      <Zap className="h-2.5 w-2.5 text-amber-500 absolute -bottom-0.5 -right-0.5" />
                    </div>
                  ) : item.status === "completed" ? (
                    <div className="relative">
                      <TypeIcon className="h-5 w-5 text-green-500" />
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-500 absolute -bottom-0.5 -right-0.5" />
                    </div>
                  ) : item.status === "error" ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : item.status === "paused" ? (
                    <div className="relative">
                      <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      <Pause className="h-2.5 w-2.5 text-muted-foreground absolute -bottom-0.5 -right-0.5" />
                    </div>
                  ) : isActive ? (
                    <div className="relative">
                      <TypeIcon className="h-5 w-5 text-primary" />
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-primary absolute -bottom-0.5 -right-0.5" />
                    </div>
                  ) : (
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    {isActive && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {STATUS_LABELS[item.status]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(item.file.size)}</span>
                    {item.status === "hashing" && (
                      <>
                        <span className="text-primary flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {item.hashProgress}%
                        </span>
                      </>
                    )}
                    {item.status === "uploading" && item.speed != null && item.speed > 0 && (
                      <>
                        <span className="text-primary">{formatFileSize(Math.round(item.speed))}/s</span>
                        {eta != null && eta > 0 && <span>剩余 {formatEta(eta)}</span>}
                      </>
                    )}
                    {item.status === "completed" && item.isFlashUpload && (
                      <span className="text-amber-600 font-medium">秒传完成</span>
                    )}
                    {item.status === "completed" && !item.isFlashUpload && (
                      <span className="text-green-600 font-medium">上传完成</span>
                    )}
                    {item.status === "paused" && <span>已暂停 · {item.progress}%</span>}
                    {item.error && <span className="text-destructive">{item.error}</span>}
                  </div>
                  {item.status === "hashing" && <Progress value={item.hashProgress} className="mt-1.5 h-1" />}
                  {(item.status === "uploading" || item.status === "paused") && (
                    <Progress value={item.progress} className="mt-1.5 h-1" />
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
                  {(item.status === "completed" || item.status === "error" || item.status === "paused") && (
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
