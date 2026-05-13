"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-with-sound";
import { formatBytes } from "@/lib/format";
import { FolderCog, Plus, Edit2, Trash2, Loader2, Wifi, Star, Database } from "lucide-react";

const PROVIDERS = [
  { value: "local", label: "本地存储" },
  { value: "s3", label: "Amazon S3" },
  { value: "r2", label: "Cloudflare R2" },
  { value: "minio", label: "MinIO" },
  { value: "oss", label: "阿里云 OSS" },
  { value: "cos", label: "腾讯云 COS" },
];

interface PolicyForm {
  name: string;
  provider: string;
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  customDomain: string;
  pathPrefix: string;
  uploadDir: string;
  maxFileSize: number;
  allowedTypes: string;
  isDefault: boolean;
  enabled: boolean;
  sortOrder: number;
}

const emptyForm: PolicyForm = {
  name: "",
  provider: "local",
  endpoint: "",
  bucket: "",
  region: "",
  accessKey: "",
  secretKey: "",
  customDomain: "",
  pathPrefix: "",
  uploadDir: "./uploads",
  maxFileSize: 1073741824,
  allowedTypes: "",
  isDefault: false,
  enabled: true,
  sortOrder: 0,
};

export default function StoragePoliciesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [testingId, setTestingId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: policies, isLoading } = trpc.admin.listStoragePolicies.useQuery();
  const { data: siteConfig } = trpc.admin.getSiteConfig.useQuery();

  const createMutation = trpc.admin.createStoragePolicy.useMutation({
    onSuccess: () => {
      utils.admin.listStoragePolicies.invalidate();
      toast.success("存储策略已创建");
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.updateStoragePolicy.useMutation({
    onSuccess: () => {
      utils.admin.listStoragePolicies.invalidate();
      toast.success("存储策略已更新");
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteStoragePolicy.useMutation({
    onSuccess: () => {
      utils.admin.listStoragePolicies.invalidate();
      toast.success("存储策略已删除");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.admin.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      setTestingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setTestingId(null);
    },
  });

  const updateConfigMutation = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: () => {
      utils.admin.getSiteConfig.invalidate();
      toast.success("配置已更新");
    },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (policy: NonNullable<typeof policies>[0]) => {
    setEditingId(policy.id);
    setForm({
      name: policy.name,
      provider: policy.provider,
      endpoint: policy.endpoint || "",
      bucket: policy.bucket || "",
      region: policy.region || "",
      accessKey: policy.accessKey || "",
      secretKey: policy.secretKey || "",
      customDomain: policy.customDomain || "",
      pathPrefix: policy.pathPrefix || "",
      uploadDir: policy.uploadDir || "./uploads",
      maxFileSize: policy.maxFileSize,
      allowedTypes: policy.allowedTypes.join(", "),
      isDefault: policy.isDefault,
      enabled: policy.enabled,
      sortOrder: policy.sortOrder,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("请输入策略名称");
      return;
    }

    const data = {
      name: form.name.trim(),
      provider: form.provider as "local" | "s3" | "r2" | "minio" | "oss" | "cos",
      endpoint: form.endpoint || null,
      bucket: form.bucket || null,
      region: form.region || null,
      accessKey: form.accessKey || null,
      secretKey: form.secretKey || null,
      customDomain: form.customDomain || null,
      pathPrefix: form.pathPrefix || null,
      uploadDir: form.uploadDir || null,
      maxFileSize: form.maxFileSize,
      allowedTypes: form.allowedTypes
        ? form.allowedTypes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      isDefault: form.isDefault,
      enabled: form.enabled,
      sortOrder: form.sortOrder,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleTestConnection = (policy: NonNullable<typeof policies>[0]) => {
    setTestingId(policy.id);
    testMutation.mutate({
      provider: policy.provider as "local" | "s3" | "r2" | "minio" | "oss" | "cos",
      endpoint: policy.endpoint,
      bucket: policy.bucket,
      region: policy.region,
      accessKey: policy.accessKey,
      secretKey: policy.secretKey,
    });
  };

  const isS3Like = form.provider !== "local";
  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderCog className="h-6 w-6 text-primary" />
            存储策略
          </h1>
          <p className="text-sm text-muted-foreground mt-1">配置多套存储策略，支持本地 / S3 / R2 / OSS / COS 等</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="text-sm text-muted-foreground">用户文件上传</span>
            <Switch
              checked={siteConfig?.fileUploadEnabled ?? false}
              onCheckedChange={(enabled) => updateConfigMutation.mutate({ fileUploadEnabled: enabled })}
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="text-sm text-muted-foreground">网盘导入</span>
            <Switch
              checked={siteConfig?.cloudImportEnabled ?? false}
              onCheckedChange={(enabled) => updateConfigMutation.mutate({ cloudImportEnabled: enabled })}
            />
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建策略
          </Button>
        </div>
      </div>

      {/* 策略列表 */}
      <div className="space-y-4">
        {policies?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>暂无存储策略</p>
              <p className="text-sm mt-1">请创建至少一个存储策略以启用文件上传</p>
            </CardContent>
          </Card>
        )}

        {policies?.map((policy) => (
          <Card key={policy.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{policy.name}</CardTitle>
                  <Badge variant="outline">
                    {PROVIDERS.find((p) => p.value === policy.provider)?.label || policy.provider}
                  </Badge>
                  {policy.isDefault && (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3" />
                      默认
                    </Badge>
                  )}
                  {!policy.enabled && <Badge variant="secondary">已禁用</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestConnection(policy)}
                    disabled={testingId === policy.id}
                  >
                    {testingId === policy.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4" />
                    )}
                    <span className="ml-1">测试</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(policy)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(policy.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                {policy.provider === "local"
                  ? `本地目录: ${policy.uploadDir || "./uploads"}`
                  : `${policy.endpoint || "默认端点"} / ${policy.bucket || "—"}`}
                {" · "}文件上限: {formatBytes(policy.maxFileSize)}
                {" · "}文件数: {policy.fileCount}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑存储策略" : "新建存储策略"}</DialogTitle>
            <DialogDescription>配置存储策略的连接信息和限制</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>策略名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如: 主图床、视频存储"
              />
            </div>

            <div className="space-y-2">
              <Label>存储类型</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.provider === "local" && (
              <div className="space-y-2">
                <Label>本地目录</Label>
                <Input
                  value={form.uploadDir}
                  onChange={(e) => setForm({ ...form, uploadDir: e.target.value })}
                  placeholder="./uploads"
                />
              </div>
            )}

            {isS3Like && (
              <>
                <div className="space-y-2">
                  <Label>端点 (Endpoint)</Label>
                  <Input
                    value={form.endpoint}
                    onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                    placeholder="https://s3.amazonaws.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>存储桶 (Bucket)</Label>
                    <Input value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>区域 (Region)</Label>
                    <Input
                      value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                      placeholder="auto"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Access Key</Label>
                  <Input
                    value={form.accessKey}
                    onChange={(e) => setForm({ ...form, accessKey: e.target.value })}
                    type="password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input
                    value={form.secretKey}
                    onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                    type="password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>自定义域名（公开访问）</Label>
                  <Input
                    value={form.customDomain}
                    onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
                    placeholder="https://cdn.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>路径前缀</Label>
                  <Input
                    value={form.pathPrefix}
                    onChange={(e) => setForm({ ...form, pathPrefix: e.target.value })}
                    placeholder="site-files"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>单文件上限 (MB)</Label>
                <Input
                  type="number"
                  value={Math.round(form.maxFileSize / (1024 * 1024))}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxFileSize: parseInt(e.target.value || "0") * 1024 * 1024,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value || "0") })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>允许的 MIME 类型（逗号分隔，留空则不限制）</Label>
              <Input
                value={form.allowedTypes}
                onChange={(e) => setForm({ ...form, allowedTypes: e.target.value })}
                placeholder="image/*, video/*, application/zip"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>设为默认策略</Label>
                <p className="text-xs text-muted-foreground">无匹配路由规则时使用此策略</p>
              </div>
              <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
            </div>

            <div className="flex items-center justify-between">
              <Label>启用</Label>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除存储策略？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，该策略下的文件将无法访问。仅在策略下无文件时可删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
                setDeleteId(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
