"use client";

import { useCallback, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { Plus, Search, Shield, UsersRound } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GroupCard } from "./_components/group-card";
import { GroupFormDialog, type GroupFormValues } from "./_components/group-form-dialog";
import { DeleteGroupDialog } from "./_components/delete-group-dialog";
import type { GroupItem } from "./_components/types";

export default function GroupsClient() {
  const utils = trpc.useUtils();
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<GroupItem | null>(null);
  const [search, setSearch] = useState("");
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const canManage = !!permissions?.scopes.includes("user:manage");
  const { data: groups, isLoading } = trpc.admin.listGroups.useQuery(undefined, {
    enabled: canManage,
  });

  const createMutation = trpc.admin.createGroup.useMutation({
    onSuccess: () => {
      toast.success("用户组已创建");
      utils.admin.listGroups.invalidate();
      setIsCreating(false);
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

  const reorderMutation = trpc.admin.reorderGroups.useMutation({
    onSuccess: () => {
      utils.admin.listGroups.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
      setOrderOverride(null);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 拖拽时使用 orderOverride 临时显示新顺序,服务端返回后失效
  const orderedGroups = useMemo<GroupItem[]>(() => {
    if (!groups) return [];
    const list = groups as unknown as GroupItem[];
    if (!orderOverride) return list;
    const map = new Map(list.map((g) => [g.id, g]));
    const reordered: GroupItem[] = [];
    for (const id of orderOverride) {
      const g = map.get(id);
      if (g) {
        reordered.push(g);
        map.delete(id);
      }
    }
    return [...reordered, ...map.values()];
  }, [groups, orderOverride]);

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return orderedGroups;
    return orderedGroups.filter(
      (g) => g.name.toLowerCase().includes(keyword) || (g.description ?? "").toLowerCase().includes(keyword),
    );
  }, [orderedGroups, search]);

  const defaultGroupName = useMemo(() => orderedGroups.find((g) => g.isDefault)?.name, [orderedGroups]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = orderedGroups.findIndex((g) => g.id === active.id);
      const newIndex = orderedGroups.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(orderedGroups, oldIndex, newIndex);
      const ids = reordered.map((g) => g.id);
      setOrderOverride(ids);
      reorderMutation.mutate({ groupIds: ids });
    },
    [orderedGroups, reorderMutation],
  );

  const handleSubmit = (values: GroupFormValues) => {
    if (editingGroup) {
      updateMutation.mutate({
        id: editingGroup.id,
        name: values.name,
        description: values.description || null,
        role: values.role,
        permissions: values.permissions,
        adminScopes: values.adminScopes.length > 0 ? values.adminScopes : null,
        storageQuota: values.storageQuota,
        referralMaxLinks: values.referralMaxLinks,
        color: values.color || null,
      });
    } else {
      createMutation.mutate({
        name: values.name,
        description: values.description || undefined,
        role: values.role,
        permissions: values.permissions,
        adminScopes: values.adminScopes.length > 0 ? values.adminScopes : undefined,
        storageQuota: values.storageQuota,
        referralMaxLinks: values.referralMaxLinks,
        color: values.color || undefined,
      });
    }
  };

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mb-4 opacity-30" />
        <p>您没有用户组管理权限</p>
      </div>
    );
  }

  const isOwner = !!permissions?.isOwner;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDialogOpen = isCreating || !!editingGroup;
  const isDraggable = isOwner && !search.trim();

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <UsersRound className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">用户组管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              管理用户组的角色级别、功能权限、推广链接上限和管理权限模板
            </p>
          </div>
        </div>
        {isOwner && (
          <Button onClick={() => setIsCreating(true)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            新建用户组
          </Button>
        )}
      </div>

      {/* 搜索 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="按名称或描述搜索"
          className="pl-9"
        />
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
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search ? `没有找到匹配「${search}」的用户组` : "暂无用户组"}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredGroups.map((g) => g.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  canManage={isOwner}
                  isDraggable={isDraggable}
                  onSetDefault={() => setDefaultMutation.mutate({ groupId: group.id })}
                  onEdit={() => setEditingGroup(group)}
                  onDelete={() => setDeletingGroup(group)}
                  isSettingDefault={setDefaultMutation.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <GroupFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditingGroup(null);
          }
        }}
        group={editingGroup}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />

      <DeleteGroupDialog
        group={deletingGroup}
        defaultGroupName={defaultGroupName}
        isPending={deleteMutation.isPending}
        onCancel={() => setDeletingGroup(null)}
        onConfirm={() => deletingGroup && deleteMutation.mutate({ id: deletingGroup.id })}
      />
    </div>
  );
}
