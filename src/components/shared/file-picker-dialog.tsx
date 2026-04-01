"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  FileIcon,
  Search,
  Check,
  Image as ImageIcon,
  FileVideo,
  File,
  LayoutGrid,
  LayoutList,
  CheckSquare,
  Loader2,
} from "lucide-react";

interface FilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  onSelectMultiple?: (urls: string[]) => void;
  multiple?: boolean;
  mimePrefix?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}天前`;
  return date.toLocaleDateString("zh-CN");
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return FileVideo;
  return File;
}

export function FilePickerDialog({
  open,
  onOpenChange,
  onSelect,
  onSelectMultiple,
  multiple,
  mimePrefix,
}: FilePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const isImageMode = mimePrefix?.startsWith("image") ?? false;
  const [viewMode, setViewMode] = useState<"grid" | "list">(isImageMode ? "grid" : "list");

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 300);
  }, []);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.file.list.useInfiniteQuery(
    {
      limit: 30,
      ...(mimePrefix ? { mimePrefix } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    },
    {
      enabled: open,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const allFiles = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const allVisibleUrls = useMemo(() => allFiles.map((f) => f.url), [allFiles]);
  const allSelected = multiple && allFiles.length > 0 && allFiles.every((f) => selectedUrls.has(f.url));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        for (const url of allVisibleUrls) next.delete(url);
        return next;
      });
    } else {
      setSelectedUrls((prev) => new Set([...prev, ...allVisibleUrls]));
    }
  }, [allSelected, allVisibleUrls]);

  const handleConfirm = useCallback(() => {
    if (multiple && onSelectMultiple) {
      if (selectedUrls.size > 0) {
        onSelectMultiple([...selectedUrls]);
        setSelectedUrls(new Set());
        setSearch("");
        setDebouncedSearch("");
      }
    } else if (selectedUrl) {
      onSelect(selectedUrl);
      setSelectedUrl(null);
      setSearch("");
      setDebouncedSearch("");
    }
  }, [multiple, selectedUrl, selectedUrls, onSelect, onSelectMultiple]);

  const resetState = useCallback(() => {
    setSelectedUrl(null);
    setSelectedUrls(new Set());
    setSearch("");
    setDebouncedSearch("");
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetState();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="h-5 w-5" />
            选择文件
          </DialogTitle>
          <DialogDescription>从已上传的文件中选择{multiple ? "（可多选）" : ""}</DialogDescription>
        </DialogHeader>

        {/* 工具栏：搜索 + 视图切换 + 全选 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件名..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-r-none", viewMode === "grid" && "bg-muted")}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-l-none", viewMode === "list" && "bg-muted")}
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          ) : allFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FileIcon className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{debouncedSearch ? "未找到匹配文件" : "暂无已上传文件"}</p>
            </div>
          ) : viewMode === "grid" ? (
            /* 网格视图 */
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {allFiles.map((file) => {
                const isSelected = multiple ? selectedUrls.has(file.url) : selectedUrl === file.url;
                const isImage = file.mimeType.startsWith("image/");
                return (
                  <button
                    key={file.id}
                    type="button"
                    className={cn(
                      "relative group rounded-lg overflow-hidden border transition-all aspect-square",
                      isSelected ? "ring-2 ring-primary border-primary" : "hover:border-primary/40",
                    )}
                    onClick={() => {
                      if (multiple) {
                        setSelectedUrls((prev) => {
                          const next = new Set(prev);
                          if (next.has(file.url)) next.delete(file.url);
                          else next.add(file.url);
                          return next;
                        });
                      } else {
                        setSelectedUrl(isSelected ? null : file.url);
                      }
                    }}
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted p-2">
                        {file.mimeType.startsWith("video/") ? (
                          <FileVideo className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <File className="h-6 w-6 text-muted-foreground" />
                        )}
                        <span className="text-[10px] text-muted-foreground text-center truncate w-full px-1">
                          {file.filename}
                        </span>
                      </div>
                    )}
                    {/* 选中指示 */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/10">
                        <div className="absolute top-1 right-1 rounded-full bg-primary p-0.5">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    {/* 悬停信息 */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white truncate">{file.filename}</p>
                      <p className="text-[9px] text-white/70">{formatBytes(file.size)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* 列表视图 */
            <div className="space-y-1">
              {allFiles.map((file) => {
                const Icon = getMimeIcon(file.mimeType);
                const isSelected = multiple ? selectedUrls.has(file.url) : selectedUrl === file.url;
                const isImage = file.mimeType.startsWith("image/");
                return (
                  <button
                    key={file.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60",
                    )}
                    onClick={() => {
                      if (multiple) {
                        setSelectedUrls((prev) => {
                          const next = new Set(prev);
                          if (next.has(file.url)) next.delete(file.url);
                          else next.add(file.url);
                          return next;
                        });
                      } else {
                        setSelectedUrl(isSelected ? null : file.url);
                      }
                    }}
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt=""
                        className="h-10 w-10 rounded object-cover shrink-0"
                        loading="lazy"
                        onError={(e) => {
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            e.currentTarget.style.display = "none";
                          }
                        }}
                      />
                    ) : (
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} · {formatDate(file.createdAt)}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {hasNextPage && (
            <div className="flex justify-center pt-2 pb-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    加载中...
                  </>
                ) : (
                  "加载更多"
                )}
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {multiple && allFiles.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="text-xs gap-1.5" onClick={toggleSelectAll}>
                <CheckSquare className="h-3.5 w-3.5" />
                {allSelected ? "取消全选" : "全选当前页"}
              </Button>
            )}
            {multiple && selectedUrls.size > 0 && (
              <span className="text-xs text-muted-foreground">已选 {selectedUrls.size} 个文件</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={multiple ? selectedUrls.size === 0 : !selectedUrl}
              onClick={handleConfirm}
            >
              确认选择{multiple && selectedUrls.size > 0 ? `（${selectedUrls.size}）` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
