"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { computeSHA256 } from "@/lib/file-hash";
import { Button } from "@/components/ui/button";
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
  RotateCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

type UploadStatus = "pending" | "hashing" | "checking" | "uploading" | "completing" | "paused" | "completed" | "error";

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
  uploadedBytes?: number;
  speed?: number;
  previewUrl?: string;
  isLocal?: boolean;
  s3UploadId?: string;
}

export interface FileUploaderProps {
  contentType?: "video" | "game" | "imagePost";
  contentId?: string;
  accept?: string;
  maxFiles?: number;
  onFileUploaded?: (file: UploadedFile) => void;
  onAllComplete?: (files: UploadedFile[]) => void;
  className?: string;
  compact?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_FILE_CONCURRENCY = 3;
const MAX_CHUNK_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const SPEED_WINDOW_MS = 5000;

const STATUS_LABELS: Record<UploadStatus, string> = {
  pending: "等待中",
  hashing: "校验中",
  checking: "查重中",
  uploading: "上传中",
  completing: "处理中",
  paused: "已暂停",
  completed: "已完成",
  error: "上传失败",
};

// ─── Utilities ───────────────────────────────────────────────────────────────

class PauseError extends Error {
  constructor() {
    super("paused");
    this.name = "PauseError";
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries: number, signal?: AbortSignal): Promise<T> {
  let last: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (err) {
      last = err as Error;
      if (last.name === "AbortError" || last instanceof PauseError) throw last;
      if (i < retries) await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** i, 10000)));
    }
  }
  throw last!;
}

async function runPool<T>(items: T[], fn: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  const queue = [...items];
  let poolError: Error | null = null;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0 && !poolError) {
        const item = queue.shift()!;
        try {
          await fn(item);
        } catch (err) {
          poolError = err as Error;
        }
      }
    }),
  );
  if (poolError) throw poolError;
}

interface SpeedSample {
  time: number;
  bytes: number;
}

function calcSpeed(samples: SpeedSample[]): number {
  const now = Date.now();
  const recent = samples.filter((s) => now - s.time < SPEED_WINDOW_MS);
  if (recent.length < 2) return 0;
  const dt = (recent.at(-1)!.time - recent[0].time) / 1000;
  return dt > 0 ? (recent.at(-1)!.bytes - recent[0].bytes) / dt : 0;
}

function fileIcon(file: File, className: string) {
  const t = file.type;
  if (t.startsWith("video/") || file.name.endsWith(".m3u8")) return <FileVideo className={className} />;
  if (t.startsWith("image/")) return <FileImage className={className} />;
  if (t.startsWith("audio/")) return <FileAudio className={className} />;
  if (/zip|rar|7z|tar|gz|compressed/.test(t)) return <FileArchive className={className} />;
  return <FileIcon className={className} />;
}

function getAcceptDescription(accept?: string): string {
  if (!accept) return "所有文件";
  const d: string[] = [];
  for (const p of accept.split(",").map((s) => s.trim())) {
    if (p === "video/*" || p === ".m3u8") d.push("视频");
    else if (p === "image/*") d.push("图片");
    else if (p === "audio/*") d.push("音频");
    else if (p.startsWith(".")) d.push(p.toUpperCase());
  }
  return [...new Set(d)].join("、") || "所有文件";
}

function validateFileType(file: File, accept?: string): boolean {
  if (!accept) return true;
  return accept
    .split(",")
    .map((s) => s.trim())
    .some((p) => {
      if (p.endsWith("/*")) return file.type.startsWith(p.replace("/*", "/"));
      if (p.startsWith(".")) return file.name.toLowerCase().endsWith(p.toLowerCase());
      return file.type === p;
    });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatEta(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60}s`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

// ─── FileUploader ────────────────────────────────────────────────────────────

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
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const speedSamplesRef = useRef<Map<string, SpeedSample[]>>(new Map());
  const completedPartsRef = useRef<Map<string, { partNumber: number; etag: string }[]>>(new Map());
  const dragCounterRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const checkHash = trpc.file.checkHash.useMutation();
  const initUpload = trpc.file.initUpload.useMutation();
  const completeUploadMut = trpc.file.completeUpload.useMutation();
  const getResumeUrls = trpc.file.getResumeUrls.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<FileUploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const addSpeedSample = useCallback((itemId: string, bytes: number) => {
    const samples = speedSamplesRef.current.get(itemId) ?? [];
    if (!speedSamplesRef.current.has(itemId)) speedSamplesRef.current.set(itemId, samples);
    const now = Date.now();
    samples.push({ time: now, bytes });
    const cutoff = now - SPEED_WINDOW_MS * 2;
    while (samples.length > 0 && samples[0].time < cutoff) samples.shift();
  }, []);

  const trackProgress = useCallback(
    (itemId: string, loaded: number, total: number) => {
      addSpeedSample(itemId, loaded);
      const samples = speedSamplesRef.current.get(itemId) || [];
      updateItem(itemId, {
        progress: Math.round((loaded / total) * 100),
        uploadedBytes: loaded,
        speed: calcSpeed(samples),
      });
    },
    [updateItem, addSpeedSample],
  );

  // ─── Upload Helpers ──────────────────────────────────────────────────────

  const uploadLocalChunks = useCallback(
    async (
      itemId: string,
      fileId: string,
      file: File,
      totalChunks: number,
      completed: Set<number>,
      ac: AbortController,
    ) => {
      const remaining = Array.from({ length: totalChunks }, (_, i) => i).filter((i) => !completed.has(i));
      let uploadedBytes = Math.min(completed.size * CHUNK_SIZE, file.size);

      await runPool(
        remaining,
        async (idx) => {
          if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
          if (pausedRef.current.has(itemId)) throw new PauseError();

          await withRetry(
            async () => {
              const start = idx * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const fd = new FormData();
              fd.append("chunk", file.slice(start, end));
              const resp = await fetch(`/api/files/upload-chunk?fileId=${fileId}&index=${idx}`, {
                method: "POST",
                body: fd,
                signal: ac.signal,
              });
              if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                throw new Error((body as { error?: string }).error || `分片 ${idx} 上传失败`);
              }
            },
            MAX_RETRIES,
            ac.signal,
          );

          uploadedBytes += Math.min(CHUNK_SIZE, file.size - idx * CHUNK_SIZE);
          trackProgress(itemId, Math.min(uploadedBytes, file.size), file.size);
        },
        MAX_CHUNK_CONCURRENCY,
      );
    },
    [trackProgress],
  );

  const uploadS3Parts = useCallback(
    async (
      itemId: string,
      file: File,
      parts: { partNumber: number; url: string }[],
      ac: AbortController,
      startBytes = 0,
    ): Promise<{ partNumber: number; etag: string }[]> => {
      const results: { partNumber: number; etag: string }[] = [];
      let uploadedBytes = startBytes;

      await runPool(
        parts,
        async (part) => {
          if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
          if (pausedRef.current.has(itemId)) throw new PauseError();

          const etag = await withRetry(
            async () => {
              const start = (part.partNumber - 1) * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const resp = await fetch(part.url, {
                method: "PUT",
                body: file.slice(start, end),
                signal: ac.signal,
              });
              if (!resp.ok) throw new Error(`分段 ${part.partNumber} 上传失败`);
              return resp.headers.get("ETag") || "";
            },
            MAX_RETRIES,
            ac.signal,
          );

          results.push({ partNumber: part.partNumber, etag });

          const existing = completedPartsRef.current.get(itemId) || [];
          existing.push({ partNumber: part.partNumber, etag });
          completedPartsRef.current.set(itemId, existing);

          uploadedBytes += Math.min(CHUNK_SIZE, file.size - (part.partNumber - 1) * CHUNK_SIZE);
          trackProgress(itemId, Math.min(uploadedBytes, file.size), file.size);
        },
        MAX_CHUNK_CONCURRENCY,
      );

      return results.sort((a, b) => a.partNumber - b.partNumber);
    },
    [trackProgress],
  );

  const uploadSinglePut = useCallback(
    async (itemId: string, file: File, uploadUrl: string, ac: AbortController) => {
      const xhr = new XMLHttpRequest();
      xhrMapRef.current.set(itemId, xhr);
      try {
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) trackProgress(itemId, e.loaded, file.size);
          });
          xhr.addEventListener("load", () =>
            xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`上传失败: ${xhr.status}`)),
          );
          xhr.addEventListener("error", () => reject(new Error("上传失败")));
          xhr.addEventListener("abort", () =>
            reject(pausedRef.current.has(itemId) ? new PauseError() : new DOMException("Aborted", "AbortError")),
          );
          ac.signal.addEventListener("abort", () => xhr.abort());
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.send(file);
        });
      } finally {
        xhrMapRef.current.delete(itemId);
      }
    },
    [trackProgress],
  );

  const uploadFile = useCallback(
    async (item: FileUploadItem, existingHash?: string): Promise<UploadedFile | null> => {
      const ac = new AbortController();
      speedSamplesRef.current.set(item.id, []);
      completedPartsRef.current.delete(item.id);

      // Phase 1: Hash
      let hash: string;
      if (existingHash) {
        hash = existingHash;
        updateItem(item.id, { abortController: ac });
      } else {
        updateItem(item.id, { status: "hashing", abortController: ac, progress: 0, hashProgress: 0 });
        try {
          hash = await computeSHA256(item.file, (pct) => updateItem(item.id, { hashProgress: pct }), ac.signal);
          updateItem(item.id, { hash });
        } catch (err) {
          if ((err as Error).name === "AbortError") return null;
          throw err;
        }
      }

      // Phase 2: Flash upload check
      updateItem(item.id, { status: "checking" });
      try {
        const chk = await checkHash.mutateAsync({
          hash,
          size: item.file.size,
          mimeType: item.file.type || "application/octet-stream",
          filename: item.file.name,
          contentType,
          contentId,
        });
        if (chk.found) {
          updateItem(item.id, { isFlashUpload: true });
          return { ...chk.file, mimeType: chk.file.mimeType };
        }
      } catch {
        /* fall through */
      }

      // Phase 3: Init
      updateItem(item.id, { status: "uploading", progress: 0, uploadedBytes: 0 });
      const init = await initUpload.mutateAsync({
        filename: item.file.name,
        size: item.file.size,
        mimeType: item.file.type || "application/octet-stream",
        hash,
        contentType,
        contentId,
      });
      const totalChunks = init.totalChunks ?? 1;
      updateItem(item.id, { fileId: init.fileId, totalChunks, isLocal: init.isLocal, s3UploadId: init.uploadId });

      // Phase 4: Upload data
      try {
        if (init.isLocal) {
          await uploadLocalChunks(item.id, init.fileId, item.file, totalChunks, new Set(), ac);
        } else if (init.parts && init.uploadId) {
          const parts = await uploadS3Parts(item.id, item.file, init.parts, ac);
          updateItem(item.id, { status: "completing", progress: 100 });
          return await completeUploadMut.mutateAsync({
            fileId: init.fileId,
            uploadId: init.uploadId,
            parts,
            hash,
          });
        } else if (init.uploadUrl) {
          await uploadSinglePut(item.id, item.file, init.uploadUrl, ac);
        }
      } catch (err) {
        if (err instanceof PauseError) {
          updateItem(item.id, { status: "paused" });
          return null;
        }
        throw err;
      }

      // Phase 5: Complete
      updateItem(item.id, { status: "completing", progress: 100 });
      return await completeUploadMut.mutateAsync({ fileId: init.fileId, hash });
    },
    [
      checkHash,
      initUpload,
      completeUploadMut,
      contentType,
      contentId,
      updateItem,
      uploadLocalChunks,
      uploadS3Parts,
      uploadSinglePut,
    ],
  );

  const resumeUpload = useCallback(
    async (item: FileUploadItem): Promise<UploadedFile | null> => {
      if (!item.fileId || !item.hash) return uploadFile(item);

      const ac = new AbortController();
      updateItem(item.id, { status: "uploading", abortController: ac, progress: 0, uploadedBytes: 0 });
      speedSamplesRef.current.set(item.id, []);

      try {
        const prog = await utils.file.getUploadProgress.fetch({ fileId: item.fileId });
        if (prog.status !== "UPLOADING") return uploadFile(item, item.hash);

        const chunks = (prog.uploadedChunks as { index: number; etag?: string }[]) ?? [];

        if (prog.isLocal) {
          const doneSet = new Set(chunks.map((c) => c.index));
          const startBytes = Math.min(doneSet.size * CHUNK_SIZE, item.file.size);
          trackProgress(item.id, startBytes, item.file.size);
          await uploadLocalChunks(item.id, item.fileId, item.file, prog.totalChunks, doneSet, ac);
        } else if (prog.s3UploadId) {
          const clientParts = completedPartsRef.current.get(item.id) || [];
          const doneNumbers = new Set(clientParts.map((p) => p.partNumber));
          const remainNumbers = Array.from({ length: prog.totalChunks }, (_, i) => i + 1).filter(
            (n) => !doneNumbers.has(n),
          );

          if (remainNumbers.length > 0) {
            const freshUrls = await getResumeUrls.mutateAsync({ fileId: item.fileId, partNumbers: remainNumbers });
            const startBytes = Math.min(doneNumbers.size * CHUNK_SIZE, item.file.size);
            const newParts = await uploadS3Parts(item.id, item.file, freshUrls, ac, startBytes);
            const allParts = [...clientParts, ...newParts].sort((a, b) => a.partNumber - b.partNumber);
            updateItem(item.id, { status: "completing", progress: 100 });
            return await completeUploadMut.mutateAsync({
              fileId: item.fileId,
              uploadId: prog.s3UploadId,
              parts: allParts,
              hash: item.hash,
            });
          }
          updateItem(item.id, { status: "completing", progress: 100 });
          return await completeUploadMut.mutateAsync({
            fileId: item.fileId,
            uploadId: prog.s3UploadId,
            parts: clientParts.sort((a, b) => a.partNumber - b.partNumber),
            hash: item.hash,
          });
        } else {
          return uploadFile(item, item.hash);
        }

        updateItem(item.id, { status: "completing", progress: 100 });
        return await completeUploadMut.mutateAsync({ fileId: item.fileId, hash: item.hash });
      } catch (err) {
        if (err instanceof PauseError) {
          updateItem(item.id, { status: "paused" });
          return null;
        }
        throw err;
      }
    },
    [uploadFile, utils, uploadLocalChunks, uploadS3Parts, getResumeUrls, completeUploadMut, updateItem, trackProgress],
  );

  // ─── Actions ─────────────────────────────────────────────────────────────

  const processFiles = useCallback(
    async (files: File[]) => {
      const rejected = files.filter((f) => !validateFileType(f, accept));
      if (rejected.length > 0) {
        toast.error(`${rejected.length} 个文件类型不支持`, { description: `仅支持 ${getAcceptDescription(accept)}` });
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
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));
      setItems((prev) => [...prev, ...newItems]);

      const results: UploadedFile[] = [];

      await Promise.all(
        Array.from({ length: Math.min(MAX_FILE_CONCURRENCY, newItems.length) }, async () => {
          while (newItems.length > 0) {
            const item = newItems.shift()!;
            try {
              const result = await uploadFile(item);
              if (!result) continue;
              setItems((prev) =>
                prev.map((it) =>
                  it.id === item.id
                    ? { ...it, status: "completed", progress: 100, result, isFlashUpload: it.isFlashUpload === true }
                    : it,
                ),
              );
              results.push(result);
              onFileUploaded?.(result);
            } catch (err) {
              if ((err as Error).name === "AbortError") continue;
              updateItem(item.id, { status: "error", error: err instanceof Error ? err.message : "上传失败" });
              toast.error(`${item.file.name}: ${err instanceof Error ? err.message : "上传失败"}`);
            }
          }
        }),
      );

      if (results.length > 0) onAllComplete?.(results);
    },
    [items, maxFiles, accept, uploadFile, updateItem, onFileUploaded, onAllComplete],
  );

  const handlePause = useCallback((itemId: string) => {
    pausedRef.current.add(itemId);
    xhrMapRef.current.get(itemId)?.abort();
  }, []);

  const finishItem = useCallback(
    (itemId: string, result: UploadedFile) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, status: "completed", progress: 100, result, isFlashUpload: it.isFlashUpload === true }
            : it,
        ),
      );
      onFileUploaded?.(result);
      onAllComplete?.([result]);
    },
    [onFileUploaded, onAllComplete],
  );

  const handleResume = useCallback(
    async (itemId: string) => {
      pausedRef.current.delete(itemId);
      const item = itemsRef.current.find((i) => i.id === itemId);
      if (!item || item.status !== "paused") return;
      try {
        const result = await resumeUpload(item);
        if (result) finishItem(itemId, result);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        updateItem(itemId, { status: "error", error: err instanceof Error ? err.message : "上传失败" });
      }
    },
    [resumeUpload, updateItem, finishItem],
  );

  const handleRetry = useCallback(
    async (itemId: string) => {
      const item = itemsRef.current.find((i) => i.id === itemId);
      if (!item || item.status !== "error") return;
      updateItem(itemId, { error: undefined });
      try {
        const result = await resumeUpload(item);
        if (result) finishItem(itemId, result);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        updateItem(itemId, { status: "error", error: err instanceof Error ? err.message : "上传失败" });
      }
    },
    [resumeUpload, updateItem, finishItem],
  );

  // ─── Event Handlers ──────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(Array.from(e.target.files || []));
      e.target.value = "";
    },
    [processFiles],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        item.abortController?.abort();
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
    pausedRef.current.delete(id);
    speedSamplesRef.current.delete(id);
    completedPartsRef.current.delete(id);
  }, []);

  // ─── Computed ────────────────────────────────────────────────────────────

  const isUploading = items.some(
    (i) => i.status === "uploading" || i.status === "pending" || i.status === "hashing" || i.status === "checking",
  );

  const completedCount = items.filter((i) => i.status === "completed").length;
  const totalSize = items.reduce((s, i) => s + i.file.size, 0);
  const overallProgress =
    totalSize > 0 ? Math.round((items.reduce((s, i) => s + (i.progress / 100) * i.file.size, 0) / totalSize) * 100) : 0;
  const totalSpeed = items.filter((i) => i.status === "uploading" && i.speed).reduce((s, i) => s + (i.speed || 0), 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop Zone */}
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
          <span>支持 {getAcceptDescription(accept)}</span>
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

      {/* Upload List */}
      {items.length > 0 && (
        <div className="space-y-2">
          {/* Summary Bar */}
          {items.length > 1 && !compact && (
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                {completedCount === items.length ? "全部完成" : `${completedCount}/${items.length}`}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    completedCount === items.length ? "bg-green-500" : "bg-primary",
                  )}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              {totalSpeed > 0 && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatFileSize(Math.round(totalSpeed))}/s
                </span>
              )}
            </div>
          )}

          {/* Items */}
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <UploadItemRow
                key={item.id}
                item={item}
                onPause={handlePause}
                onResume={handleResume}
                onRetry={handleRetry}
                onRemove={removeItem}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── UploadItemRow ───────────────────────────────────────────────────────────

interface UploadItemRowProps {
  item: FileUploadItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

function UploadItemRow({ item, onPause, onResume, onRetry, onRemove }: UploadItemRowProps) {
  const isActive =
    item.status === "pending" ||
    item.status === "hashing" ||
    item.status === "checking" ||
    item.status === "uploading" ||
    item.status === "completing";
  const showSpinner =
    item.status === "hashing" ||
    item.status === "checking" ||
    item.status === "uploading" ||
    item.status === "completing";
  const showProgress =
    item.status === "hashing" ||
    item.status === "uploading" ||
    item.status === "paused" ||
    item.status === "completing";
  const progressValue = item.status === "hashing" ? item.hashProgress : item.progress;
  const eta =
    item.status === "uploading" && item.speed && item.speed > 0 && item.uploadedBytes != null
      ? Math.ceil((item.file.size - item.uploadedBytes) / item.speed)
      : null;

  const statusIcon = (() => {
    if (showSpinner) return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    if (item.status === "completed" && item.isFlashUpload) return <Zap className="h-3 w-3 text-amber-500" />;
    if (item.status === "completed") return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    if (item.status === "error") return <AlertCircle className="h-3 w-3 text-destructive" />;
    if (item.status === "paused") return <Pause className="h-3 w-3 text-muted-foreground" />;
    return null;
  })();

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-colors",
        item.status === "completed" && "bg-green-500/5 border-green-500/20",
        item.status === "error" && "bg-destructive/5 border-destructive/20",
      )}
    >
      {/* Thumbnail / Icon */}
      <div className="shrink-0">
        {item.previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.previewUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            {statusIcon && (
              <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-px">{statusIcon}</div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "relative flex items-center justify-center h-10 w-10 rounded-lg",
              item.status === "completed"
                ? "bg-green-500/10"
                : item.status === "error"
                  ? "bg-destructive/10"
                  : isActive
                    ? "bg-primary/10"
                    : "bg-muted",
            )}
          >
            {fileIcon(
              item.file,
              cn(
                "h-5 w-5",
                item.status === "completed"
                  ? "text-green-500"
                  : item.status === "error"
                    ? "text-destructive"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground",
              ),
            )}
            {statusIcon && <div className="absolute -bottom-0.5 -right-0.5">{statusIcon}</div>}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{item.file.name}</p>
          {isActive && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {STATUS_LABELS[item.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span>{formatFileSize(item.file.size)}</span>
          {item.status === "hashing" && (
            <span className="text-primary flex items-center gap-0.5">
              <ShieldCheck className="h-3 w-3" />
              {item.hashProgress}%
            </span>
          )}
          {item.status === "uploading" && item.speed != null && item.speed > 0 && (
            <>
              <span className="text-primary">{formatFileSize(Math.round(item.speed))}/s</span>
              {eta != null && eta > 0 && <span>剩余 {formatEta(eta)}</span>}
            </>
          )}
          {item.status === "completed" && item.isFlashUpload && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">秒传完成</span>
          )}
          {item.status === "completed" && !item.isFlashUpload && (
            <span className="text-green-600 dark:text-green-400 font-medium">上传完成</span>
          )}
          {item.status === "paused" && <span>已暂停 · {item.progress}%</span>}
          {item.error && <span className="text-destructive truncate max-w-[200px]">{item.error}</span>}
        </div>
        {showProgress && (
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/10 mt-2">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-out",
                (item.status === "uploading" || item.status === "completing") && "bg-primary",
                item.status === "hashing" && "bg-primary/60",
                item.status === "paused" && "bg-muted-foreground/40",
              )}
              style={{ width: `${progressValue}%` }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {item.status === "uploading" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onPause(item.id);
            }}
          >
            <Pause className="h-4 w-4" />
          </Button>
        )}
        {item.status === "paused" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onResume(item.id);
            }}
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {item.status === "error" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(item.id);
            }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        )}
        {(item.status === "completed" || item.status === "error" || item.status === "paused") && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </m.div>
  );
}
