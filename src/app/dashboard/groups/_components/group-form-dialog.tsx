"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommentEditor } from "@/components/editor/comment-editor";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ADMIN_SCOPES } from "@/lib/constants";
import {
  DEFAULT_GROUP_PERMISSIONS,
  GROUP_PERMISSION_LABELS,
  ROLE_LABELS,
  type GroupPermissions,
} from "@/lib/group-permissions";
import { cn } from "@/lib/utils";
import { STORAGE_PRESETS, bytesToGb, formatStorageQuota, gbToBytes, type GroupItem, type GroupRole } from "./types";

const groupFormSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称不超过 50 个字符"),
  description: z.string().max(200, "描述不超过 200 个字符"),
  role: z.enum(["USER", "ADMIN", "OWNER"]),
  permissions: z.object({
    canUpload: z.boolean(),
    canComment: z.boolean(),
    canDanmaku: z.boolean(),
    canChat: z.boolean(),
    canDownload: z.boolean(),
    adsEnabled: z.boolean(),
  }),
  adminScopes: z.array(z.string()),
  storageQuota: z.string().regex(/^\d+$/, "存储配额必须为正整数(字节)"),
  referralMaxLinks: z.number().int().min(0).max(10000),
  color: z.string().max(20),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;

const defaultValues: GroupFormValues = {
  name: "",
  description: "",
  role: "USER",
  permissions: { ...DEFAULT_GROUP_PERMISSIONS },
  adminScopes: [],
  storageQuota: "5368709120",
  referralMaxLinks: 0,
  color: "#6B7280",
};

function fromGroup(group: GroupItem): GroupFormValues {
  return {
    name: group.name,
    description: group.description ?? "",
    role: group.role,
    permissions: { ...DEFAULT_GROUP_PERMISSIONS, ...group.permissions },
    adminScopes: (group.adminScopes ?? []) as string[],
    storageQuota: group.storageQuota,
    referralMaxLinks: group.referralMaxLinks ?? 0,
    color: group.color ?? "#6B7280",
  };
}

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑场景传入用户组,创建场景留空 */
  group: GroupItem | null;
  isSubmitting: boolean;
  onSubmit: (values: GroupFormValues) => void;
}

export function GroupFormDialog({ open, onOpenChange, group, isSubmitting, onSubmit }: GroupFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {open && (
          <FormBody
            // 通过 key 让每次打开/切换组都重置内部状态,避免在 effect 里 setState
            key={group?.id ?? "new"}
            group={group}
            isSubmitting={isSubmitting}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormBodyProps {
  group: GroupItem | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: GroupFormValues) => void;
}

function FormBody({ group, isSubmitting, onCancel, onSubmit }: FormBodyProps) {
  const isEdit = !!group;
  const isOwnerGroup = group?.role === "OWNER";

  const initialValues = group ? fromGroup(group) : defaultValues;

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: initialValues,
  });

  // 自定义配额输入(GB),初始时若 storageQuota 不是预设值则同步显示
  const [customGb, setCustomGb] = useState<string>(() => {
    const matchPreset = STORAGE_PRESETS.some((p) => p.value === initialValues.storageQuota);
    return matchPreset ? "" : bytesToGb(initialValues.storageQuota).toString();
  });

  const role = useWatch({ control: form.control, name: "role" });
  const storageQuota = useWatch({ control: form.control, name: "storageQuota" });
  const adminScopes = useWatch({ control: form.control, name: "adminScopes" });
  const color = useWatch({ control: form.control, name: "color" });

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
  });

  const setPreset = (bytes: string) => {
    form.setValue("storageQuota", bytes, { shouldDirty: true });
    setCustomGb("");
  };

  const handleCustomGbChange = (raw: string) => {
    setCustomGb(raw);
    if (raw === "") return;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    form.setValue("storageQuota", gbToBytes(num), { shouldDirty: true });
  };

  const toggleScope = (scope: string, checked: boolean) => {
    const current = form.getValues("adminScopes");
    const next = checked ? [...current, scope] : current.filter((s) => s !== scope);
    form.setValue("adminScopes", next, { shouldDirty: true });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "编辑用户组" : "新建用户组"}</DialogTitle>
        <DialogDescription>{isEdit ? "修改用户组的角色级别和权限配置" : "创建一个新的用户组"}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form id="group-form" onSubmit={handleSubmit} className="space-y-5 py-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>名称</FormLabel>
                <FormControl>
                  <Input placeholder="如:VIP 用户组" maxLength={50} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>描述</FormLabel>
                <FormControl>
                  <CommentEditor
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="可选，用户组的简要说明"
                    maxLength={200}
                    minHeight="60px"
                    disableMention
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色级别</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as GroupRole)}
                    disabled={isOwnerGroup}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USER">{ROLE_LABELS.USER}</SelectItem>
                      <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                      <SelectItem value="OWNER" disabled>
                        {ROLE_LABELS.OWNER}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isOwnerGroup ? "站长组的角色级别不可修改" : "决定组内成员的基础权限等级"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标识颜色</FormLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color || "#6B7280"}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-9 w-9 rounded border cursor-pointer"
                      aria-label="选择颜色"
                    />
                    <FormControl>
                      <Input className="flex-1 font-mono text-sm" maxLength={20} {...field} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-3">
            <Label>功能权限</Label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(GROUP_PERMISSION_LABELS) as (keyof GroupPermissions)[]).map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`permissions.${key}` as const}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-md border p-2.5 space-y-0">
                      <FormLabel htmlFor={`perm-${key}`} className="text-sm font-normal cursor-pointer m-0">
                        {GROUP_PERMISSION_LABELS[key]}
                      </FormLabel>
                      <FormControl>
                        <Switch id={`perm-${key}`} checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>

          {role === "ADMIN" && (
            <div className="space-y-3">
              <Label>管理员权限模板</Label>
              <p className="text-xs text-muted-foreground">组内成员将获得以下管理后台权限</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ADMIN_SCOPES).map(([scope, label]) => {
                  const checked = adminScopes.includes(scope);
                  return (
                    <label
                      key={scope}
                      className={cn(
                        "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors",
                        checked && "border-primary/50 bg-primary/5",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={(c) => toggleScope(scope, c === true)} />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {role === "OWNER" && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-sm text-amber-600 font-medium">站长组自动拥有全部管理权限,无需单独配置</p>
            </div>
          )}

          <div className="space-y-3">
            <Label>默认存储配额</Label>
            <div className="flex flex-wrap gap-2">
              {STORAGE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={storageQuota === preset.value && customGb === "" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                value={customGb}
                onChange={(e) => handleCustomGbChange(e.target.value)}
                placeholder="自定义 GB"
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">GB</span>
              <span className="text-xs text-muted-foreground ml-auto">当前:{formatStorageQuota(storageQuota)}</span>
            </div>
          </div>

          <FormField
            control={form.control}
            name="referralMaxLinks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>每用户推广链接上限</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={field.value}
                    onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 0)}
                  />
                </FormControl>
                <FormDescription>0 表示不限制;仅在该组用户创建推广链接时生效</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" form="group-form" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {isEdit ? "保存" : "创建"}
        </Button>
      </DialogFooter>
    </>
  );
}
