"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon, Search, Check, Image as ImageIcon, FileVideo, File } from "lucide-react";

interface FilePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
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

export function FilePickerDialog({ open, onOpenChange, onSelect, mimePrefix }: FilePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.file.list.useInfiniteQuery(
    {
      limit: 20,
      ...(mimePrefix ? { mimePrefix } : {}),
    },
    {
      enabled: open,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const allFiles = data?.pages.flatMap((p) => p.items) ?? [];

  const filtered = search.trim()
    ? allFiles.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase()))
    : allFiles;

  const handleConfirm = useCallback(() => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      setSelectedUrl(null);
      setSearch("");
    }
  }, [selectedUrl, onSelect]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSelectedUrl(null);
          setSearch("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="h-5 w-5" />
            选择文件
          </DialogTitle>
          <DialogDescription>从已上传的文件中选择</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文件名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[320px] -mx-1 px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FileIcon className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{search ? "未找到匹配文件" : "暂无已上传文件"}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((file) => {
                const Icon = getMimeIcon(file.mimeType);
                const isSelected = selectedUrl === file.url;
                return (
                  <button
                    key={file.id}
                    type="button"
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                    }`}
                    onClick={() => setSelectedUrl(isSelected ? null : file.url)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
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

              {hasNextPage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs mt-1"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "加载中..." : "加载更多"}
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" size="sm" disabled={!selectedUrl} onClick={handleConfirm}>
            确认选择
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
