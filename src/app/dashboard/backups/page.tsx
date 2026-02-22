"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  DatabaseBackup,
  Loader2,
  Save,
  Play,
  Trash2,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Database,
  FileArchive,
  Settings,
} from "lucide-react";
import { toast } from "@/lib/toast-with-sound";

const backupSettingsSchema = z.object({
  backupEnabled: z.boolean(),
  backupIntervalHours: z.number().int().min(1).max(720),
  backupRetentionDays: z.number().int().min(1).max(365),
  backupIncludeUploads: z.boolean(),
  backupIncludeConfig: z.boolean(),
});

type BackupSettingsValues = z.infer<typeof backupSettingsSchema>;

function formatBytes(bytes: string | number): string {
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type BackupStatusType = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

function StatusBadge({ status }: { status: BackupStatusType }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          等待中
        </Badge>
      );
    case "RUNNING":
      return (
        <Badge variant="default" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          进行中
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          已完成
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          失败
        </Badge>
      );
  }
}

function TypeBadge({ type }: { type: "AUTO" | "MANUAL" }) {
  return type === "AUTO" ? (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" />
      自动
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1">
      <Play className="h-3 w-3" />
      手动
    </Badge>
  );
}

interface IncludesInfo {
  database?: boolean;
  uploads?: boolean;
  config?: boolean;
}

function IncludesBadges({ includes }: { includes: IncludesInfo | null }) {
  if (!includes) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {includes.database && (
        <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
          <Database className="h-2.5 w-2.5" />
          数据库
        </Badge>
      )}
      {includes.uploads && (
        <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
          <FileArchive className="h-2.5 w-2.5" />
          文件
        </Badge>
      )}
      {includes.config && (
        <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
          <Settings className="h-2.5 w-2.5" />
          配置
        </Badge>
      )}
    </div>
  );
}

export default function BackupsPage() {
  const utils = trpc.useUtils();
  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const {
    data: config,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = trpc.admin.getSiteConfig.useQuery(undefined, {
    enabled: !!permissions?.scopes.includes("settings:manage"),
    retry: 1,
  });

  const [page, setPage] = useState(1);
  const {
    data: backupsData,
    isLoading: backupsLoading,
    refetch: refetchBackups,
  } = trpc.admin.listBackups.useQuery(
    { page, pageSize: 20 },
    { enabled: !!permissions?.scopes.includes("settings:manage"), refetchInterval: 5000 },
  );

  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: () => {
      toast.success("备份设置已保存");
      refetchConfig();
    },
    onError: (error) => toast.error(error.message || "保存失败"),
  });

  const triggerBackup = trpc.admin.triggerBackup.useMutation({
    onSuccess: () => {
      toast.success("备份任务已创建");
      refetchBackups();
    },
    onError: (error) => toast.error(error.message || "创建备份失败"),
  });

  const deleteBackup = trpc.admin.deleteBackup.useMutation({
    onSuccess: () => {
      toast.success("备份已删除");
      refetchBackups();
    },
    onError: (error) => toast.error(error.message || "删除失败"),
  });

  const restoreBackup = trpc.admin.restoreBackup.useMutation({
    onSuccess: (result) => {
      const restored = [
        result.database && "数据库",
        result.uploads && "uploads",
        result.config && "配置文件",
      ].filter(Boolean);
      const msg = restored.length > 0
        ? `已恢复: ${restored.join("、")}`
        : "恢复完成";
      if (result.errors.length > 0) {
        toast.error(`${msg}（部分失败: ${result.errors.join("; ")}）`);
      } else {
        toast.success(msg);
      }
    },
    onError: (error) => toast.error(error.message || "恢复失败"),
  });

  const form = useForm<BackupSettingsValues>({
    resolver: zodResolver(backupSettingsSchema),
    defaultValues: {
      backupEnabled: false,
      backupIntervalHours: 24,
      backupRetentionDays: 30,
      backupIncludeUploads: true,
      backupIncludeConfig: true,
    },
  });

  useEffect(() => {
    if (config) {
      const c = config as Record<string, unknown>;
      form.reset({
        backupEnabled: (c.backupEnabled as boolean) ?? false,
        backupIntervalHours: (c.backupIntervalHours as number) ?? 24,
        backupRetentionDays: (c.backupRetentionDays as number) ?? 30,
        backupIncludeUploads: (c.backupIncludeUploads as boolean) ?? true,
        backupIncludeConfig: (c.backupIncludeConfig as boolean) ?? true,
      });
    }
  }, [config, form]);

  const storageProvider = (config as Record<string, unknown> | undefined)?.storageProvider as string | undefined;
  const isStorageConfigured = storageProvider && storageProvider !== "local";

  const onSubmit = (values: BackupSettingsValues) => {
    updateConfig.mutate(values);
  };

  const handleDownload = async (id: string) => {
    try {
      const result = await utils.admin.getBackupDownloadUrl.fetch({ id });
      window.open(result.url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取下载链接失败");
    }
  };

  if (!permissions?.scopes.includes("settings:manage")) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        您没有系统设置权限
      </div>
    );
  }

  if (configLoading && !config) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const records = backupsData?.records ?? [];
  const total = backupsData?.total ?? 0;
  const totalPages = Math.ceil(total / 20);
  const hasRunning = records.some((r) => r.status === "PENDING" || r.status === "RUNNING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DatabaseBackup className="h-6 w-6" />
          数据备份
        </h1>
        <p className="text-muted-foreground mt-1">
          自动或手动备份数据库和文件到对象存储
        </p>
      </div>

      {!isStorageConfigured && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">对象存储未配置</p>
            <p className="mt-0.5">请先前往「系统设置 &gt; 对象存储」配置 S3 兼容的存储服务，才能使用备份功能。</p>
          </div>
        </div>
      )}

      {/* 备份设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            备份设置
          </CardTitle>
          <CardDescription>配置自动备份的参数</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="backupEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>启用自动备份</FormLabel>
                      <FormDescription>按设定的间隔自动执行备份</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!isStorageConfigured}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="backupIntervalHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备份间隔（小时）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 24)}
                        />
                      </FormControl>
                      <FormDescription>例如 24 = 每天一次，6 = 每 6 小时一次</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="backupRetentionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>保留天数</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 30)}
                        />
                      </FormControl>
                      <FormDescription>超过此天数的备份将自动清理</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3">
                <FormLabel>备份内容</FormLabel>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked disabled />
                    <span>数据库（始终包含）</span>
                  </div>
                  <FormField
                    control={form.control}
                    name="backupIncludeUploads"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">uploads 目录</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="backupIncludeConfig"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">配置文件 (.env)</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" disabled={updateConfig.isPending}>
                {updateConfig.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                保存设置
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* 备份记录 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5" />
                备份记录
              </CardTitle>
              <CardDescription className="mt-1">共 {total} 条备份记录</CardDescription>
            </div>
            <Button
              onClick={() => triggerBackup.mutate({
                includeDatabase: true,
                includeUploads: form.getValues("backupIncludeUploads"),
                includeConfig: form.getValues("backupIncludeConfig"),
              })}
              disabled={!isStorageConfigured || triggerBackup.isPending || hasRunning}
            >
              {triggerBackup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              手动备份
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {backupsLoading && records.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暂无备份记录
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm truncate">{record.filename}</span>
                      <StatusBadge status={record.status as BackupStatusType} />
                      <TypeBadge type={record.type as "AUTO" | "MANUAL"} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{formatDate(record.createdAt)}</span>
                      {record.status === "COMPLETED" && record.size !== "0" && (
                        <span>{formatBytes(record.size)}</span>
                      )}
                      <IncludesBadges includes={record.includes as IncludesInfo | null} />
                    </div>
                    {record.status === "FAILED" && record.errorMessage && (
                      <p className="text-xs text-destructive mt-1 truncate max-w-md">
                        {record.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {record.status === "COMPLETED" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(record.id)}
                          title="下载"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={restoreBackup.isPending}
                              title="恢复"
                            >
                              {restoreBackup.isPending && restoreBackup.variables?.id === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                                <AlertTriangle className="h-5 w-5" />
                                确认恢复备份
                              </AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-2">
                                  <p>
                                    即将从备份 <span className="font-mono text-foreground">{record.filename}</span> 恢复数据，此操作将：
                                  </p>
                                  <ul className="list-disc list-inside text-sm space-y-1">
                                    {(record.includes as IncludesInfo)?.database && (
                                      <li><span className="font-medium text-destructive">覆盖当前数据库</span>（所有表数据将被替换）</li>
                                    )}
                                    {(record.includes as IncludesInfo)?.uploads && (
                                      <li>覆盖 uploads 目录中的文件</li>
                                    )}
                                    {(record.includes as IncludesInfo)?.config && (
                                      <li>覆盖 .env 配置文件</li>
                                    )}
                                  </ul>
                                  <p className="text-destructive font-medium pt-1">
                                    此操作不可撤销，建议先手动备份当前数据。
                                  </p>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-amber-600 hover:bg-amber-700"
                                onClick={() => restoreBackup.mutate({ id: record.id })}
                              >
                                确认恢复
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={record.status === "RUNNING"}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除备份 {record.filename} 吗？此操作将同时删除对象存储中的文件，不可恢复。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBackup.mutate({ id: record.id })}
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground flex items-center">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
