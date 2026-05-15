"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import type { Ad, AdPosition } from "@/lib/ads";
import { parseSponsorAds, isAdInSchedule } from "@/lib/ads";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toast-with-sound";
import { BarChart3, Download, Megaphone, Plus, ShieldAlert, Upload, X } from "lucide-react";
import { StatsCards } from "./_components/stats-cards";
import { AdFilters } from "./_components/ad-filters";
import { AdBatchToolbar } from "./_components/ad-batch-toolbar";
import { AdListItem } from "./_components/ad-list-item";
import { AdFormDialog } from "./_components/ad-form-dialog";
import { AdPreviewDialog } from "./_components/ad-preview-dialog";
import { AdGateSettings } from "./_components/ad-gate-settings";
import { AdsInsights } from "./_components/ads-insights";
import { emptyForm, type AdFormData, type SortField, type SortDir } from "./_components/types";
import { genId, getAdStatusOrder } from "./_components/utils";

export default function AdsManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<AdFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPosition, setFilterPosition] = useState<string>("all-filter");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewAd, setPreviewAd] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const canManage = permissions?.scopes.includes("settings:manage") ?? false;
  const { data: config, isLoading } = trpc.admin.getSiteConfig.useQuery(undefined, {
    enabled: canManage,
  });
  const { data: metricsData } = trpc.admin.ads.getAllMetrics.useQuery(
    { days: 30 },
    { enabled: canManage, staleTime: 60 * 1000 },
  );
  const utils = trpc.useUtils();
  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: () => {
      utils.admin.getSiteConfig.invalidate();
      utils.site.getConfig.invalidate();
    },
  });

  const allAds = useMemo(() => parseSponsorAds(config?.sponsorAds), [config?.sponsorAds]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    allAds.forEach((a) => {
      if (a.platform) set.add(a.platform);
    });
    return Array.from(set).sort();
  }, [allAds]);

  const knownCategories = useMemo(() => {
    const set = new Set<string>();
    allAds.forEach((a) => {
      a.targeting?.categories?.forEach((c) => set.add(c));
    });
    return Array.from(set).sort();
  }, [allAds]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<Ad[] | null>(null);

  const filteredAds = useMemo(() => {
    let result = allAds;
    if (filterPosition !== "all-filter") {
      result = result.filter(
        (ad) => ad.positions.includes("all") || ad.positions.includes(filterPosition as AdPosition),
      );
    }
    if (filterPlatform !== "all") {
      result = result.filter((ad) => ad.platform === filterPlatform);
    }
    if (filterKind !== "all") {
      result = result.filter((ad) => (ad.kind ?? "image") === filterKind);
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
      result = result.filter(
        (ad) =>
          ad.title.toLowerCase().includes(q) ||
          ad.platform.toLowerCase().includes(q) ||
          ad.url.toLowerCase().includes(q) ||
          (ad.description || "").toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title, "zh-CN");
          break;
        case "platform":
          cmp = (a.platform || "").localeCompare(b.platform || "", "zh-CN");
          break;
        case "weight":
          cmp = a.weight - b.weight;
          break;
        case "createdAt":
          cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
          break;
        case "status":
          cmp = getAdStatusOrder(a) - getAdStatusOrder(b);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allAds, filterPosition, filterPlatform, filterKind, filterStatus, searchQuery, sortField, sortDir]);

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
    if (filterKind !== "all") c++;
    if (searchQuery.trim()) c++;
    return c;
  }, [filterPosition, filterStatus, filterPlatform, filterKind, searchQuery]);

  const clearAllFilters = useCallback(() => {
    setFilterPosition("all-filter");
    setFilterStatus("all");
    setFilterPlatform("all");
    setFilterKind("all");
    setSearchQuery("");
  }, []);

  const handleStatCardClick = useCallback((status: string) => {
    setFilterStatus((prev) => (prev === status ? "all" : status));
  }, []);

  const toggleSelectAd = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  const saveAds = useCallback(
    async (newAds: Ad[]) => {
      setSaving(true);
      try {
        await updateConfig.mutateAsync({
          sponsorAds: newAds.map((a) => {
            const targeting = a.targeting
              ? {
                  ...(a.targeting.devices && a.targeting.devices.length > 0 && { devices: a.targeting.devices }),
                  ...(a.targeting.loginStates &&
                    a.targeting.loginStates.length > 0 && { loginStates: a.targeting.loginStates }),
                  ...(a.targeting.categories &&
                    a.targeting.categories.length > 0 && { categories: a.targeting.categories }),
                  ...(a.targeting.locales && a.targeting.locales.length > 0 && { locales: a.targeting.locales }),
                }
              : undefined;
            const schedule = a.schedule
              ? {
                  ...(a.schedule.daysOfWeek &&
                    a.schedule.daysOfWeek.length > 0 && { daysOfWeek: a.schedule.daysOfWeek }),
                  ...(a.schedule.hourRanges &&
                    a.schedule.hourRanges.length > 0 && { hourRanges: a.schedule.hourRanges }),
                }
              : undefined;
            const caps = a.caps
              ? {
                  ...(a.caps.dailyImpressions != null && { dailyImpressions: a.caps.dailyImpressions }),
                  ...(a.caps.dailyClicks != null && { dailyClicks: a.caps.dailyClicks }),
                  ...(a.caps.totalImpressions != null && { totalImpressions: a.caps.totalImpressions }),
                  ...(a.caps.totalClicks != null && { totalClicks: a.caps.totalClicks }),
                }
              : undefined;
            return {
              id: a.id,
              title: a.title,
              platform: a.platform || "",
              url: a.url || "",
              description: a.description || "",
              imageUrl: a.imageUrl || "",
              images:
                a.images && Object.values(a.images).some((v) => v)
                  ? {
                      banner: a.images.banner || "",
                      card: a.images.card || "",
                      sidebar: a.images.sidebar || "",
                    }
                  : null,
              weight: a.weight,
              enabled: a.enabled,
              positions: a.positions.length > 0 ? a.positions : ["all"],
              startDate: a.startDate || null,
              endDate: a.endDate || null,
              createdAt: a.createdAt,
              kind: a.kind ?? "image",
              html: a.html || null,
              notes: a.notes || null,
              targeting: targeting && Object.keys(targeting).length > 0 ? targeting : null,
              schedule: schedule && Object.keys(schedule).length > 0 ? schedule : null,
              caps: caps && Object.keys(caps).length > 0 ? caps : null,
            };
          }),
        });
      } finally {
        setSaving(false);
      }
    },
    [updateConfig],
  );

  const handleExport = useCallback(() => {
    const payload = {
      _format: "moestream-ads",
      _version: 1,
      _exportedAt: new Date().toISOString(),
      ads: allAds,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ads-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${allAds.length} 条广告`);
  }, [allAds]);

  const handlePickImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilePicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const rawAds = Array.isArray(json) ? json : Array.isArray(json?.ads) ? json.ads : null;
      if (!rawAds) {
        toast.error("文件格式不正确：需要数组或 { ads: [...] }");
        return;
      }
      const parsed = parseSponsorAds(rawAds);
      if (parsed.length === 0) {
        toast.error("导入文件中没有有效的广告数据");
        return;
      }
      setPendingImport(parsed);
      setImportDialogOpen(true);
    } catch {
      toast.error("无法解析 JSON 文件");
    }
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport) return;
    const importedWithIds = pendingImport.map((a) => ({
      ...a,
      id: a.id && !a.id.startsWith("legacy-") ? a.id : genId(),
      createdAt: a.createdAt || new Date().toISOString(),
    }));
    const merged =
      importMode === "replace"
        ? importedWithIds
        : [...allAds, ...importedWithIds.filter((imp) => !allAds.some((a) => a.id === imp.id))];
    try {
      await saveAds(merged);
      toast.success(
        importMode === "replace"
          ? `已替换为 ${importedWithIds.length} 条广告`
          : `已合并导入 ${importedWithIds.length} 条广告`,
      );
      setImportDialogOpen(false);
      setPendingImport(null);
    } catch {
      toast.error("导入失败，请重试");
    }
  }, [pendingImport, importMode, allAds, saveAds]);

  const handleBatchToggle = useCallback(
    async (enabled: boolean) => {
      if (selectedIds.size === 0) return;
      const newAds = allAds.map((ad) => (selectedIds.has(ad.id) ? { ...ad, enabled } : ad));
      await saveAds(newAds);
      const count = selectedIds.size;
      setSelectedIds(new Set());
      toast.success(`已批量${enabled ? "启用" : "禁用"} ${count} 个广告`);
    },
    [selectedIds, allAds, saveAds],
  );

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
      images: {
        banner: ad.images?.banner || "",
        card: ad.images?.card || "",
        sidebar: ad.images?.sidebar || "",
      },
      weight: ad.weight,
      enabled: ad.enabled,
      positions: ad.positions,
      startDate: ad.startDate || null,
      endDate: ad.endDate || null,
      kind: ad.kind ?? "image",
      html: ad.html || "",
      notes: ad.notes || "",
      targeting: {
        devices: ad.targeting?.devices ?? [],
        loginStates: ad.targeting?.loginStates ?? [],
        categories: ad.targeting?.categories ?? [],
        locales: ad.targeting?.locales ?? [],
      },
      schedule: {
        daysOfWeek: ad.schedule?.daysOfWeek ?? [],
        hourRanges: ad.schedule?.hourRanges ?? [],
      },
      caps: {
        dailyImpressions: ad.caps?.dailyImpressions ?? null,
        dailyClicks: ad.caps?.dailyClicks ?? null,
        totalImpressions: ad.caps?.totalImpressions ?? null,
        totalClicks: ad.caps?.totalClicks ?? null,
      },
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
      newAds = allAds.map((ad) => (ad.id === editingId ? { ...ad, ...form, id: editingId } : ad));
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
    const newAds = allAds.map((ad) => (ad.id === id ? { ...ad, enabled } : ad));
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

  const handlePlatformClick = useCallback(
    (platform: string) => setFilterPlatform((prev) => (prev === platform ? "all" : platform)),
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="text-sm text-muted-foreground">全站广告</span>
            <Switch
              checked={config?.adsEnabled ?? false}
              onCheckedChange={handleToggleGlobalAds}
              disabled={updateConfig.isPending}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={saving || allAds.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            导出
          </Button>
          <Button variant="outline" size="sm" onClick={handlePickImport} disabled={saving}>
            <Upload className="h-4 w-4 mr-1.5" />
            导入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFilePicked}
          />
          <Button onClick={handleOpenCreate} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            新建广告
          </Button>
        </div>
      </div>

      <StatsCards
        stats={stats}
        filterStatus={filterStatus}
        hasOtherFilters={activeFilterCount > 0}
        onClear={clearAllFilters}
        onFilter={handleStatCardClick}
      />

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            广告列表
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            数据洞察
          </TabsTrigger>
          <TabsTrigger value="gate" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            广告门
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <AdsInsights ads={allAds} />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <AdFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterPosition={filterPosition}
            onPositionChange={setFilterPosition}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
            filterPlatform={filterPlatform}
            onPlatformChange={setFilterPlatform}
            filterKind={filterKind}
            onKindChange={setFilterKind}
            platforms={platforms}
            sortField={sortField}
            sortDir={sortDir}
            onSortChange={handleSortChange}
            activeFilterCount={activeFilterCount}
            onClearAll={clearAllFilters}
            filteredCount={filteredAds.length}
            totalCount={allAds.length}
          />

          <AdBatchToolbar
            selectedCount={selectedIds.size}
            saving={saving}
            onBatchToggle={handleBatchToggle}
            onBatchDelete={() => setBatchDeleteOpen(true)}
            onClearSelection={() => setSelectedIds(new Set())}
          />

          {filteredAds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Megaphone className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">{allAds.length === 0 ? "还没有广告" : "没有匹配的广告"}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {allAds.length === 0 ? "点击「新建广告」开始创建第一个广告" : "尝试调整过滤条件，或"}
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
              {filteredAds.length > 1 && (
                <div className="flex items-center gap-3 px-4 py-1">
                  <Checkbox
                    checked={filteredAds.length > 0 && filteredAds.every((a) => selectedIds.has(a.id))}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">全选当前页</span>
                </div>
              )}
              {filteredAds.map((ad) => (
                <AdListItem
                  key={ad.id}
                  ad={ad}
                  selected={selectedIds.has(ad.id)}
                  saving={saving}
                  onToggleSelect={toggleSelectAd}
                  onToggleEnabled={handleToggleEnabled}
                  onEdit={handleOpenEdit}
                  onPreview={setPreviewAd}
                  onDuplicate={handleDuplicate}
                  onDelete={setDeleteId}
                  onPlatformClick={handlePlatformClick}
                  metric={metricsData?.metrics[ad.id]}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gate" className="space-y-4">
          <AdGateSettings
            enabled={config?.adGateEnabled ?? false}
            viewsRequired={config?.adGateViewsRequired ?? 3}
            hours={config?.adGateHours ?? 12}
            disabled={updateConfig.isPending}
            onToggle={handleToggleAdGate}
            onUpdate={handleUpdateAdGate}
          />
        </TabsContent>
      </Tabs>

      <AdFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        editingId={editingId}
        saving={saving}
        onSave={handleSave}
        platforms={platforms}
        knownCategories={knownCategories}
      />

      <AdPreviewDialog ad={previewAd} onClose={() => setPreviewAd(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除广告？</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，广告将从所有广告位中移除。</AlertDialogDescription>
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

      <AlertDialog
        open={importDialogOpen}
        onOpenChange={(o) => {
          setImportDialogOpen(o);
          if (!o) setPendingImport(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导入 {pendingImport?.length ?? 0} 条广告</AlertDialogTitle>
            <AlertDialogDescription>选择如何处理与现有广告的关系。导入后可以再次编辑或删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setImportMode("merge")}
              className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                importMode === "merge"
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <p className="font-medium">合并导入（推荐）</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                追加到现有广告之后；ID 已存在的广告会被跳过，避免重复
              </p>
            </button>
            <button
              type="button"
              onClick={() => setImportMode("replace")}
              className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                importMode === "replace"
                  ? "border-destructive bg-destructive/10 ring-1 ring-destructive/30"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <p className="font-medium text-destructive">完全替换</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                丢弃当前所有 {allAds.length} 条广告，使用导入文件的内容
              </p>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              {importMode === "replace" ? "确认替换" : "确认合并"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除 {selectedIds.size} 个广告？</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，所选广告将全部从所有广告位中移除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleBatchDelete();
                setBatchDeleteOpen(false);
              }}
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
