"use client";

import { useState, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { FileUploader } from "@/components/files/file-uploader";
import { ImportDialog } from "@/components/files/import-dialog";
import { FileCard } from "@/components/files/file-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast-with-sound";
import {
  HardDrive,
  Upload,
  Download,
  FolderOpen,
  Loader2,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function MyFilesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const sessionLoading = sessionStatus === "loading";
  const router = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [mimeFilter, setMimeFilter] = useState("all");

  const utils = trpc.useUtils();

  const { data: usage } = trpc.file.getStorageUsage.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const {
    data: filesData,
    isLoading: filesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.file.list.useInfiniteQuery(
    {
      limit: 24,
      mimePrefix: mimeFilter === "all" ? undefined : mimeFilter,
    },
    {
      enabled: !!session?.user,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const deleteMutation = trpc.file.delete.useMutation({
    onSuccess: () => {
      utils.file.list.invalidate();
      utils.file.getStorageUsage.invalidate();
      toast.success("文件已删除");
    },
  });

  const detachMutation = trpc.file.detach.useMutation({
    onSuccess: () => {
      utils.file.list.invalidate();
      toast.success("已取消关联");
    },
  });

  const handleDelete = useCallback(async () => {
    if (!deleteFileId) return;
    await deleteMutation.mutateAsync({ fileId: deleteFileId });
    setDeleteFileId(null);
  }, [deleteFileId, deleteMutation]);

  const handleDetach = useCallback(
    async (fileId: string) => {
      await detachMutation.mutateAsync({ fileId });
    },
    [detachMutation],
  );

  const handleUploadComplete = useCallback(
    () => {
      utils.file.list.invalidate();
      utils.file.getStorageUsage.invalidate();
    },
    [utils],
  );

  if (sessionLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }

  if (!session?.user) {
    router.push("/login");
    return null;
  }

  const allFiles =
    filesData?.pages.flatMap((page) => page.items) ?? [];

  const usedPercent = usage
    ? Math.min(100, (usage.used / usage.quota) * 100)
    : 0;

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-primary" />
            我的文件
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理上传的文件和附件资源
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            网盘导入
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            上传文件
          </Button>
        </div>
      </div>

      {/* 存储用量 */}
      {usage && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">存储用量</span>
            <span className="font-medium">
              {formatBytes(usage.used)} / {formatBytes(usage.quota)}
            </span>
          </div>
          <Progress value={usedPercent} className="h-2" />
        </div>
      )}

      {/* 过滤 */}
      <div className="flex items-center gap-3">
        <Select value={mimeFilter} onValueChange={setMimeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="文件类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="image/">图片</SelectItem>
            <SelectItem value="video/">视频</SelectItem>
            <SelectItem value="audio/">音频</SelectItem>
            <SelectItem value="application/">文档/压缩包</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 文件列表 */}
      {filesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      ) : allFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">还没有文件</p>
          <p className="text-sm mt-1">点击上方「上传文件」开始</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {allFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onDelete={(id) => setDeleteFileId(id)}
                onDetach={handleDetach}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                加载更多
              </Button>
            </div>
          )}
        </>
      )}

      {/* 上传弹窗 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
            <DialogDescription>
              选择或拖拽文件上传至您的存储空间
            </DialogDescription>
          </DialogHeader>
          <FileUploader
            onAllComplete={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>

      {/* 网盘导入弹窗 */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleUploadComplete}
      />

      {/* 删除确认 */}
      <AlertDialog open={!!deleteFileId} onOpenChange={(open) => !open && setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除文件？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将从存储中永久删除该文件，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
