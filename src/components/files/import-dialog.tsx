"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast-with-sound";
import {
  Cloud,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Download,
  ExternalLink,
} from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

const PROVIDER_TABS = [
  { id: "url" as const, label: "URL", icon: Link2 },
  { id: "google" as const, label: "Google Drive", icon: Cloud },
  { id: "onedrive" as const, label: "OneDrive", icon: Cloud },
  { id: "dropbox" as const, label: "Dropbox", icon: Cloud },
];

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const [tab, setTab] = useState<string>("url");
  const [urlInput, setUrlInput] = useState("");
  const [parsing, setParsing] = useState(false);

  const utils = trpc.useUtils();
  const parseUrlMutation = trpc.import.parseUrl.useMutation();
  const createTaskMutation = trpc.import.createTask.useMutation();
  const getOAuthUrlMutation = trpc.import.getOAuthUrl.useMutation();
  const cancelTaskMutation = trpc.import.cancelTask.useMutation();

  const { data: tasks, refetch: refetchTasks } = trpc.import.listTasks.useQuery(
    { limit: 10 },
    { enabled: open, refetchInterval: open ? 3000 : false },
  );

  const handleImportUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setParsing(true);
    try {
      // First try to parse the URL to detect provider
      const parsed = await parseUrlMutation.mutateAsync({ url: urlInput.trim() });

      const provider = parsed?.provider || "url";
      const filename = parsed?.name || urlInput.split("/").pop()?.split("?")[0] || "imported-file";

      await createTaskMutation.mutateAsync({
        provider,
        sourceUrl: urlInput.trim(),
        sourceFileId: parsed?.fileId ?? undefined,
        sourceName: filename,
        sourceSize: parsed?.size ?? undefined,
        sourceMimeType: parsed?.mimeType ?? undefined,
      });

      toast.success("导入任务已创建");
      setUrlInput("");
      refetchTasks();
      onImportComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建导入任务失败");
    } finally {
      setParsing(false);
    }
  }, [urlInput, parseUrlMutation, createTaskMutation, refetchTasks, onImportComplete]);

  const handleOAuth = useCallback(
    async (provider: "google" | "onedrive") => {
      try {
        const result = await getOAuthUrlMutation.mutateAsync({ provider });
        window.open(result.url, "_blank", "width=600,height=700");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "获取授权链接失败");
      }
    },
    [getOAuthUrlMutation],
  );

  const handleCancel = useCallback(
    async (taskId: string) => {
      try {
        await cancelTaskMutation.mutateAsync({ taskId });
        refetchTasks();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "取消失败");
      }
    },
    [cancelTaskMutation, refetchTasks],
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return "等待中";
      case "DOWNLOADING":
        return "下载中";
      case "PROCESSING":
        return "处理中";
      case "COMPLETED":
        return "已完成";
      case "FAILED":
        return "失败";
      case "CANCELLED":
        return "已取消";
      default:
        return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            从网盘导入
          </DialogTitle>
          <DialogDescription>
            从网盘或 URL 导入文件到您的存储空间
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            {PROVIDER_TABS.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="text-xs gap-1">
                <p.icon className="h-3.5 w-3.5" />
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* URL import */}
          <TabsContent value="url" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="粘贴文件直链或网盘分享链接..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
              />
              <Button onClick={handleImportUrl} disabled={parsing || !urlInput.trim()}>
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : "导入"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              支持直接下载链接、Google Drive、OneDrive、Dropbox 分享链接
            </p>
          </TabsContent>

          {/* Google Drive */}
          <TabsContent value="google" className="mt-4 space-y-3">
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground text-center">
                授权后可选择 Google Drive 中的文件导入
              </p>
              <Button
                variant="outline"
                onClick={() => handleOAuth("google")}
                disabled={getOAuthUrlMutation.isPending}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                授权 Google Drive
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="或粘贴 Google Drive 分享链接..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
              />
              <Button onClick={handleImportUrl} disabled={parsing || !urlInput.trim()} size="sm">
                导入
              </Button>
            </div>
          </TabsContent>

          {/* OneDrive */}
          <TabsContent value="onedrive" className="mt-4 space-y-3">
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground text-center">
                授权后可选择 OneDrive 中的文件导入
              </p>
              <Button
                variant="outline"
                onClick={() => handleOAuth("onedrive")}
                disabled={getOAuthUrlMutation.isPending}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                授权 OneDrive
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="或粘贴 OneDrive 分享链接..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
              />
              <Button onClick={handleImportUrl} disabled={parsing || !urlInput.trim()} size="sm">
                导入
              </Button>
            </div>
          </TabsContent>

          {/* Dropbox */}
          <TabsContent value="dropbox" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="粘贴 Dropbox 分享链接..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
              />
              <Button onClick={handleImportUrl} disabled={parsing || !urlInput.trim()}>
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : "导入"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Dropbox 分享链接无需授权即可导入
            </p>
          </TabsContent>
        </Tabs>

        {/* Import tasks */}
        {tasks && tasks.items.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium">导入任务</h4>
            {tasks.items.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border p-2.5 text-sm"
              >
                <div className="shrink-0">{statusIcon(task.status)}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-xs">{task.sourceName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{statusLabel(task.status)}</span>
                    {task.sourceSize && (
                      <span>{formatBytes(task.sourceSize)}</span>
                    )}
                    {task.error && (
                      <span className="text-destructive truncate">{task.error}</span>
                    )}
                  </div>
                  {(task.status === "DOWNLOADING" || task.status === "PROCESSING") && (
                    <Progress value={task.progress} className="mt-1 h-1" />
                  )}
                </div>
                {(task.status === "PENDING" || task.status === "DOWNLOADING") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleCancel(task.id)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
