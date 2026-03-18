"use client";

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import type { Ad, AdPosition } from "@/lib/ads";
import { AD_POSITIONS, isAdInSchedule } from "@/lib/ads";
import { AdCard } from "@/components/ads/ad-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/lib/toast-with-sound";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  MoreHorizontal,
  Eye,
  EyeOff,
  Copy,
  Calendar,
  BarChart3,
  ExternalLink,
  ArrowUpDown,
  Search,
  ImageIcon,
  ShieldAlert,
  CheckCircle2,
  Clock,
  XCircle,
  MonitorPlay,
  X,
  ChevronsUpDown,
  Power,
  PowerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortField = "title" | "weight" | "createdAt" | "status" | "platform";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "title", label: "标题" },
  { value: "platform", label: "平台" },
  { value: "weight", label: "权重" },
  { value: "createdAt", label: "创建时间" },
  { value: "status", label: "状态" },
];

function getAdStatusOrder(ad: Ad): number {
  if (!ad.enabled) return 3;
  if (!isAdInSchedule(ad)) {
    const now = new Date();
    if (ad.startDate && new Date(ad.startDate) > now) return 1;
    return 4;
  }
  return 0;
}

function genId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type AdFormData = Omit<Ad, "id" | "createdAt"> & { id?: string; createdAt?: string };

const emptyForm: AdFormData = {
  title: "",
  platform: "",
  url: "",
  description: "",
  imageUrl: "",
  weight: 1,
  enabled: true,
  position: "all",
  startDate: null,
  endDate: null,
};

function parseAds(raw: unknown): Ad[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => ({
    id: item.id ?? `legacy-${idx}`,
    title: item.title ?? "",
    platform: item.platform ?? "",
    url: item.url ?? "",
    description: item.description ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
    weight: typeof item.weight === "number" ? item.weight : 1,
    enabled: item.enabled !== false,
    position: item.position ?? "all",
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    createdAt: item.createdAt ?? undefined,
  }));
}

function getAdStatus(ad: Ad): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 } {
  if (!ad.enabled) return { label: "已禁用", variant: "secondary", icon: EyeOff };
  if (!isAdInSchedule(ad)) {
    const now = new Date();
    if (ad.startDate && new Date(ad.startDate) > now) return { label: "待投放", variant: "outline", icon: Clock };
    return { label: "已过期", variant: "destructive", icon: XCircle };
  }
  return { label: "投放中", variant: "default", icon: CheckCircle2 };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return "—"; }
}

export default function AdsManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<AdFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPosition, setFilterPosition] = useState<string>("all-filter");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewAd, setPreviewAd] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const { data: config, isLoading } = trpc.admin.getSiteConfig.useQuery(undefined, {
    enabled: permissions?.scopes.includes("settings:manage"),
  });
  const utils = trpc.useUtils();
  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: () => {
      utils.admin.getSiteConfig.invalidate();
      utils.site.getConfig.invalidate();
    },
  });

  const allAds = useMemo(() => parseAds(config?.sponsorAds), [config?.sponsorAds]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    allAds.forEach((a) => { if (a.platform) set.add(a.platform); });
    return Array.from(set).sort();
  }, [allAds]);

  const filteredAds = useMemo(() => {
    let result = allAds;
    if (filterPosition !== "all-filter") {
      result = result.filter((ad) => ad.position === filterPosition);
    }
    if (filterPlatform !== "all") {
      result = result.filter((ad) => ad.platform === filterPlatform);
    }
    if (filterStatus === "active") {
      result = result.filter((ad) => ad.enabled && isAdInSchedule(ad));
    } else if (filterStatus === "disabled") {
      result = result.filter((ad) => !ad.enabled);
    } else if (filterStatus === "scheduled") {
      result = result.filter((ad) => ad.enabled && ad.startDate && new Date(ad.startDate) > new Date());
    } else if (filterStatus === "expired") {
      result = result.filter((ad) => ad.endDate && new Date(ad.endDate) < new Date());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((ad) =>
        ad.title.toLowerCase().includes(q) ||
        ad.platform.toLowerCase().includes(q) ||
        ad.url.toLowerCase().includes(q) ||
        (ad.description || "").toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title": cmp = a.title.localeCompare(b.title, "zh-CN"); break;
        case "platform": cmp = (a.platform || "").localeCompare(b.platform || "", "zh-CN"); break;
        case "weight": cmp = a.weight - b.weight; break;
        case "createdAt": cmp = (a.createdAt || "").localeCompare(b.createdAt || ""); break;
        case "status": cmp = getAdStatusOrder(a) - getAdStatusOrder(b); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allAds, filterPosition, filterPlatform, filterStatus, searchQuery, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = allAds.length;
    const active = allAds.filter((a) => a.enabled && isAdInSchedule(a)).length;
    const disabled = allAds.filter((a) => !a.enabled).length;
    const scheduled = allAds.filter((a) => a.enabled && a.startDate && new Date(a.startDate) > new Date()).length;
    return { total, active, disabled, scheduled };
  }, [allAds]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterPosition !== "all-filter") c++;
    if (filterStatus !== "all") c++;
    if (filterPlatform !== "all") c++;
    if (searchQuery.trim()) c++;
    return c;
  }, [filterPosition, filterStatus, filterPlatform, searchQuery]);

  const clearAllFilters = useCallback(() => {
    setFilterPosition("all-filter");
    setFilterStatus("all");
    setFilterPlatform("all");
    setSearchQuery("");
  }, []);

  const handleStatCardClick = useCallback((status: string) => {
    setFilterStatus((prev) => prev === status ? "all" : status);
  }, []);

  const toggleSelectAd = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredAds.length && filteredAds.every((a) => prev.has(a.id))) {
        return new Set();
      }
      return new Set(filteredAds.map((a) => a.id));
    });
  }, [filteredAds]);

  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const saveAds = useCallback(async (newAds: Ad[]) => {
    setSaving(true);
    try {
      await updateConfig.mutateAsync({
        sponsorAds: newAds.map((a) => ({
          id: a.id,
          title: a.title,
          platform: a.platform || "",
          url: a.url,
          description: a.description || "",
          imageUrl: a.imageUrl || "",
          weight: a.weight,
          enabled: a.enabled,
          position: a.position || "all",
          startDate: a.startDate || null,
          endDate: a.endDate || null,
          createdAt: a.createdAt,
        })),
      });
    } finally {
      setSaving(false);
    }
  }, [updateConfig]);

  const handleBatchToggle = useCallback(async (enabled: boolean) => {
    if (selectedIds.size === 0) return;
    const newAds = allAds.map((ad) =>
      selectedIds.has(ad.id) ? { ...ad, enabled } : ad
    );
    await saveAds(newAds);
    setSelectedIds(new Set());
    toast.success(`已批量${enabled ? "启用" : "禁用"} ${selectedIds.size} 个广告`);
  }, [selectedIds, allAds, saveAds]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const newAds = allAds.filter((ad) => !selectedIds.has(ad.id));
    await saveAds(newAds);
    const count = selectedIds.size;
    setSelectedIds(new Set());
    toast.success(`已删除 ${count} 个广告`);
  }, [selectedIds, allAds, saveAds]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (ad: Ad) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      platform: ad.platform,
      url: ad.url,
      description: ad.description || "",
      imageUrl: ad.imageUrl || "",
      weight: ad.weight,
      enabled: ad.enabled,
      position: ad.position,
      startDate: ad.startDate || null,
      endDate: ad.endDate || null,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("请填写广告标题和跳转链接");
      return;
    }
    try {
      new URL(form.url);
    } catch {
      toast.error("请输入有效的跳转链接");
      return;
    }

    const isEdit = !!editingId;
    let newAds: Ad[];
    if (isEdit) {
      newAds = allAds.map((ad) =>
        ad.id === editingId
          ? { ...ad, ...form, id: editingId }
          : ad
      );
    } else {
      const newAd: Ad = {
        ...form,
        id: genId(),
        createdAt: new Date().toISOString(),
      };
      newAds = [...allAds, newAd];
    }
    try {
      await saveAds(newAds);
      toast.success(isEdit ? "广告已更新" : "广告已创建");
      setDialogOpen(false);
    } catch {
      toast.error("保存失败，请重试");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const newAds = allAds.filter((ad) => ad.id !== deleteId);
    await saveAds(newAds);
    setDeleteId(null);
    toast.success("广告已删除");
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    const newAds = allAds.map((ad) =>
      ad.id === id ? { ...ad, enabled } : ad
    );
    await saveAds(newAds);
    toast.success(enabled ? "广告已启用" : "广告已禁用");
  };

  const handleDuplicate = async (ad: Ad) => {
    const newAd: Ad = {
      ...ad,
      id: genId(),
      title: `${ad.title} (副本)`,
      enabled: false,
      createdAt: new Date().toISOString(),
    };
    await saveAds([...allAds, newAd]);
    toast.success("广告已复制");
  };

  const handleToggleGlobalAds = async (enabled: boolean) => {
    await updateConfig.mutateAsync({ adsEnabled: enabled });
    toast.success(enabled ? "全站广告已开启" : "全站广告已关闭");
  };

  const handleToggleAdGate = async (enabled: boolean) => {
    await updateConfig.mutateAsync({ adGateEnabled: enabled });
    toast.success(enabled ? "广告门已启用" : "广告门已禁用");
  };

  const handleUpdateAdGate = async (field: "adGateViewsRequired" | "adGateHours", value: number) => {
    await updateConfig.mutateAsync({ [field]: value });
    toast.success("广告门配置已更新");
  };

  const livePreviewAd: Ad = useMemo(() => ({
    id: "preview",
    title: form.title || "广告标题预览",
    platform: form.platform || "",
    url: form.url || "#",
    description: form.description || undefined,
    imageUrl: form.imageUrl || undefined,
    weight: form.weight,
    enabled: true,
    position: form.position,
  }), [form]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            广告管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">管理全站广告投放，配置广告位和投放时间</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="text-sm text-muted-foreground">全站广告</span>
            <Switch
              checked={config?.adsEnabled ?? false}
              onCheckedChange={handleToggleGlobalAds}
              disabled={updateConfig.isPending}
            />
          </div>
          <Button onClick={handleOpenCreate} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            新建广告
          </Button>
        </div>
      </div>

      {/* 统计卡片 —— 可点击快速筛选 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", filterStatus === "all" && activeFilterCount === 0 && "ring-2 ring-primary/30")}
          onClick={() => { clearAllFilters(); }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">广告总数</p>
                <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", filterStatus === "active" && "ring-2 ring-green-500/40")}
          onClick={() => handleStatCardClick("active")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">投放中</p>
                <p className="text-2xl font-bold tabular-nums text-green-600">{stats.active}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", filterStatus === "disabled" && "ring-2 ring-muted-foreground/30")}
          onClick={() => handleStatCardClick("disabled")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">已禁用</p>
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">{stats.disabled}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all hover:shadow-md", filterStatus === "scheduled" && "ring-2 ring-blue-500/40")}
          onClick={() => handleStatCardClick("scheduled")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">待投放</p>
                <p className="text-2xl font-bold tabular-nums text-blue-600">{stats.scheduled}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            广告列表
          </TabsTrigger>
          <TabsTrigger value="gate" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            广告门
          </TabsTrigger>
        </TabsList>

        {/* 广告列表 */}
        <TabsContent value="list" className="space-y-4">
          {/* 过滤栏 */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索广告标题、平台、链接、描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="广告位" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-filter">全部广告位</SelectItem>
                  {AD_POSITIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">投放中</SelectItem>
                  <SelectItem value="disabled">已禁用</SelectItem>
                  <SelectItem value="scheduled">待投放</SelectItem>
                  <SelectItem value="expired">已过期</SelectItem>
                </SelectContent>
              </Select>
              {platforms.length > 0 && (
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部平台</SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">排序方式</div>
                  {SORT_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => {
                        if (sortField === opt.value) {
                          setSortDir((d) => d === "asc" ? "desc" : "asc");
                        } else {
                          setSortField(opt.value);
                          setSortDir("asc");
                        }
                      }}
                      className="justify-between"
                    >
                      {opt.label}
                      {sortField === opt.value && (
                        <span className="text-xs text-muted-foreground">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 筛选状态栏：计数 + 活跃筛选标签 + 清除 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {filteredAds.length === allAds.length
                    ? `共 ${allAds.length} 个广告`
                    : `${filteredAds.length} / ${allAds.length} 个广告`}
                </span>
                {activeFilterCount > 0 && (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    {searchQuery.trim() && (
                      <Badge variant="secondary" className="gap-1 text-[11px] cursor-pointer" onClick={() => setSearchQuery("")}>
                        搜索: {searchQuery.length > 8 ? searchQuery.slice(0, 8) + "…" : searchQuery}
                        <X className="h-3 w-3" />
                      </Badge>
                    )}
                    {filterStatus !== "all" && (
                      <Badge variant="secondary" className="gap-1 text-[11px] cursor-pointer" onClick={() => setFilterStatus("all")}>
                        {filterStatus === "active" ? "投放中" : filterStatus === "disabled" ? "已禁用" : filterStatus === "scheduled" ? "待投放" : "已过期"}
                        <X className="h-3 w-3" />
                      </Badge>
                    )}
                    {filterPosition !== "all-filter" && (
                      <Badge variant="secondary" className="gap-1 text-[11px] cursor-pointer" onClick={() => setFilterPosition("all-filter")}>
                        {AD_POSITIONS.find((p) => p.value === filterPosition)?.label}
                        <X className="h-3 w-3" />
                      </Badge>
                    )}
                    {filterPlatform !== "all" && (
                      <Badge variant="secondary" className="gap-1 text-[11px] cursor-pointer" onClick={() => setFilterPlatform("all")}>
                        {filterPlatform}
                        <X className="h-3 w-3" />
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearAllFilters}>
                      清除全部
                    </Button>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground hidden sm:block">
                按{SORT_OPTIONS.find((o) => o.value === sortField)?.label} {sortDir === "asc" ? "升序" : "降序"}
              </div>
            </div>

            {/* 批量操作工具栏 */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 animate-in slide-in-from-top-2">
                <span className="text-sm font-medium">
                  已选择 {selectedIds.size} 项
                </span>
                <div className="h-4 w-px bg-border" />
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1" onClick={() => handleBatchToggle(true)} disabled={saving}>
                        <Power className="h-3.5 w-3.5" />
                        启用
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>批量启用所选广告</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1" onClick={() => handleBatchToggle(false)} disabled={saving}>
                        <PowerOff className="h-3.5 w-3.5" />
                        禁用
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>批量禁用所选广告</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-destructive hover:text-destructive" onClick={() => setBatchDeleteOpen(true)} disabled={saving}>
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>批量删除所选广告</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                    取消选择
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 广告列表 */}
          {filteredAds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Megaphone className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  {allAds.length === 0 ? "还没有广告" : "没有匹配的广告"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {allAds.length === 0
                    ? "点击「新建广告」开始创建第一个广告"
                    : "尝试调整过滤条件，或"}
                </p>
                {allAds.length === 0 ? (
                  <Button onClick={handleOpenCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    新建广告
                  </Button>
                ) : activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={clearAllFilters}>
                    <X className="h-4 w-4 mr-2" />
                    清除所有筛选
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* 全选行 */}
              {filteredAds.length > 1 && (
                <div className="flex items-center gap-3 px-4 py-1">
                  <Checkbox
                    checked={filteredAds.length > 0 && filteredAds.every((a) => selectedIds.has(a.id))}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">全选当前页</span>
                </div>
              )}
              {filteredAds.map((ad) => {
                const status = getAdStatus(ad);
                const StatusIcon = status.icon;
                const posLabel = AD_POSITIONS.find((p) => p.value === ad.position)?.label ?? "全部位置";
                const isSelected = selectedIds.has(ad.id);
                return (
                  <Card key={ad.id} className={cn("transition-all", !ad.enabled && "opacity-60", isSelected && "ring-2 ring-primary/30 bg-primary/[0.02]")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center pt-0.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectAd(ad.id)}
                          />
                        </div>

                        {/* 图片缩略图 */}
                        <div className="hidden sm:flex shrink-0 w-24 h-16 rounded-md overflow-hidden bg-muted items-center justify-center">
                          {ad.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* 主体信息 */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{ad.title}</span>
                            <Badge variant={status.variant} className="gap-1 text-[11px]">
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                            {ad.platform && (
                              <Badge
                                variant="outline"
                                className="text-[11px] cursor-pointer hover:bg-accent"
                                onClick={() => setFilterPlatform(filterPlatform === ad.platform ? "all" : ad.platform)}
                              >
                                {ad.platform}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              {ad.url}
                            </span>
                            <span className="flex items-center gap-1">
                              <MonitorPlay className="h-3 w-3" />
                              {posLabel}
                            </span>
                            <span className="flex items-center gap-1">
                              <ArrowUpDown className="h-3 w-3" />
                              权重 {ad.weight}
                            </span>
                            {(ad.startDate || ad.endDate) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(ad.startDate)} ~ {formatDate(ad.endDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 操作 */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={ad.enabled}
                            onCheckedChange={(v) => handleToggleEnabled(ad.id, v)}
                            disabled={saving}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(ad)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPreviewAd(ad)}>
                                <Eye className="h-4 w-4 mr-2" />
                                预览
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(ad)}>
                                <Copy className="h-4 w-4 mr-2" />
                                复制
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteId(ad.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 广告门 */}
        <TabsContent value="gate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5" />
                广告门配置
              </CardTitle>
              <CardDescription>
                启用后，用户访问站点时需先点击广告链接并返回本页，满足指定次数后在设定时间内不再显示广告门。
                广告门使用广告列表中广告位为「全部位置」或「仅广告门」的广告。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">启用广告门</p>
                  <p className="text-xs text-muted-foreground">开启后，未达成次数时访问站点会先看到广告页</p>
                </div>
                <Switch
                  checked={config?.adGateEnabled ?? false}
                  onCheckedChange={handleToggleAdGate}
                  disabled={updateConfig.isPending}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">需观看/点击次数</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={config?.adGateViewsRequired ?? 3}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1 && v <= 20) handleUpdateAdGate("adGateViewsRequired", v);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">用户需点击并返回的次数</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">免广告时长（小时）</label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={config?.adGateHours ?? 12}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 1 && v <= 168) handleUpdateAdGate("adGateHours", v);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">达成后多少小时内不再显示广告门</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑广告" : "新建广告"}</DialogTitle>
            <DialogDescription>
              {editingId ? "修改广告信息，保存后立即生效" : "创建新的广告，填写基本信息并配置投放规则"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 表单区 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  广告标题 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="例如：XXX 推广"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">广告平台</label>
                  <Input
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                    placeholder="例如：Google"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">权重 (1-100)</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.weight}
                    onChange={(e) => setForm((f) => ({ ...f, weight: parseInt(e.target.value, 10) || 1 }))}
                  />
                  <p className="text-[11px] text-muted-foreground">数值越大展示概率越高</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  跳转链接 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">图片链接</label>
                <Input
                  value={form.imageUrl || ""}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://...图片URL"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Input
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="简短广告描述"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">广告位</label>
                <Select
                  value={form.position}
                  onValueChange={(v) => setForm((f) => ({ ...f, position: v as AdPosition }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  选择「全部位置」将在所有广告位展示，选择特定位置则仅在对应位置展示
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">开始日期</label>
                  <Input
                    type="date"
                    value={form.startDate ? form.startDate.slice(0, 10) : ""}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : null }))}
                  />
                  <p className="text-[11px] text-muted-foreground">留空表示立即投放</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">结束日期</label>
                  <Input
                    type="date"
                    value={form.endDate ? form.endDate.slice(0, 10) : ""}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null }))}
                  />
                  <p className="text-[11px] text-muted-foreground">留空表示长期有效</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">立即启用</span>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                />
              </div>
            </div>

            {/* 预览区 */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">实时预览</p>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">卡片样式（信息流中）</p>
                  <div className="max-w-[280px]">
                    <AdCard ad={livePreviewAd} />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">紧凑样式（侧栏中）</p>
                  <div className="max-w-[220px]">
                    <AdCard ad={livePreviewAd} compact />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "保存修改" : "创建广告"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览对话框 */}
      <Dialog open={!!previewAd} onOpenChange={() => setPreviewAd(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>广告预览</DialogTitle>
            <DialogDescription>预览广告在不同位置的展示效果</DialogDescription>
          </DialogHeader>
          {previewAd && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">卡片样式</p>
                <AdCard ad={previewAd} />
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">紧凑样式</p>
                <AdCard ad={previewAd} compact />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除广告？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，广告将从所有广告位中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认 */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除 {selectedIds.size} 个广告？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，所选广告将全部从所有广告位中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { handleBatchDelete(); setBatchDeleteOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除 {selectedIds.size} 个广告
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
