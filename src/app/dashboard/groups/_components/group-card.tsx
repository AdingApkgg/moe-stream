"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Lock, Pencil, Star, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ADMIN_SCOPES } from "@/lib/constants";
import { GROUP_PERMISSION_LABELS, type GroupPermissions } from "@/lib/group-permissions";
import { cn } from "@/lib/utils";
import { formatReferralLinkCap, formatStorageQuota, type GroupItem, type GroupRole } from "./types";

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

interface GroupCardProps {
  group: GroupItem;
  canManage: boolean;
  isDraggable: boolean;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isSettingDefault?: boolean;
}

export function GroupCard({
  group,
  canManage,
  isDraggable,
  onSetDefault,
  onEdit,
  onDelete,
  isSettingDefault,
}: GroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="relative overflow-hidden">
      {group.color && <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: group.color }} />}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {isDraggable && (
              <button
                type="button"
                aria-label="拖拽排序"
                className={cn(
                  "cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground -ml-1",
                  isDragging && "cursor-grabbing",
                )}
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
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
          {canManage && (
            <div className="flex items-center gap-1 shrink-0">
              {!group.isDefault && group.role === "USER" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onSetDefault}
                  disabled={isSettingDefault}
                  title="设为默认组"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} title="编辑">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!group.isSystem && group.role !== "OWNER" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={onDelete}
                  title="删除"
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
            <AdminScopesBadges scopes={group.adminScopes} />
          </div>
        )}
        {group.role === "OWNER" && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">管理权限</p>
            <span className="text-xs text-amber-600 font-medium">全部权限(站长)</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm pt-1 border-t">
          <span className="text-muted-foreground">
            成员 <span className="font-medium text-foreground">{group._count.users}</span> 人
          </span>
          <span className="text-muted-foreground">
            配额 <span className="font-medium text-foreground">{formatStorageQuota(group.storageQuota)}</span>
          </span>
          <span className="text-muted-foreground w-full sm:w-auto">
            推广链接{" "}
            <span className="font-medium text-foreground">{formatReferralLinkCap(group.referralMaxLinks ?? 0)}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
