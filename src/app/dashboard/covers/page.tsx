"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  ListOrdered,
  BarChart3,
  Trash2,
  AlertTriangle,
  ExternalLink,
  HardDrive,
  ScrollText,
  Upload,
} from "lucide-react";
import { toast } from "@/lib/toast-with-sound";
import Link from "next/link";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelative(date: Date | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

export default function CoversPage() {
  const { data: perms } = trpc.admin.getMyPermissions.useQuery();
  const canManage = perms?.scopes?.includes("video:manage") || perms?.role === "OWNER";

  const utils = trpc.useUtils();
  const statsQuery = trpc.admin.getCoverStats.useQuery(undefined, {
    enabled: !!canManage,
    refetchInterval: 10000,
  });

  const [backfillLimit, setBackfillLimit] = useState(50);
  const [videoIdsInput, setVideoIdsInput] = useState("");
  const [seriesIdInput, setSeriesIdInput] = useState("");

  const resetStatsMut = trpc.admin.resetCoverStats.useMutation({
    onSuccess: () => {
      toast.success("统计数据已重置");
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => toast.error(`重置失败: ${e.message}`),
  });

  const backfillMut = trpc.admin.triggerCoverBackfill.useMutation({
    onSuccess: (data) => {
      toast.success(`找到 ${data.found} 个视频，${data.queued} 个已入队`);
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => toast.error(`补全失败: ${e.message}`),
  });

  const regenerateMut = trpc.admin.regenerateCovers.useMutation({
    onSuccess: (data) => {
      toast.success(`已重置 ${data.resetCount} 个视频封面，${data.queued} 个已入队`);
      setVideoIdsInput("");
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => toast.error(`重新生成失败: ${e.message}`),
  });

  const resetCoversMut = trpc.admin.resetCovers.useMutation({
    onSuccess: (data) => {
      toast.success(`已重置 ${data.resetCount} 个封面，${data.queuedCount} 个已入队`);
      setSeriesIdInput("");
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => toast.error(`重置失败: ${e.message}`),
  });

  const clearPermFailedMut = trpc.admin.clearPermFailed.useMutation({
    onSuccess: (data) => {
      toast.success(`已清除 ${data.cleared} 个视频的失败标记`);
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => toast.error(`清除失败: ${e.message}`),
  });

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const generateNowMut = trpc.admin.generateCoverNow.useMutation({
    onSuccess: (data) => {
      toast.success(`封面生成成功 (${(data.elapsed / 1000).toFixed(1)}s)：${data.coverUrl}`);
      setGeneratingId(null);
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      setGeneratingId(null);
    },
  });

  const [uploadVideoId, setUploadVideoId] = useState("");
  const uploadCoverMut = trpc.admin.uploadCover.useMutation({
    onSuccess: (data) => {
      toast.success(`封面上传成功：${data.coverUrl}`);
      setUploadVideoId("");
      utils.admin.getCoverStats.invalidate();
    },
    onError: (e) => toast.error(`上传失败: ${e.message}`),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect() {
    const id = uploadVideoId.trim();
    if (!id) {
      toast.error("请先输入视频 ID");
      return;
    }
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("图片大小不能超过 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      uploadCoverMut.mutate({ videoId: uploadVideoId.trim(), imageBase64: base64 });
    };
    reader.readAsDataURL(file);

    // 重置 input 以允许重复选择同一文件
    e.target.value = "";
  }

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">您没有视频管理权限</p>
      </div>
    );
  }

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;
  const coverPercent = stats?.db ? Math.round((stats.db.withCover / Math.max(stats.db.total, 1)) * 100) : 0;
  const blurPercent = stats?.db ? Math.round((stats.db.withBlur / Math.max(stats.db.total, 1)) * 100) : 0;
  const successRate = stats && stats.count > 0
    ? Math.round((stats.success / stats.count) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6" />
            封面管理
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            监控封面自动生成系统的运行状态，管理生成任务
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => utils.admin.getCoverStats.invalidate()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {/* 生成统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">生成成功</p>
                <p className="text-2xl font-bold tabular-nums">{stats?.success ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">生成失败</p>
                <p className="text-2xl font-bold tabular-nums">{stats?.failure ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">平均耗时</p>
                <p className="text-2xl font-bold tabular-nums">
                  {stats ? formatMs(stats.avgMs) : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <ListOrdered className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">队列等待</p>
                <p className="text-2xl font-bold tabular-nums">{stats?.queueLength ?? "-"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">成功率</p>
                <p className="text-2xl font-bold tabular-nums">
                  {successRate !== null ? `${successRate}%` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 封面覆盖情况 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            封面覆盖情况
          </CardTitle>
          <CardDescription>已发布视频的封面状态概览</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stats?.db ? (
            <>
              {/* 进度条 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">封面覆盖率</span>
                    <span className="font-medium">{stats.db.withCover} / {stats.db.total} ({coverPercent}%)</span>
                  </div>
                  <Progress value={coverPercent} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">模糊占位图覆盖率</span>
                    <span className="font-medium">{stats.db.withBlur} / {stats.db.total} ({blurPercent}%)</span>
                  </div>
                  <Progress value={blurPercent} className="h-2" />
                </div>
              </div>

              {/* 详细分类 */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">总视频</p>
                  <p className="text-lg font-semibold tabular-nums">{stats.db.total}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">本地封面</p>
                  </div>
                  <p className="text-lg font-semibold text-green-600 tabular-nums">{stats.db.localCover}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">外部封面</p>
                  </div>
                  <p className="text-lg font-semibold text-blue-600 tabular-nums">{stats.db.externalCover}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">有模糊占位</p>
                  <p className="text-lg font-semibold text-purple-600 tabular-nums">{stats.db.withBlur}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">缺少封面</p>
                  </div>
                  <p className="text-lg font-semibold text-red-600 tabular-nums">{stats.db.noCover}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-20 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              加载中...
            </div>
          )}
        </CardContent>
      </Card>

      {/* 缺少封面的视频 */}
      {stats?.db?.recentNoCover && stats.db.recentNoCover.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              最近缺少封面的视频
            </CardTitle>
            <CardDescription>
              最近上传但尚未生成封面的 {stats.db.recentNoCover.length} 个视频
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.db.recentNoCover.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="shrink-0 font-mono text-xs">{v.id}</Badge>
                    <span className="text-sm truncate">{v.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{formatRelative(v.createdAt)}</span>
                    <Link href={`/video/${v.id}`} target="_blank">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setGeneratingId(v.id);
                        generateNowMut.mutate({ videoId: v.id });
                      }}
                      disabled={generatingId === v.id}
                    >
                      {generatingId === v.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5 mr-1" />
                      )}
                      立即生成
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {stats.db.noCover > stats.db.recentNoCover.length && (
              <p className="text-xs text-muted-foreground mt-3">
                还有 {stats.db.noCover - stats.db.recentNoCover.length} 个视频缺少封面，使用下方「补全缺失封面」批量处理
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 永久失败的视频 */}
      {stats?.db?.permFailedIds && stats.db.permFailedIds.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              永久失败的视频
            </CardTitle>
            <CardDescription>
              以下 {stats.db.permFailedIds.length} 个视频多次生成失败，已停止自动重试。
              可能是视频 URL 无法访问或格式不兼容。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {stats.db.permFailedIds.map((id) => (
                <div key={id} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
                  <Badge variant="outline" className="font-mono text-xs border-red-300 dark:border-red-800">{id}</Badge>
                  <Link href={`/video/${id}`} target="_blank">
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs"
                    onClick={() => {
                      setGeneratingId(id);
                      clearPermFailedMut.mutate({ videoIds: [id] });
                      generateNowMut.mutate({ videoId: id });
                    }}
                    disabled={generatingId === id}
                  >
                    {generatingId === id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearPermFailedMut.mutate({
                    videoIds: stats.db.permFailedIds,
                  });
                }}
                disabled={clearPermFailedMut.isPending}
              >
                {clearPermFailedMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                )}
                清除失败标记并重试
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作区域 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 补全缺失封面 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4" />
              补全缺失封面
            </CardTitle>
            <CardDescription>
              扫描缺少封面的已发布视频并入队
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">数量</span>
              <Input
                type="number"
                min={1}
                max={500}
                value={backfillLimit}
                onChange={(e) => setBackfillLimit(Number(e.target.value) || 50)}
                className="w-24"
              />
            </div>
            <Button
              onClick={() => backfillMut.mutate({ limit: backfillLimit })}
              disabled={backfillMut.isPending}
              className="w-full"
            >
              {backfillMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              开始补全
            </Button>
          </CardContent>
        </Card>

        {/* 重新生成指定视频封面 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              重新生成封面
            </CardTitle>
            <CardDescription>
              输入视频 ID（逗号分隔），重新生成
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="例如: 123456, 789012"
              value={videoIdsInput}
              onChange={(e) => setVideoIdsInput(e.target.value)}
            />
            <Button
              onClick={() => {
                const ids = videoIdsInput
                  .split(/[,，\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (ids.length === 0) {
                  toast.error("请输入至少一个视频 ID");
                  return;
                }
                regenerateMut.mutate({ videoIds: ids });
              }}
              disabled={regenerateMut.isPending || !videoIdsInput.trim()}
              className="w-full"
            >
              {regenerateMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              重新生成
            </Button>
          </CardContent>
        </Card>

        {/* 重置合集封面 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              重置合集封面
            </CardTitle>
            <CardDescription>
              输入合集 ID，重置该合集下所有视频封面
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="合集 ID"
              value={seriesIdInput}
              onChange={(e) => setSeriesIdInput(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!seriesIdInput.trim()) {
                  toast.error("请输入合集 ID");
                  return;
                }
                resetCoversMut.mutate({ seriesId: seriesIdInput.trim() });
              }}
              disabled={resetCoversMut.isPending || !seriesIdInput.trim()}
              variant="outline"
              className="w-full"
            >
              {resetCoversMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              重置合集
            </Button>
          </CardContent>
        </Card>

        {/* 手动上传封面 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              手动上传封面
            </CardTitle>
            <CardDescription>
              自动生成失败时，手动上传图片作为封面
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="视频 ID，例如: 693654"
              value={uploadVideoId}
              onChange={(e) => setUploadVideoId(e.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={handleFileSelect}
              disabled={uploadCoverMut.isPending || !uploadVideoId.trim()}
              className="w-full"
            >
              {uploadCoverMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              选择图片上传
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 批量操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">批量操作</CardTitle>
          <CardDescription>高级操作，请谨慎使用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  重置外部封面
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认重置外部封面？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将清除所有非本地生成的封面 URL（外部链接等），并触发自动重新生成。
                    不影响本地已生成的封面。最多处理 500 个视频。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetCoversMut.mutate({ nonLocalOnly: true })}
                    disabled={resetCoversMut.isPending}
                  >
                    {resetCoversMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    确认重置
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  重置所有封面
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认重置所有封面？</AlertDialogTitle>
                  <AlertDialogDescription>
                    这将清除所有视频的封面 URL 和模糊占位图，并触发自动重新生成。
                    此操作不可逆，最多处理 500 个视频。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetCoversMut.mutate({})}
                    disabled={resetCoversMut.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {resetCoversMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    确认重置所有
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  清除统计
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认清除统计数据？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将重置成功/失败计数和平均耗时等统计数据，不影响封面文件和数据库。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetStatsMut.mutate()}
                    disabled={resetStatsMut.isPending}
                  >
                    确认清除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* 生成日志 */}
      <CoverLogPanel canManage={!!canManage} />
    </div>
  );
}

function CoverLogPanel({ canManage }: { canManage: boolean }) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const logsQuery = trpc.admin.getCoverLogs.useQuery(
    { limit: 200 },
    {
      enabled: canManage,
      refetchInterval: autoRefresh ? 3000 : false,
    }
  );

  const clearLogsMut = trpc.admin.clearCoverLogs.useMutation({
    onSuccess: () => {
      toast.success("日志已清除");
      utils.admin.getCoverLogs.invalidate();
    },
  });

  const logs = logsQuery.data?.logs ?? [];

  useEffect(() => {
    if (autoRefresh && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, autoRefresh]);

  function colorize(line: string): string {
    if (line.includes("✓") || line.includes("成功") || line.includes("完成")) return "text-green-400";
    if (line.includes("✗") || line.includes("失败") || line.includes("放弃") || line.includes("异常") || line.includes("错误")) return "text-red-400";
    if (line.includes("重试") || line.includes("超时") || line.includes("警告")) return "text-yellow-400";
    if (line.includes("入队") || line.includes("启动") || line.includes("补全")) return "text-blue-400";
    return "text-zinc-300";
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              生成日志
            </CardTitle>
            <CardDescription>最近 200 条封面生成系统日志</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              {autoRefresh ? "停止" : "自动刷新"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => utils.admin.getCoverLogs.invalidate()}
              disabled={logsQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearLogsMut.mutate()}
              disabled={clearLogsMut.isPending || logs.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              清除
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            暂无日志
          </div>
        ) : (
          <div className="bg-zinc-950 rounded-lg p-4 max-h-[500px] overflow-y-auto font-mono text-xs leading-5 space-y-px">
            {[...logs].reverse().map((line, i) => (
              <div key={i} className={colorize(line)}>
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          共 {logs.length} 条日志{autoRefresh ? "，每 3 秒自动刷新" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
