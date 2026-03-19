"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useStableSession } from "@/lib/hooks";
import { FileUploader, type UploadedFile } from "./file-uploader";
import { FileCard } from "./file-card";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { Paperclip, Plus, Loader2 } from "lucide-react";

interface FileAttachmentPanelProps {
  contentType: "video" | "game" | "imagePost";
  contentId: string;
  uploaderId: string;
}

export function FileAttachmentPanel({
  contentType,
  contentId,
  uploaderId,
}: FileAttachmentPanelProps) {
  const { session } = useStableSession();
  const isOwner = session?.user?.id === uploaderId;

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: files, isLoading } = trpc.file.getByContent.useQuery(
    { contentType, contentId },
    { enabled: !!contentId },
  );

  const detachMutation = trpc.file.detach.useMutation({
    onSuccess: () => {
      utils.file.getByContent.invalidate({ contentType, contentId });
      toast.success("附件已移除");
    },
  });

  const deleteMutation = trpc.file.delete.useMutation({
    onSuccess: () => {
      utils.file.getByContent.invalidate({ contentType, contentId });
      utils.file.getStorageUsage.invalidate();
      toast.success("文件已删除");
    },
  });

  const handleUploadComplete = useCallback(
    (_files: UploadedFile[]) => {
      utils.file.getByContent.invalidate({ contentType, contentId });
      utils.file.getStorageUsage.invalidate();
      setUploadOpen(false);
    },
    [utils, contentType, contentId],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteFileId) return;
    await deleteMutation.mutateAsync({ fileId: deleteFileId });
    setDeleteFileId(null);
  }, [deleteFileId, deleteMutation]);

  if (isLoading) {
    return (
      <section className="mt-6 space-y-3">
        <Skeleton className="h-6 w-24" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!files || (files.length === 0 && !isOwner)) return null;

  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" />
          附件资源
          {files.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({files.length})
            </span>
          )}
        </h3>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加附件
          </Button>
        )}
      </div>

      {files.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={isOwner ? (id) => setDeleteFileId(id) : undefined}
              onDetach={
                isOwner
                  ? (id) => detachMutation.mutate({ fileId: id })
                  : undefined
              }
              showAttachInfo={false}
            />
          ))}
        </div>
      ) : (
        isOwner && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            暂无附件，点击「添加附件」上传文件
          </div>
        )
      )}

      {/* 上传弹窗 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上传附件</DialogTitle>
            <DialogDescription>
              上传的文件将关联到当前内容
            </DialogDescription>
          </DialogHeader>
          <FileUploader
            contentType={contentType}
            contentId={contentId}
            onAllComplete={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteFileId}
        onOpenChange={(open) => !open && setDeleteFileId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除文件？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该文件，且无法恢复。
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
    </section>
  );
}
