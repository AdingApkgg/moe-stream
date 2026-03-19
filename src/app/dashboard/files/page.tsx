"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast-with-sound";
import {
  HardDrive,
  Loader2,
  Trash2,
  MoreHorizontal,
  Unlink,
  ExternalLink,
  Users,
  BarChart3,
  Broom,
  FileIcon,
  ImageIcon,
  VideoIcon,
  FileArchive,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return VideoIcon;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z"))
    return FileArchive;
  return FileIcon;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  UPLOADING: { label: "上传中", variant: "outline" },
  UPLOADED: { label: "已上传", variant: "default" },
  FAILED: { label: "失败", variant: "destructive" },
  DELETED: { label: "已删除", variant: "secondary" },
};

const CONTENT_TYPE_MAP: Record<string, string> = {
  video: "视频",
  game: "游戏",
  imagePost: "图片帖",
};

export default function AdminFilesPage() {
  const [statusFilter, setStatusFilter] = useState("UPLOADED");
  const [mimeFilter, setMimeFilter] = useState("all");
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const {
    data: filesData,
    isLoading: filesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.admin.listFiles.useInfiniteQuery(
    {
      limit: 30,
      status: statusFilter as "UPLOADING" | "UPLOADED" | "FAILED" | "DELETED" | undefined,
      mimePrefix: mimeFilter === "all" ? undefined : mimeFilter,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const { data: userStats, isLoading: statsLoading } =
    trpc.admin.getUserStats.useQuery({ limit: 20 });

  const deleteMutation = trpc.admin.deleteFile.useMutation({
    onSuccess: () => {
      utils.admin.listFiles.invalidate();
      utils.admin.getUserStats.invalidate();
      toast.success("文件已删除");
    },
    onError: (err) => toast.error(err.message),
  });

  const detachMutation = trpc.admin.forceDetach.useMutation({
    onSuccess: () => {
      utils.admin.listFiles.invalidate();
      toast.success("已解除关联");
    },
  });

  const cleanMutation = trpc.admin.cleanStale.useMutation({
    onSuccess: (result) => {
      utils.admin.listFiles.invalidate();
      toast.success(`已清理 ${result.cleaned}/${result.total} 个过期上传`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = useCallback(async () => {
    if (!deleteFileId) return;
    await deleteMutation.mutateAsync({ fileId: deleteFileId });
    setDeleteFileId(null);
  }, [deleteFileId, deleteMutation]);

  const allFiles = filesData?.pages.flatMap((p) => p.items) ?? [];

  if (filesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-primary" />
            文件管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理全站用户上传的文件
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => cleanMutation.mutate()}
          disabled={cleanMutation.isPending}
        >
          {cleanMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Broom className="h-4 w-4 mr-2" />
          )}
          清理过期上传
        </Button>
      </div>

      <Tabs defaultValue="files" className="space-y-4">
        <TabsList>
          <TabsTrigger value="files" className="gap-1.5">
            <HardDrive className="h-3.5 w-3.5" />
            文件列表
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            用量统计
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          {/* 过滤栏 */}
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPLOADED">已上传</SelectItem>
                <SelectItem value="UPLOADING">上传中</SelectItem>
                <SelectItem value="FAILED">失败</SelectItem>
                <SelectItem value="DELETED">已删除</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mimeFilter} onValueChange={setMimeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="image/">图片</SelectItem>
                <SelectItem value="video/">视频</SelectItem>
                <SelectItem value="audio/">音频</SelectItem>
                <SelectItem value="application/">文档</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 文件表格 */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">文件</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>存储策略</TableHead>
                    <TableHead>关联</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无文件
                      </TableCell>
                    </TableRow>
                  ) : (
                    allFiles.map((file) => {
                      const Icon = getFileIcon(file.mimeType);
                      const statusInfo = STATUS_MAP[file.status] || STATUS_MAP.UPLOADED;
                      return (
                        <TableRow key={file.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[240px] text-sm" title={file.filename}>
                                {file.filename}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={file.user.avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {(file.user.nickname || file.user.username)?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">
                                {file.user.nickname || file.user.username}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{formatBytes(file.size)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {file.storagePolicy.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {file.contentType ? (
                              <span>
                                {CONTENT_TYPE_MAP[file.contentType] || file.contentType}
                                <span className="text-muted-foreground ml-1">#{file.contentId}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(file.createdAt).toLocaleDateString("zh-CN")}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {file.url && (
                                  <DropdownMenuItem asChild>
                                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      查看文件
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                {file.contentId && (
                                  <DropdownMenuItem
                                    onClick={() => detachMutation.mutate({ fileId: file.id })}
                                  >
                                    <Unlink className="h-4 w-4 mr-2" />
                                    解除关联
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteFileId(file.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                加载更多
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                用户存储用量排行
              </CardTitle>
              <CardDescription>按已用空间降序排列</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !userStats || userStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  暂无用户文件数据
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>已用空间</TableHead>
                      <TableHead>配额</TableHead>
                      <TableHead>使用率</TableHead>
                      <TableHead>文件数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userStats.map((user) => {
                      const pct =
                        user.storageQuota > 0
                          ? Math.round((user.storageUsed / user.storageQuota) * 100)
                          : 0;
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {(user.nickname || user.username)?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {user.nickname || user.username}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatBytes(user.storageUsed)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatBytes(user.storageQuota)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={pct > 90 ? "destructive" : pct > 70 ? "outline" : "secondary"}
                            >
                              {pct}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{user.fileCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
