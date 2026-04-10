"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { UsersRound, Plus, Pencil, Trash2, Star, Loader2, Shield, Lock } from "lucide-react";
import { ADMIN_SCOPES } from "@/lib/constants";
import {
  DEFAULT_GROUP_PERMISSIONS,
  GROUP_PERMISSION_LABELS,
  ROLE_LABELS,
  type GroupPermissions,
} from "@/lib/group-permissions";
import { cn } from "@/lib/utils";

type GroupRole = "USER" | "ADMIN" | "OWNER";

interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  role: GroupRole;
  permissions: GroupPermissions;
  adminScopes: string[] | null;
  storageQuota: string;
  isDefault: boolean;
  isSystem: boolean;
  color: string | null;
  sortOrder: number;
  createdAt: Date;
  _count: { users: number };
}

const STORAGE_PRESETS = [
  { label: "1 GB", value: "1073741824" },
  { label: "5 GB", value: "5368709120" },
  { label: "10 GB", value: "10737418240" },
  { label: "20 GB", value: "21474836480" },
  { label: "50 GB", value: "53687091200" },
  { label: "100 GB", value: "107374182400" },
];

function formatStorageQuota(bytes: string): string {
  const n = Number(bytes);
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(1)} TB`;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(0)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(0)} MB`;
  return `${n} B`;
}

function RoleBadge({ role }: { role: GroupRole }) {
  switch (role) {
    case "OWNER":
      return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-[11px]">站长</Badge>;
    case "ADMIN":
      return (
        <Badge variant="secondary" className="text-[11px]">
          管理员
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[11px]">
          用户
        </Badge>
      );
  }
}

function PermissionBadges({ permissions }: { permissions: GroupPermissions }) {
  const keys = Object.keys(GROUP_PERMISSION_LABELS) as (keyof GroupPermissions)[];
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => {
        const enabled = permissions[key];
        if (key === "adsEnabled") {
          return (
            <Badge key={key} variant={enabled ? "outline" : "secondary"} className="text-[11px]">
              {enabled ? "有广告" : "无广告"}
            </Badge>
          );
        }
        return enabled ? (
          <Badge key={key} variant="secondary" className="text-[11px]">
            {GROUP_PERMISSION_LABELS[key]}
          </Badge>
        ) : null;
      })}
    </div>
  );
}

function AdminScopesBadges({ scopes }: { scopes: string[] | null }) {
  if (!scopes?.length) return <span className="text-xs text-muted-foreground">无管理权限</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <Badge key={s} variant="outline" className="text-[11px] border-amber-500/30 text-amber-600">
          {ADMIN_SCOPES[s as keyof typeof ADMIN_SCOPES] ?? s}
        </Badge>
      ))}
    </div>
  );
}

interface GroupFormState {
  name: string;
  description: string;
  role: GroupRole;
  permissions: GroupPermissions;
  adminScopes: string[];
  storageQuota: string;
  color: string;
}

const defaultFormState: GroupFormState = {
  name: "",
  description: "",
  role: "USER",
  permissions: { ...DEFAULT_GROUP_PERMISSIONS },
  adminScopes: [],
  storageQuota: "5368709120",
  color: "#6B7280",
};

export default function GroupsClient() {
  const utils = trpc.useUtils();
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<GroupItem | null>(null);
  const [form, setForm] = useState<GroupFormState>(defaultFormState);

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const { data: groups, isLoading } = trpc.admin.listGroups.useQuery(undefined, {
    enabled: !!permissions?.scopes.includes("user:manage"),
  });

  const createMutation = trpc.admin.createGroup.useMutation({
    onSuccess: () => {
      toast.success("用户组已创建");
      utils.admin.listGroups.invalidate();
      setIsCreating(false);
      setForm(defaultFormState);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.updateGroup.useMutation({
    onSuccess: () => {
      toast.success("用户组已更新");
      utils.admin.listGroups.invalidate();
      setEditingGroup(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteGroup.useMutation({
    onSuccess: () => {
      toast.success("用户组已删除");
      utils.admin.listGroups.invalidate();
      setDeletingGroup(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const setDefaultMutation = trpc.admin.setDefaultGroup.useMutation({
    onSuccess: () => {
      toast.success("默认用户组已更新");
      utils.admin.listGroups.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!permissions?.scopes.includes("user:manage")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mb-4 opacity-30" />
        <p>您没有用户组管理权限</p>
      </div>
    );
  }

  const openCreate = () => {
    setForm(defaultFormState);
    setIsCreating(true);
  };

  const openEdit = (group: GroupItem) => {
    setForm({
      name: group.name,
      description: group.description ?? "",
      role: group.role,
      permissions: { ...group.permissions },
      adminScopes: (group.adminScopes ?? []) as string[],
      storageQuota: group.storageQuota,
      color: group.color ?? "#6B7280",
    });
    setEditingGroup(group);
  };

  const handleSubmit = () => {
    if (editingGroup) {
      updateMutation.mutate({
        id: editingGroup.id,
        name: form.name,
        description: form.description || null,
        role: form.role,
        permissions: form.permissions,
        adminScopes: form.adminScopes.length > 0 ? form.adminScopes : null,
        storageQuota: form.storageQuota,
        color: form.color || null,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        role: form.role,
        permissions: form.permissions,
        adminScopes: form.adminScopes.length > 0 ? form.adminScopes : undefined,
        storageQuota: form.storageQuota,
        color: form.color || undefined,
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDialogOpen = isCreating || !!editingGroup;
  const isOwnerGroup = editingGroup?.role === "OWNER";

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">用户组管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">管理用户组的角色级别、功能权限和管理权限模板</p>
          </div>
        </div>
        {permissions?.isOwner && (
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            新建用户组
          </Button>
        )}
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups?.map((group) => (
            <Card key={group.id} className="relative overflow-hidden">
              {group.color && (
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: group.color }} />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <RoleBadge role={group.role} />
                    {group.isDefault && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        默认
                      </Badge>
                    )}
                    {group.isSystem && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <Lock className="h-2.5 w-2.5 mr-0.5" />
                        系统
                      </Badge>
                    )}
                  </div>
                  {permissions?.isOwner && (
                    <div className="flex items-center gap-1">
                      {!group.isDefault && group.role === "USER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setDefaultMutation.mutate({ groupId: group.id })}
                          disabled={setDefaultMutation.isPending}
                          title="设为默认组"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(group as GroupItem)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!group.isSystem && group.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingGroup(group as GroupItem)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">功能权限</p>
                  <PermissionBadges permissions={group.permissions} />
                </div>
                {group.role === "ADMIN" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">管理权限</p>
                    <AdminScopesBadges scopes={group.adminScopes as string[] | null} />
                  </div>
                )}
                {group.role === "OWNER" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">管理权限</p>
                    <span className="text-xs text-amber-600 font-medium">全部权限（站长）</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-1 border-t">
                  <span className="text-muted-foreground">
                    成员 <span className="font-medium text-foreground">{group._count.users}</span> 人
                  </span>
                  <span className="text-muted-foreground">
                    配额 <span className="font-medium text-foreground">{formatStorageQuota(group.storageQuota)}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑对话框 */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditingGroup(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "编辑用户组" : "新建用户组"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "修改用户组的角色级别和权限配置" : "创建一个新的用户组"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 基本信息 */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="group-name">名称</Label>
                <Input
                  id="group-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如：VIP 用户组"
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-desc">描述</Label>
                <Textarea
                  id="group-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="可选，用户组的简要说明"
                  rows={2}
                  maxLength={200}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>角色级别</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm((f) => ({ ...f, role: v as GroupRole }))}
                    disabled={isOwnerGroup}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">{ROLE_LABELS.USER}</SelectItem>
                      <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                      <SelectItem value="OWNER" disabled>
                        {ROLE_LABELS.OWNER}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">决定组内成员的基础权限等级</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="group-color">标识颜色</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="group-color"
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="h-9 w-9 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                      className="flex-1 font-mono text-sm"
                      maxLength={20}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 功能权限 */}
            <div className="space-y-3">
              <Label>功能权限</Label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(GROUP_PERMISSION_LABELS) as (keyof GroupPermissions)[]).map((key) => (
                  <div key={key} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                    <Label htmlFor={`perm-${key}`} className="text-sm font-normal cursor-pointer">
                      {GROUP_PERMISSION_LABELS[key]}
                    </Label>
                    <Switch
                      id={`perm-${key}`}
                      checked={form.permissions[key]}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({
                          ...f,
                          permissions: { ...f.permissions, [key]: checked },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 管理员权限（仅 ADMIN 角色级别时显示） */}
            {form.role === "ADMIN" && (
              <div className="space-y-3">
                <Label>管理员权限模板</Label>
                <p className="text-xs text-muted-foreground">组内成员将获得以下管理后台权限</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ADMIN_SCOPES).map(([scope, label]) => (
                    <label
                      key={scope}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors",
                        form.adminScopes.includes(scope) && "border-primary/50 bg-primary/5",
                      )}
                    >
                      <Checkbox
                        checked={form.adminScopes.includes(scope)}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({
                            ...f,
                            adminScopes: checked ? [...f.adminScopes, scope] : f.adminScopes.filter((s) => s !== scope),
                          }))
                        }
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.role === "OWNER" && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
                <p className="text-sm text-amber-600 font-medium">站长组自动拥有全部管理权限，无需单独配置</p>
              </div>
            )}

            {/* 存储配额 */}
            <div className="space-y-3">
              <Label>默认存储配额</Label>
              <div className="flex flex-wrap gap-2">
                {STORAGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant={form.storageQuota === preset.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, storageQuota: preset.value }))}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">当前：{formatStorageQuota(form.storageQuota)}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setEditingGroup(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingGroup ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除用户组</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deletingGroup?.name}」吗？该组下的{" "}
              <span className="font-medium text-foreground">{deletingGroup?._count.users}</span>{" "}
              名用户将被移至默认用户组，其角色也会同步变更。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingGroup && deleteMutation.mutate({ id: deletingGroup.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
