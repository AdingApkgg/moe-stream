"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast-with-sound";
import {
  Tag,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Video,
  Gamepad2,
  Plus,
  Merge,
  CheckSquare,
  Square,
  Calendar,
  FolderOpen,
  Palette,
  GripVertical,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TagItem {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
  createdAt: Date;
  _count: { videos: number; games: number };
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  _count: { tags: number };
}

// ==================== 分类管理面板 ====================

function CategoryManager() {
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.admin.listTagCategories.useQuery();
  const [isCreating, setIsCreating] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", color: "#6366f1", sortOrder: 0 });

  const createMutation = trpc.admin.createTagCategory.useMutation({
    onSuccess: () => {
      toast.success("分类已创建");
      utils.admin.listTagCategories.invalidate();
      utils.admin.getTagStats.invalidate();
      setIsCreating(false);
      setForm({ name: "", slug: "", color: "#6366f1", sortOrder: 0 });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.admin.updateTagCategory.useMutation({
    onSuccess: () => {
      toast.success("分类已更新");
      utils.admin.listTagCategories.invalidate();
      utils.admin.listTags.invalidate();
      setEditingCat(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.deleteTagCategory.useMutation({
    onSuccess: () => {
      toast.success("分类已删除");
      utils.admin.listTagCategories.invalidate();
      utils.admin.getTagStats.invalidate();
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("请输入分类名称");
    if (!form.slug.trim()) return toast.error("请输入 slug");
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!editingCat) return;
    updateMutation.mutate({ id: editingCat.id, ...form });
  };

  const openEdit = (cat: CategoryItem) => {
    setEditingCat(cat);
    setForm({ name: cat.name, slug: cat.slug, color: cat.color, sortOrder: cat.sortOrder });
  };

  const PRESET_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
  ];

  const formFields = (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">分类名称 *</label>
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="例如：类型" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">URL 标识 (slug) *</label>
        <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="例如：genre" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">颜色</label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((p) => ({ ...p, color: c }))}
                className={cn("w-6 h-6 rounded-full border-2 transition-transform", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Input value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="w-24 ml-2" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">排序权重</label>
        <Input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} />
        <p className="text-xs text-muted-foreground">数值越小越靠前</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          标签分类
        </h2>
        <Button size="sm" onClick={() => { setIsCreating(true); setForm({ name: "", slug: "", color: "#6366f1", sortOrder: 0 }); }}>
          <Plus className="h-4 w-4 mr-1" />
          新建分类
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : !categories?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无标签分类，点击右上角创建
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">/{cat.slug} · {cat._count.tags} 个标签</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建分类 */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建标签分类</DialogTitle>
            <DialogDescription>创建新分类以组织标签</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑分类 */}
      <Dialog open={!!editingCat} onOpenChange={() => setEditingCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
            <DialogDescription>修改分类信息</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCat(null)}>取消</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除分类 */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除分类？</AlertDialogTitle>
            <AlertDialogDescription>分类将被删除，该分类下的标签不会被删除，但会变为未分类状态。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate({ id: deletingId })}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== 标签列表 ====================

function TagManager({ page: initialPage }: { page: number }) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>("none");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<"delete" | "merge" | "category" | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [batchCategoryId, setBatchCategoryId] = useState<string>("none");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<string>("none");

  const utils = trpc.useUtils();

  const { data: categories } = trpc.admin.listTagCategories.useQuery();
  const { data: stats } = trpc.admin.getTagStats.useQuery();

  const { data, isLoading } = trpc.admin.listTags.useQuery({
    limit: 50,
    page: currentPage,
    search: search || undefined,
    categoryId: filterCategoryId !== "all" && filterCategoryId !== "uncategorized" ? filterCategoryId : undefined,
    uncategorized: filterCategoryId === "uncategorized" ? true : undefined,
  });

  const createMutation = trpc.admin.createTag.useMutation({
    onSuccess: () => {
      toast.success("标签已创建");
      utils.admin.listTags.invalidate();
      utils.admin.getTagStats.invalidate();
      setIsCreating(false);
      setNewName("");
      setNewSlug("");
      setNewCategoryId("none");
    },
    onError: (e) => toast.error(e.message || "创建失败"),
  });

  const updateMutation = trpc.admin.updateTag.useMutation({
    onSuccess: () => {
      toast.success("标签已更新");
      utils.admin.listTags.invalidate();
      setEditingTag(null);
    },
    onError: (e) => toast.error(e.message || "更新失败"),
  });

  const deleteMutation = trpc.admin.deleteTag.useMutation({
    onSuccess: () => {
      toast.success("标签已删除");
      utils.admin.listTags.invalidate();
      utils.admin.getTagStats.invalidate();
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message || "删除失败"),
  });

  const batchDeleteMutation = trpc.admin.batchDeleteTags.useMutation({
    onSuccess: (result) => {
      toast.success(`已删除 ${result.count} 个标签`);
      utils.admin.listTags.invalidate();
      utils.admin.getTagStats.invalidate();
      setSelectedIds(new Set());
      setBatchAction(null);
    },
    onError: (e) => toast.error(e.message || "批量删除失败"),
  });

  const mergeMutation = trpc.admin.mergeTags.useMutation({
    onSuccess: (result) => {
      toast.success(`已将 ${result.mergedCount} 个标签合并`);
      utils.admin.listTags.invalidate();
      utils.admin.getTagStats.invalidate();
      setSelectedIds(new Set());
      setBatchAction(null);
      setMergeTargetId("");
    },
    onError: (e) => toast.error(e.message || "合并失败"),
  });

  const batchCategoryMutation = trpc.admin.batchUpdateTagCategory.useMutation({
    onSuccess: (result) => {
      toast.success(`已修改 ${result.count} 个标签的分类`);
      utils.admin.listTags.invalidate();
      utils.admin.getTagStats.invalidate();
      setSelectedIds(new Set());
      setBatchAction(null);
      setBatchCategoryId("none");
    },
    onError: (e) => toast.error(e.message || "修改失败"),
  });

  const tags = useMemo(() => data?.tags || [], [data?.tags]) as TagItem[];

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === tags.length ? new Set() : new Set(tags.map((t) => t.id)),
    );
  }, [tags]);

  const handleEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditSlug(tag.slug);
    setEditCategoryId(tag.categoryId || "none");
  };

  const handleSave = async () => {
    if (!editingTag) return;
    setIsUpdating(true);
    try {
      await updateMutation.mutateAsync({
        tagId: editingTag.id,
        name: editName,
        slug: editSlug,
        categoryId: editCategoryId === "none" ? null : editCategoryId,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error("请输入标签名称");
    await createMutation.mutateAsync({
      name: newName.trim(),
      slug: newSlug.trim() || undefined,
      categoryId: newCategoryId === "none" ? undefined : newCategoryId,
    });
  };

  const handleMerge = () => {
    if (!mergeTargetId) return toast.error("请选择目标标签");
    const sourceIds = Array.from(selectedIds).filter((id) => id !== mergeTargetId);
    if (sourceIds.length === 0) return toast.error("请选择要合并的标签");
    mergeMutation.mutate({ sourceTagIds: sourceIds, targetTagId: mergeTargetId });
  };

  const handleBatchCategory = () => {
    batchCategoryMutation.mutate({
      tagIds: Array.from(selectedIds),
      categoryId: batchCategoryId === "none" ? null : batchCategoryId,
    });
  };

  const categorySelect = (value: string, onChange: (v: string) => void, label = "标签分类") => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="选择分类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">未分类</SelectItem>
          {categories?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 标题和统计 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          <h2 className="text-lg font-semibold">标签列表</h2>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="flex items-center gap-1.5 text-muted-foreground">总计 <Badge variant="outline">{stats.total}</Badge></span>
              <span className="flex items-center gap-1.5 text-muted-foreground">分类 <Badge variant="secondary">{stats.categoryCount}</Badge></span>
              <span className="flex items-center gap-1.5 text-muted-foreground">未分类 <Badge variant="outline">{stats.uncategorized}</Badge></span>
              <span className="flex items-center gap-1.5 text-muted-foreground">有视频 <Badge variant="secondary">{stats.withVideos}</Badge></span>
              <span className="flex items-center gap-1.5 text-muted-foreground">有游戏 <Badge variant="secondary">{stats.withGames}</Badge></span>
              <span className="flex items-center gap-1.5 text-muted-foreground">空标签 <Badge variant="outline">{stats.empty}</Badge></span>
            </div>
          )}
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />
            创建标签
          </Button>
        </div>
      </div>

      {/* 搜索 + 分类筛选 */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索标签名称或 slug..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-10" />
        </div>
        <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="筛选分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            <SelectItem value="uncategorized">未分类</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name} ({c._count.tags})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 批量操作栏 */}
      {tags.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="gap-1">
            {selectedIds.size === tags.length && tags.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {selectedIds.size === tags.length && tags.length > 0 ? "取消全选" : "全选"}
          </Button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 个</span>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setBatchAction("category")}>
                  <Palette className="h-4 w-4 mr-1" />
                  修改分类
                </Button>
                {selectedIds.size >= 2 && (
                  <Button variant="outline" size="sm" onClick={() => setBatchAction("merge")}>
                    <Merge className="h-4 w-4 mr-1" />
                    合并标签
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => setBatchAction("delete")}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  批量删除
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 标签列表 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">没有找到标签</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tags.map((tag) => {
              const isSelected = selectedIds.has(tag.id);
              return (
                <Card key={tag.id} className={cn("transition-colors hover:bg-muted/50", isSelected && "ring-2 ring-primary")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(tag.id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/video/tag/${tag.slug}`} className="font-medium hover:underline block truncate">{tag.name}</Link>
                            <div className="text-sm text-muted-foreground mt-0.5">/{tag.slug}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link href={`/video/tag/${tag.slug}`} target="_blank" title="视频"><Video className="h-3 w-3" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link href={`/game/tag/${tag.slug}`} target="_blank" title="游戏"><Gamepad2 className="h-3 w-3" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(tag)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(tag.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                          {tag.category ? (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.category.color }} />
                              {tag.category.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 opacity-50">未分类</Badge>
                          )}
                          <span className="flex items-center gap-1"><Video className="h-3 w-3" />{tag._count.videos}</span>
                          <span className="flex items-center gap-1"><Gamepad2 className="h-3 w-3" />{tag._count.games}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(tag.createdAt).toLocaleDateString("zh-CN")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination currentPage={currentPage} totalPages={data?.totalPages ?? 1} basePath="/dashboard/tags" onPageChange={setCurrentPage} className="mt-6" />
        </>
      )}

      {/* 创建标签 */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建标签</DialogTitle>
            <DialogDescription>创建新的内容标签</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">标签名称 *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：动画" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL 标识 (slug)</label>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="留空自动生成" />
            </div>
            {categorySelect(newCategoryId, setNewCategoryId)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑标签 */}
      <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
            <DialogDescription>修改标签信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">标签名称</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL 标识 (slug)</label>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
            </div>
            {categorySelect(editCategoryId, setEditCategoryId)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)}>取消</Button>
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除？</AlertDialogTitle>
            <AlertDialogDescription>标签将被永久删除，已关联的视频和游戏不会被删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletingId && deleteMutation.mutate({ tagId: deletingId })}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除 */}
      <AlertDialog open={batchAction === "delete"} onOpenChange={() => setBatchAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除 {selectedIds.size} 个标签？</AlertDialogTitle>
            <AlertDialogDescription>已关联的视频和游戏不会被删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => batchDeleteMutation.mutate({ tagIds: Array.from(selectedIds) })}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量修改分类 */}
      <Dialog open={batchAction === "category"} onOpenChange={() => setBatchAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量修改分类</DialogTitle>
            <DialogDescription>将 {selectedIds.size} 个标签移动到指定分类</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {categorySelect(batchCategoryId, setBatchCategoryId, "目标分类")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAction(null)}>取消</Button>
            <Button onClick={handleBatchCategory} disabled={batchCategoryMutation.isPending}>
              {batchCategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合并标签 */}
      <Dialog open={batchAction === "merge"} onOpenChange={() => setBatchAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>合并标签</DialogTitle>
            <DialogDescription>将所选标签合并到目标标签，原标签将被删除。</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">目标标签</label>
            <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="选择保留的目标标签" />
              </SelectTrigger>
              <SelectContent>
                {tags.filter((t) => selectedIds.has(t.id)).map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name} ({tag._count.videos} 视频, {tag._count.games} 游戏)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAction(null)}>取消</Button>
            <Button onClick={handleMerge} disabled={mergeMutation.isPending || !mergeTargetId}>
              {mergeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认合并
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== 主组件 ====================

export default function AdminTagsClient({ page: initialPage }: { page: number }) {
  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();

  if (!permissions?.scopes.includes("tag:manage")) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        您没有标签管理权限
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tags className="h-5 w-5" />
        <h1 className="text-xl font-semibold">标签管理</h1>
      </div>

      <Tabs defaultValue="tags" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tags" className="gap-1.5">
            <Tag className="h-4 w-4" />
            标签列表
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            分类管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tags">
          <TagManager page={initialPage} />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
