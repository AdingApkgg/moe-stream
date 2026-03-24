import { useState, useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import type { TagItem, BatchProgress } from "./types";

function useSyncRef<T>(ref: RefObject<T>, value: T) {
  useEffect(() => { ref.current = value; });
}

let _counter = 0;
export function nextEntryId(prefix: string) {
  return `${prefix}-${++_counter}`;
}

export function extractTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const filename = u.pathname.split("/").pop() || "";
    const name = filename.replace(/\.[^.]+$/, "");
    return decodeURIComponent(name).replace(/[_-]+/g, " ").trim();
  } catch {
    return "";
  }
}

export function useBatchTags(maxTags = 10) {
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const newTagsCountRef = useRef(0);
  useSyncRef(newTagsCountRef, newTags.length);

  const tagNames = useMemo(
    () => [...selectedTags.map(t => t.name), ...newTags],
    [selectedTags, newTags],
  );

  const toggleTag = useCallback((tag: TagItem) => {
    setSelectedTags(prev => {
      if (prev.some(t => t.id === tag.id)) return prev.filter(t => t.id !== tag.id);
      if (prev.length + newTagsCountRef.current >= maxTags) return prev;
      return [...prev, tag];
    });
  }, [maxTags]);

  const addNewTag = useCallback((name: string) => {
    setNewTags(prev => [...prev, name]);
  }, []);

  const removeNewTag = useCallback((name: string) => {
    setNewTags(prev => prev.filter(t => t !== name));
  }, []);

  return { selectedTags, newTags, tagNames, toggleTag, addNewTag, removeNewTag };
}

export function useBatchImport<TResult>() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress>({ current: 0, total: 0 });
  const [results, setResults] = useState<TResult[]>([]);
  return { importing, setImporting, progress, setProgress, results, setResults };
}

/**
 * Ctrl/⌘ + Enter 快捷键提交，用 ref 避免频繁重新注册事件
 */
export function useSubmitShortcut(onSubmit: () => void, enabled: boolean) {
  const submitRef = useRef(onSubmit);
  useSyncRef(submitRef, onSubmit);
  const enabledRef = useRef(enabled);
  useSyncRef(enabledRef, enabled);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && enabledRef.current) {
        e.preventDefault();
        submitRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

interface ChunkedSubmitOptions<TEntry, TResult> {
  entries: TEntry[];
  chunkSize?: number;
  submitChunk: (chunk: TEntry[]) => Promise<TResult[]>;
  onProgress: (current: number, total: number) => void;
  onPartialResults: (results: TResult[]) => void;
  makeErrorResult: (entry: TEntry, error: string) => TResult;
}

export async function submitInChunks<TEntry, TResult>({
  entries,
  chunkSize = 100,
  submitChunk,
  onProgress,
  onPartialResults,
  makeErrorResult,
}: ChunkedSubmitOptions<TEntry, TResult>): Promise<TResult[]> {
  const totalChunks = Math.ceil(entries.length / chunkSize);
  onProgress(0, totalChunks);
  const allResults: TResult[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = entries.slice(i * chunkSize, (i + 1) * chunkSize);
    try {
      const chunkResults = await submitChunk(chunk);
      allResults.push(...chunkResults);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      allResults.push(...chunk.map(e => makeErrorResult(e, errorMsg)));
    }
    onProgress(i + 1, totalChunks);
    onPartialResults([...allResults]);
  }

  return allResults;
}
