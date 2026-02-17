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
import { toast } from "sonner";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FriendLinkItem {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  description: string | null;
  sort: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emptyForm = {
  name: "",
  url: "",
  logo: "",
  description: "",
  sort: 0,
  visible: true,
};

export default function AdminLinksPage() {
  const [editingLink, setEditingLink] = useState<FriendLinkItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const utils = trpc.useUtils();

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const { data: links, isLoading } = trpc.admin.listFriendLinks.useQuery(
    undefined,
    { enabled: permissions?.scopes.includes("settings:manage") }
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
    try {
      new URL(form.url);
    } catch {
      toast.error("请输入有效的 URL");
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
    try {
      new URL(form.url);
    } catch {
      toast.error("请输入有效的 URL");
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
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        您没有设置管理权限
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          <h1 className="text-xl font-semibold">友情链接</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          添加链接
        </Button>
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
            <Card
              key={link.id}
              className={cn(
                "transition-colors hover:bg-muted/50",
                !link.visible && "opacity-70"
              )}
            >
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
                        <span className="font-medium block truncate">
                          {link.name}
                        </span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:underline truncate block"
                        >
                          {link.url}
                        </a>
                      </div>
                      <Badge
                        variant={link.visible ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {link.visible ? "显示" : "隐藏"}
                      </Badge>
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {link.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        排序: {link.sort}
                      </span>
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleToggleVisible(link)}
                          disabled={toggleVisibleMutation.isPending}
                          title={link.visible ? "隐藏" : "显示"}
                        >
                          {link.visible ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="在新标签页打开"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(link)}
                        >
                          <Edit2 className="h-3 w-3" />
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
            <DialogTitle>
              {editingLink ? "编辑友情链接" : "添加友情链接"}
            </DialogTitle>
            <DialogDescription>
              {editingLink
                ? "修改友情链接信息"
                : "添加一个新的友情链接"}
            </DialogDescription>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
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
              <Switch
                checked={form.visible}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, visible: v }))
                }
              />
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
              disabled={
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingLink ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这个友情链接吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，链接将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deletingId && deleteMutation.mutate({ id: deletingId })
              }
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
