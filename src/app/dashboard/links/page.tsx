"use client";

import { useState } from "react";
import Image from "next/image";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "@/lib/toast-with-sound";
import {
  Link2,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  Globe,
  MousePointerClick,
  Users,
  RotateCcw,
  BarChart3,
} from "lucide-react";
import { cn, getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelativeTime } from "@/lib/format";

interface FriendLinkItem {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  description: string | null;
  sort: number;
  visible: boolean;
  clicks: number;
  uniqueClicks: number;
  lastClickedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

type OrderByField = "sort" | "clicks" | "uniqueClicks" | "lastClickedAt" | "createdAt";

const ORDER_LABELS: Record<OrderByField, string> = {
  sort: "排序",
  clicks: "总点击",
  uniqueClicks: "独立访客",
  lastClickedAt: "最近点击",
  createdAt: "创建时间",
};

const emptyForm = {
  name: "",
  url: "",
  logo: "",
  description: "",
  sort: 0,
  visible: true,
};

export default function AdminLinksPage() {
  const redirectOpts = useRedirectOptions();
  const [editingLink, setEditingLink] = useState<FriendLinkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [statsLinkId, setStatsLinkId] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<OrderByField>("sort");
  const [form, setForm] = useState(emptyForm);

  const utils = trpc.useUtils();

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const { data: links, isLoading } = trpc.admin.listFriendLinks.useQuery(
    { orderBy, order: "desc" },
    { enabled: permissions?.scopes.includes("settings:manage") },
  );

  const { data: statsData, isLoading: statsLoading } = trpc.admin.getFriendLinkStats.useQuery(
    { id: statsLinkId ?? "", days: 30 },
    { enabled: !!statsLinkId },
  );

  const createMutation = trpc.admin.createFriendLink.useMutation({
    onSuccess: () => {
      toast.success("友情链接已创建");
      utils.admin.listFriendLinks.invalidate();
      setIsCreating(false);
      setForm(emptyForm);
    },
    onError: (error) => toast.error(error.message || "创建失败"),
  });

  const updateMutation = trpc.admin.updateFriendLink.useMutation({
    onSuccess: () => {
      toast.success("友情链接已更新");
      utils.admin.listFriendLinks.invalidate();
      setEditingLink(null);
      setForm(emptyForm);
    },
    onError: (error) => toast.error(error.message || "更新失败"),
  });

  const deleteMutation = trpc.admin.deleteFriendLink.useMutation({
    onSuccess: () => {
      toast.success("友情链接已删除");
      utils.admin.listFriendLinks.invalidate();
      setDeletingId(null);
    },
    onError: (error) => toast.error(error.message || "删除失败"),
  });

  const toggleVisibleMutation = trpc.admin.updateFriendLink.useMutation({
    onSuccess: () => {
      utils.admin.listFriendLinks.invalidate();
    },
    onError: (error) => toast.error(error.message || "更新失败"),
  });

  const resetStatsMutation = trpc.admin.resetFriendLinkStats.useMutation({
    onSuccess: () => {
      toast.success("统计已重置");
      utils.admin.listFriendLinks.invalidate();
      setResettingId(null);
    },
    onError: (error) => toast.error(error.message || "重置失败"),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setIsCreating(true);
  };

  const openEdit = (link: FriendLinkItem) => {
    setEditingLink(link);
    setForm({
      name: link.name,
      url: link.url,
      logo: link.logo || "",
      description: link.description || "",
      sort: link.sort,
      visible: link.visible,
    });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("请输入站点名称");
      return;
    }
    if (!form.url.trim()) {
      toast.error("请输入站点链接");
      return;
    }
    if (!/^https?:\/\/.+/.test(form.url.trim())) {
      toast.error("请输入有效的 URL（以 http:// 或 https:// 开头）");
      return;
    }
    await createMutation.mutateAsync({
      name: form.name.trim(),
      url: form.url.trim(),
      logo: form.logo.trim() || undefined,
      description: form.description.trim() || undefined,
      sort: form.sort,
      visible: form.visible,
    });
  };

  const handleUpdate = async () => {
    if (!editingLink) return;
    if (!form.name.trim()) {
      toast.error("请输入站点名称");
      return;
    }
    if (!form.url.trim()) {
      toast.error("请输入站点链接");
      return;
    }
    if (!/^https?:\/\/.+/.test(form.url.trim())) {
      toast.error("请输入有效的 URL（以 http:// 或 https:// 开头）");
      return;
    }
    await updateMutation.mutateAsync({
      id: editingLink.id,
      name: form.name.trim(),
      url: form.url.trim(),
      logo: form.logo.trim() || undefined,
      description: form.description.trim() || undefined,
      sort: form.sort,
      visible: form.visible,
    });
  };

  const handleToggleVisible = (link: FriendLinkItem) => {
    toggleVisibleMutation.mutate({
      id: link.id,
      visible: !link.visible,
    });
  };

  if (!permissions?.scopes.includes("settings:manage")) {
    return <div className="flex items-center justify-center h-[400px] text-muted-foreground">您没有设置管理权限</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          <h1 className="text-xl font-semibold">友情链接</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={orderBy} onValueChange={(v) => setOrderBy(v as OrderByField)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ORDER_LABELS) as OrderByField[]).map((key) => (
                <SelectItem key={key} value={key}>
                  按{ORDER_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            添加链接
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : !links || links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无友情链接，点击上方「添加链接」创建
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <Card key={link.id} className={cn("transition-colors hover:bg-muted/50", !link.visible && "opacity-70")}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {link.logo ? (
                      <Image
                        src={link.logo}
                        alt={link.name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium block truncate">{link.name}</span>
                        <a
                          href={getRedirectUrl(link.url, redirectOpts)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:underline truncate block"
                        >
                          {link.url}
                        </a>
                      </div>
                      <Badge variant={link.visible ? "default" : "secondary"} className="shrink-0">
                        {link.visible ? "显示" : "隐藏"}
                      </Badge>
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{link.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>排序: {link.sort}</span>
                      <span className="flex items-center gap-1" title="总点击数">
                        <MousePointerClick className="h-3 w-3" />
                        {link.clicks.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1" title="独立访客点击数">
                        <Users className="h-3 w-3" />
                        {link.uniqueClicks.toLocaleString()}
                      </span>
                      {link.lastClickedAt && (
                        <span title={new Date(link.lastClickedAt).toLocaleString()}>
                          最近: {formatRelativeTime(link.lastClickedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setStatsLinkId(link.id)}
                          title="查看统计"
                        >
                          <BarChart3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleToggleVisible(link)}
                          disabled={toggleVisibleMutation.isPending}
                          title={link.visible ? "隐藏" : "显示"}
                        >
                          {link.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a
                            href={getRedirectUrl(link.url, redirectOpts)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="在新标签页打开"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(link)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setResettingId(link.id)}
                          title="重置统计"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => setDeletingId(link.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog
        open={isCreating || !!editingLink}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditingLink(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "编辑友情链接" : "添加友情链接"}</DialogTitle>
            <DialogDescription>{editingLink ? "修改友情链接信息" : "添加一个新的友情链接"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">站点名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例如：某某站点"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">链接 URL *</label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo URL</label>
              <Input
                value={form.logo}
                onChange={(e) => setForm((f) => ({ ...f, logo: e.target.value }))}
                placeholder="https://example.com/logo.png（可选）"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="站点简介（可选）"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">排序</label>
              <Input
                type="number"
                value={form.sort}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sort: parseInt(e.target.value, 10) || 0,
                  }))
                }
                placeholder="数字越大越靠前"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">显示</label>
              <Switch checked={form.visible} onCheckedChange={(v) => setForm((f) => ({ ...f, visible: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setEditingLink(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={editingLink ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingLink ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置统计确认 */}
      <AlertDialog open={!!resettingId} onOpenChange={() => setResettingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要重置该友链的统计数据吗？</AlertDialogTitle>
            <AlertDialogDescription>
              将累计点击数、独立访客数与最近点击时间归零。每日明细仍会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => resettingId && resetStatsMutation.mutate({ id: resettingId })}>
              {resetStatsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 统计详情对话框 */}
      <Dialog open={!!statsLinkId} onOpenChange={(open) => !open && setStatsLinkId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {statsData?.link?.name ?? "友链"}统计
            </DialogTitle>
            <DialogDescription>近 30 天每日点击趋势</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {statsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">总点击</div>
                      <div className="text-2xl font-semibold mt-1">
                        {(statsData?.link?.clicks ?? 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">独立访客</div>
                      <div className="text-2xl font-semibold mt-1">
                        {(statsData?.link?.uniqueClicks ?? 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">最近点击</div>
                      <div className="text-sm font-medium mt-1">
                        {statsData?.link?.lastClickedAt ? formatRelativeTime(statsData.link.lastClickedAt) : "—"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {(() => {
                  const stats = statsData?.stats ?? [];
                  const maxClicks = Math.max(1, ...stats.map((s) => s.clicks));
                  return stats.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                      最近 30 天暂无点击数据
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4">
                      <div className="flex items-end gap-1 h-40">
                        {stats.map((s) => {
                          const date = new Date(s.date);
                          const heightPct = (s.clicks / maxClicks) * 100;
                          return (
                            <div
                              key={date.toISOString()}
                              className="flex-1 flex flex-col items-center justify-end gap-1 group"
                              title={`${date.toLocaleDateString()} · ${s.clicks} 点击 / ${s.uniqueClicks} 独立`}
                            >
                              <div
                                className="w-full bg-primary/70 group-hover:bg-primary rounded-sm transition-colors"
                                style={{ height: `${Math.max(heightPct, 2)}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{new Date(stats[0].date).toLocaleDateString()}</span>
                        <span>{new Date(stats[stats.length - 1].date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsLinkId(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这个友情链接吗？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销，链接将被永久删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate({ id: deletingId })}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
