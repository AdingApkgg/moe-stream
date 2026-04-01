"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Link2,
  Plus,
  Copy,
  Trash2,
  Loader2,
  Users,
  Coins,
  MousePointerClick,
  TrendingUp,
  ExternalLink,
  History,
  CalendarCheck,
  Gift,
  Ticket,
  BarChart3,
  Target,
  Award,
  ArrowUpRight,
  UserPlus,
  Filter,
  Search,
  X,
  Wallet,
  CheckCircle,
  Clock,
  Upload,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DateRangePicker,
  createDateRange,
  dateRangeToApi,
  type DateRangeValue,
} from "@/components/ui/date-range-picker";
import { useSiteConfig } from "@/contexts/site-config";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CHANNEL_OPTIONS = [
  { value: "", label: "无渠道" },
  { value: "bilibili", label: "B站" },
  { value: "twitter", label: "Twitter/X" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "wechat", label: "微信" },
  { value: "qq", label: "QQ" },
  { value: "youtube", label: "YouTube" },
  { value: "reddit", label: "Reddit" },
  { value: "blog", label: "博客" },
  { value: "other", label: "其他" },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("已复制到剪贴板");
  });
}

function CheckinCard() {
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.referral.getCheckinStatus.useQuery();
  const checkinMutation = trpc.referral.checkin.useMutation({
    onSuccess: (res) => {
      if (res.awarded) {
        toast.success(`签到成功！获得 ${res.points} 积分`);
      } else {
        toast.info("今天已经签到过了");
      }
      utils.referral.getCheckinStatus.invalidate();
      utils.referral.getMyStats.invalidate();
      utils.referral.getPointsHistory.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.enabled) return null;

  return (
    <Card
      className={
        status.checkedInToday ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20" : ""
      }
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${status.checkedInToday ? "bg-green-100 dark:bg-green-900/50" : "bg-primary/10"}`}
            >
              <CalendarCheck
                className={`h-5 w-5 ${status.checkedInToday ? "text-green-600 dark:text-green-400" : "text-primary"}`}
              />
            </div>
            <div>
              <div className="font-medium">{status.checkedInToday ? "今日已签到" : "每日签到"}</div>
              <div className="text-xs text-muted-foreground">
                {status.checkedInToday
                  ? `今日获得 ${status.todayPoints} 积分`
                  : `签到可获得 ${status.pointsMin}~${status.pointsMax} 积分`}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant={status.checkedInToday ? "outline" : "default"}
            disabled={status.checkedInToday || checkinMutation.isPending}
            onClick={() => checkinMutation.mutate()}
          >
            {checkinMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Gift className="h-4 w-4 mr-1" />
            )}
            {status.checkedInToday ? "已签到" : "签到"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendBadge({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday === 0 && today === 0) return null;
  if (yesterday === 0)
    return today > 0 ? (
      <Badge variant="secondary" className="text-[10px] text-green-600">
        NEW
      </Badge>
    ) : null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct === 0) return null;
  return (
    <Badge variant="secondary" className={`text-[10px] ${pct > 0 ? "text-green-600" : "text-red-500"}`}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </Badge>
  );
}

function LinkFilter({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const { data } = trpc.referral.getMyLinks.useQuery({ page: 1, limit: 50 });
  const links = data?.links ?? [];

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const hasFilter = selectedIds.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={hasFilter ? "default" : "outline"} size="sm" className="gap-1.5">
          <Filter className="h-4 w-4" />
          {hasFilter ? `已选 ${selectedIds.length} 个链接` : "按链接筛选"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">选择推广链接</span>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>
              清除
            </Button>
          )}
        </div>
        <div className="max-h-[280px] overflow-y-auto p-2 space-y-1">
          {links.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">暂无链接</div>
          ) : (
            links.map((link) => (
              <label
                key={link.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
              >
                <Checkbox checked={selectedIds.includes(link.id)} onCheckedChange={() => toggle(link.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{link.label || link.code}</div>
                  {link.channel && (
                    <div className="text-xs text-muted-foreground">
                      {CHANNEL_OPTIONS.find((c) => c.value === link.channel)?.label || link.channel}
                    </div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatsCards({ linkIds, onNavigate }: { linkIds?: string[]; onNavigate?: (tab: string) => void }) {
  const { data: stats, isLoading } = trpc.referral.getMyStats.useQuery(linkIds?.length ? { linkIds } : undefined);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const primaryItems = [
    {
      label: "推广人数",
      value: stats?.totalReferrals ?? 0,
      icon: Users,
      color: "text-blue-500",
      today: stats?.todayRegisters ?? 0,
      yesterday: stats?.yesterdayRegisters ?? 0,
      sub: stats?.todayRegisters ? `今日 +${stats.todayRegisters}` : undefined,
      tab: "referrals",
    },
    {
      label: "独立访客",
      value: stats?.totalUniqueClicks ?? 0,
      icon: MousePointerClick,
      color: "text-purple-500",
      today: stats?.todayUniqueClicks ?? 0,
      yesterday: stats?.yesterdayUniqueClicks ?? 0,
      sub: `总点击 ${stats?.totalClicks ?? 0}（含重复）`,
      tab: "analytics",
    },
    {
      label: "转化率",
      value: stats?.conversionRate ?? 0,
      icon: Target,
      color: "text-green-500",
      suffix: "%",
      sub: `${stats?.totalRegisters ?? 0} 注册 / ${stats?.totalUniqueClicks ?? 0} 独立访客`,
      tab: "analytics",
    },
    {
      label: "推广积分",
      value: stats?.earnedPoints ?? 0,
      icon: Award,
      color: "text-amber-500",
      sub: `当前余额 ${stats?.points ?? 0}`,
      tab: "points",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {primaryItems.map((item) => (
        <Card
          key={item.label}
          className="cursor-pointer transition-all hover:shadow-md"
          onClick={() => onNavigate?.(item.tab)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                {item.label}
              </div>
              {"today" in item && item.today !== undefined && item.yesterday !== undefined && (
                <TrendBadge today={item.today} yesterday={item.yesterday} />
              )}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {item.value.toLocaleString()}
              {item.suffix || ""}
            </div>
            {item.sub && <div className="text-xs text-muted-foreground mt-1">{item.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type LinkSortBy = "createdAt" | "clicks" | "uniqueClicks" | "registers";

const LINK_SORT_OPTIONS: { value: LinkSortBy; label: string }[] = [
  { value: "createdAt", label: "创建时间" },
  { value: "clicks", label: "总点击" },
  { value: "uniqueClicks", label: "独立访客" },
  { value: "registers", label: "注册数" },
];

function LinksManager() {
  const siteConfig = useSiteConfig();
  const siteUrl = siteConfig?.siteUrl || (typeof window !== "undefined" ? window.location.origin : "");

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [sortBy, setSortBy] = useState<LinkSortBy>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const queryInput = {
    page,
    limit: 20,
    search: searchQuery.trim() || undefined,
    channel: filterChannel || undefined,
    isActive: filterActive === "all" ? undefined : filterActive === "active",
    sortBy,
    sortDir,
  };

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.referral.getMyLinks.useQuery(queryInput);

  const hasFilters = !!(searchQuery.trim() || filterChannel || filterActive !== "all");
  const clearFilters = () => {
    setSearchQuery("");
    setFilterChannel("");
    setFilterActive("all");
    setPage(1);
  };

  const createMutation = trpc.referral.createLink.useMutation({
    onSuccess: () => {
      toast.success("推广链接创建成功");
      setShowCreate(false);
      setNewLabel("");
      setNewChannel("");
      setNewTargetUrl("");
      utils.referral.getMyLinks.invalidate();
      utils.referral.getMyStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.referral.updateLink.useMutation({
    onSuccess: () => {
      toast.success("已更新");
      utils.referral.getMyLinks.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.referral.deleteLink.useMutation({
    onSuccess: () => {
      toast.success("推广链接已删除");
      setDeleteId(null);
      utils.referral.getMyLinks.invalidate();
      utils.referral.getMyStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">推广链接</CardTitle>
            <CardDescription>创建不同渠道的推广链接，追踪推广效果</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新建
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选栏 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标签或推广码..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={filterChannel}
              onValueChange={(v) => {
                setFilterChannel(v === "_all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="全部渠道" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部渠道</SelectItem>
                {CHANNEL_OPTIONS.filter((c) => c.value).map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
                <SelectItem value="_none">无渠道</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterActive}
              onValueChange={(v) => {
                setFilterActive(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用中</SelectItem>
                <SelectItem value="inactive">已停用</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortBy}-${sortDir}`}
              onValueChange={(v) => {
                const [field, dir] = v.split("-") as [LinkSortBy, "asc" | "desc"];
                setSortBy(field);
                setSortDir(dir);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_SORT_OPTIONS.map((opt) => (
                  <React.Fragment key={opt.value}>
                    <SelectItem value={`${opt.value}-desc`}>{opt.label} ↓</SelectItem>
                    <SelectItem value={`${opt.value}-asc`}>{opt.label} ↑</SelectItem>
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 筛选状态提示 */}
          {hasFilters && (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-muted-foreground">{data?.totalCount ?? 0} 条结果</span>
              <span className="text-muted-foreground/40">|</span>
              {searchQuery.trim() && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                >
                  搜索: {searchQuery.length > 8 ? searchQuery.slice(0, 8) + "…" : searchQuery}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterChannel && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => {
                    setFilterChannel("");
                    setPage(1);
                  }}
                >
                  {filterChannel === "_none"
                    ? "无渠道"
                    : CHANNEL_OPTIONS.find((c) => c.value === filterChannel)?.label || filterChannel}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterActive !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => {
                    setFilterActive("all");
                    setPage(1);
                  }}
                >
                  {filterActive === "active" ? "启用中" : "已停用"}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                清除全部
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.links.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {hasFilters ? (
                <>
                  <p>没有匹配的推广链接</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    清除筛选
                  </Button>
                </>
              ) : (
                <p>还没有推广链接，点击右上角创建一个</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.links.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{link.label || link.code}</span>
                      {link.channel && (
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-accent"
                          onClick={() => {
                            setFilterChannel(filterChannel === link.channel ? "" : (link.channel ?? ""));
                            setPage(1);
                          }}
                        >
                          {CHANNEL_OPTIONS.find((c) => c.value === link.channel)?.label || link.channel}
                        </Badge>
                      )}
                      {!link.isActive && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          已停用
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {siteUrl}/r/{link.code}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        {link.uniqueClicks} 独立 / {link.clicks} 总
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {link.registers} 注册
                      </span>
                      <span>
                        转化率 {link.uniqueClicks > 0 ? ((link.registers / link.uniqueClicks) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={link.isActive}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: link.id, isActive: checked })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${siteUrl}/r/${link.code}`)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    {link.targetUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={link.targetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {data.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs text-muted-foreground">共 {data.totalCount} 条</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      上一页
                    </Button>
                    <span className="text-sm text-muted-foreground flex items-center px-2">
                      {page} / {data.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建推广链接</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">标签（可选）</label>
              <Input placeholder="如：B站个人简介" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">渠道</label>
              <Select value={newChannel} onValueChange={setNewChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="选择渠道" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value || "_none"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">自定义落地页（可选）</label>
              <Input placeholder="https://..." value={newTargetUrl} onChange={(e) => setNewTargetUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">留空则跳转到站点首页</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  label: newLabel || undefined,
                  channel: (newChannel === "_none" ? "" : newChannel) || undefined,
                  targetUrl: newTargetUrl || undefined,
                })
              }
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后推广链接将无法访问，已有推广记录不会受影响。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReferralsList() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("");

  const queryInput = {
    page,
    limit: 20,
    search: searchQuery.trim() || undefined,
    channel: filterChannel || undefined,
  };

  const { data, isLoading } = trpc.referral.getMyReferrals.useQuery(queryInput);

  const hasFilters = !!(searchQuery.trim() || filterChannel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">推广用户</CardTitle>
        <CardDescription>通过你的链接注册的用户</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 筛选栏 */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户名或昵称..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select
            value={filterChannel || "_all"}
            onValueChange={(v) => {
              setFilterChannel(v === "_all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="全部渠道" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部渠道</SelectItem>
              {CHANNEL_OPTIONS.filter((c) => c.value).map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
              <SelectItem value="_none">无渠道</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">{data?.totalCount ?? 0} 条结果</span>
            <span className="text-muted-foreground/40">|</span>
            {searchQuery.trim() && (
              <Badge
                variant="secondary"
                className="gap-1 text-[11px] cursor-pointer"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
              >
                搜索: {searchQuery.length > 8 ? searchQuery.slice(0, 8) + "…" : searchQuery}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {filterChannel && (
              <Badge
                variant="secondary"
                className="gap-1 text-[11px] cursor-pointer"
                onClick={() => {
                  setFilterChannel("");
                  setPage(1);
                }}
              >
                {filterChannel === "_none"
                  ? "无渠道"
                  : CHANNEL_OPTIONS.find((c) => c.value === filterChannel)?.label || filterChannel}
                <X className="h-3 w-3" />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setSearchQuery("");
                setFilterChannel("");
                setPage(1);
              }}
            >
              清除
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.records.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {hasFilters ? (
              <>
                <p>没有匹配的推广用户</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterChannel("");
                    setPage(1);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  清除筛选
                </Button>
              </>
            ) : (
              <p>暂无推广用户</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {data.records.map((record) => (
              <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {(record.referredUser.nickname || record.referredUser.username)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {record.referredUser.nickname || record.referredUser.username}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{record.referredUser.username}
                    {record.referralLink && (
                      <span className="ml-2">
                        via {record.referralLink.label || record.referralLink.code}
                        {record.referralLink.channel && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] ml-1 cursor-pointer hover:bg-accent"
                            onClick={() => {
                              setFilterChannel(
                                filterChannel === record.referralLink!.channel
                                  ? ""
                                  : (record.referralLink!.channel ?? ""),
                              );
                              setPage(1);
                            }}
                          >
                            {CHANNEL_OPTIONS.find((c) => c.value === record.referralLink!.channel)?.label ||
                              record.referralLink!.channel}
                          </Badge>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    <Coins className="h-3 w-3 mr-1" />+{record.pointsAwarded}
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">共 {data.totalCount} 条</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground flex items-center px-2">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const POINTS_TYPE_LABELS: Record<string, string> = {
  REFERRAL_REWARD: "推广奖励",
  ADMIN_ADJUST: "管理员调整",
  POINTS_CONSUME: "积分消耗",
  CHECKIN: "每日签到",
  DAILY_LOGIN: "每日登录",
  WATCH_VIDEO: "观看视频",
  LIKE_VIDEO: "点赞视频",
  FAVORITE_VIDEO: "收藏视频",
  COMMENT_VIDEO: "评论视频",
  VIEW_GAME: "浏览游戏",
  LIKE_GAME: "点赞游戏",
  FAVORITE_GAME: "收藏游戏",
  COMMENT_GAME: "评论游戏",
  VIEW_IMAGE: "浏览图片",
  LIKE_IMAGE: "点赞图片",
  FAVORITE_IMAGE: "收藏图片",
  COMMENT_IMAGE: "评论图片",
  REDEEM_CODE: "兑换码兑换",
  USDT_RECHARGE: "USDT 充值",
};

const POINTS_TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "推广 & 签到", types: ["REFERRAL_REWARD", "CHECKIN", "DAILY_LOGIN"] },
  { label: "视频互动", types: ["WATCH_VIDEO", "LIKE_VIDEO", "FAVORITE_VIDEO", "COMMENT_VIDEO"] },
  { label: "游戏互动", types: ["VIEW_GAME", "LIKE_GAME", "FAVORITE_GAME", "COMMENT_GAME"] },
  { label: "图片互动", types: ["VIEW_IMAGE", "LIKE_IMAGE", "FAVORITE_IMAGE", "COMMENT_IMAGE"] },
  { label: "充值 & 兑换", types: ["USDT_RECHARGE", "REDEEM_CODE"] },
  { label: "其他", types: ["ADMIN_ADJUST", "POINTS_CONSUME"] },
];

function PointsHistory() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("");
  const [filterDir, setFilterDir] = useState<string>("all");

  const queryInput = {
    page,
    limit: 20,
    type: filterType || undefined,
    amountDir: filterDir === "all" ? undefined : (filterDir as "income" | "expense"),
  };

  const { data, isLoading } = trpc.referral.getPointsHistory.useQuery(queryInput);

  const hasFilters = !!(filterType || filterDir !== "all");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">积分流水</CardTitle>
        <CardDescription>积分变动记录</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 筛选栏 */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={filterType || "_all"}
            onValueChange={(v) => {
              setFilterType(v === "_all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">全部类型</SelectItem>
              {POINTS_TYPE_GROUPS.map((group) => (
                <React.Fragment key={group.label}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group.label}</div>
                  {group.types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {POINTS_TYPE_LABELS[t] || t}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterDir}
            onValueChange={(v) => {
              setFilterDir(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[110px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部方向</SelectItem>
              <SelectItem value="income">收入</SelectItem>
              <SelectItem value="expense">支出</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <div className="flex items-center gap-2">
              {filterType && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => {
                    setFilterType("");
                    setPage(1);
                  }}
                >
                  {POINTS_TYPE_LABELS[filterType] || filterType}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterDir !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => {
                    setFilterDir("all");
                    setPage(1);
                  }}
                >
                  {filterDir === "income" ? "收入" : "支出"}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setFilterType("");
                  setFilterDir("all");
                  setPage(1);
                }}
              >
                清除
              </Button>
              <span className="text-xs text-muted-foreground ml-1">{data?.totalCount ?? 0} 条结果</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.transactions.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {hasFilters ? (
              <>
                <p>没有匹配的积分记录</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setFilterType("");
                    setFilterDir("all");
                    setPage(1);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  清除筛选
                </Button>
              </>
            ) : (
              <p>暂无积分记录</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {data.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium text-sm cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        setFilterType(filterType === tx.type ? "" : tx.type);
                        setPage(1);
                      }}
                    >
                      {POINTS_TYPE_LABELS[tx.type] || tx.type}
                    </span>
                    {filterType === tx.type && (
                      <Badge variant="default" className="text-[10px] gap-0.5">
                        筛选中
                      </Badge>
                    )}
                  </div>
                  {tx.description && <div className="text-xs text-muted-foreground truncate">{tx.description}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount}
                  </div>
                  <div className="text-xs text-muted-foreground">余额 {tx.balance}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(tx.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">共 {data.totalCount} 条</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground flex items-center px-2">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TREND_PRESETS = [
  { label: "7天", days: 7 },
  { label: "14天", days: 14 },
  { label: "30天", days: 30 },
  { label: "90天", days: 90 },
];

const trendChartConfig = {
  uniqueClicks: { label: "独立访客", color: "hsl(var(--chart-1))" },
  registers: { label: "注册", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const channelChartConfig = {
  clicks: { label: "点击", color: "hsl(var(--chart-1))" },
  registers: { label: "注册", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const CHANNEL_LABELS: Record<string, string> = {
  direct: "直接访问",
  bilibili: "B站",
  twitter: "Twitter/X",
  telegram: "Telegram",
  discord: "Discord",
  wechat: "微信",
  qq: "QQ",
  youtube: "YouTube",
  reddit: "Reddit",
  blog: "博客",
  other: "其他",
};

function formatTrendDate(v: string) {
  const d = new Date(v);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTooltipDate(v: unknown) {
  const d = new Date(v as string);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TrendSummary({ data }: { data: { uniqueClicks: number; registers: number }[] }) {
  const total = data.reduce((acc, d) => ({ uv: acc.uv + d.uniqueClicks, reg: acc.reg + d.registers }), {
    uv: 0,
    reg: 0,
  });
  const half = Math.floor(data.length / 2);
  const recent = data.slice(half);
  const earlier = data.slice(0, half);
  const recentSum = recent.reduce((acc, d) => ({ uv: acc.uv + d.uniqueClicks, reg: acc.reg + d.registers }), {
    uv: 0,
    reg: 0,
  });
  const earlierSum = earlier.reduce((acc, d) => ({ uv: acc.uv + d.uniqueClicks, reg: acc.reg + d.registers }), {
    uv: 0,
    reg: 0,
  });

  const uvTrend =
    earlierSum.uv > 0 ? Math.round(((recentSum.uv - earlierSum.uv) / earlierSum.uv) * 100) : recentSum.uv > 0 ? 100 : 0;
  const regTrend =
    earlierSum.reg > 0
      ? Math.round(((recentSum.reg - earlierSum.reg) / earlierSum.reg) * 100)
      : recentSum.reg > 0
        ? 100
        : 0;

  return (
    <div className="flex items-center gap-6 text-sm flex-wrap">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-uniqueClicks)" }} />
        <span className="text-muted-foreground">独立访客 {total.uv}</span>
        {uvTrend !== 0 && (
          <span className={uvTrend > 0 ? "text-green-600 text-xs" : "text-red-500 text-xs"}>
            {uvTrend > 0 ? "+" : ""}
            {uvTrend}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-registers)" }} />
        <span className="text-muted-foreground">注册 {total.reg}</span>
        {regTrend !== 0 && (
          <span className={regTrend > 0 ? "text-green-600 text-xs" : "text-red-500 text-xs"}>
            {regTrend > 0 ? "+" : ""}
            {regTrend}%
          </span>
        )}
      </div>
      <div className="text-muted-foreground">
        转化 {total.uv > 0 ? ((total.reg / total.uv) * 100).toFixed(1) : "0"}%
      </div>
    </div>
  );
}

function DailyHistoryTable({ linkIds, dateRange }: { linkIds?: string[]; dateRange: DateRangeValue }) {
  const { data, isLoading } = trpc.referral.getMyDailyHistory.useQuery({
    ...dateRangeToApi(dateRange),
    linkIds,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            历史数据
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) return null;

  const dailyTotals = new Map<string, { clicks: number; registers: number }>();
  for (const row of data) {
    const prev = dailyTotals.get(row.date) || { clicks: 0, registers: 0 };
    prev.clicks += row.clicks;
    prev.registers += row.registers;
    dailyTotals.set(row.date, prev);
  }

  const sortedDates = Array.from(dailyTotals.keys()).sort();
  const cumulativeByDate = new Map<string, { clicks: number; registers: number }>();
  let cumClicks = 0;
  let cumRegisters = 0;
  for (const date of sortedDates) {
    const daily = dailyTotals.get(date)!;
    cumClicks += daily.clicks;
    cumRegisters += daily.registers;
    cumulativeByDate.set(date, { clicks: cumClicks, registers: cumRegisters });
  }

  const totalClicks = data.reduce((sum, r) => sum + r.clicks, 0);
  const totalRegisters = data.reduce((sum, r) => sum + r.registers, 0);
  const totalPoints = data.reduce((sum, r) => sum + r.points, 0);
  const rows = [...data].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-amber-500" />
          历史数据
        </CardTitle>
        <CardDescription>按日期和渠道汇总的推广数据（共 {data.length} 条记录）</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead className="text-right">今日点击</TableHead>
              <TableHead className="text-right">今日注册</TableHead>
              <TableHead className="text-right">累计点击</TableHead>
              <TableHead className="text-right">累计注册</TableHead>
              <TableHead className="text-right">积分</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => {
              const cum = cumulativeByDate.get(row.date) || { clicks: 0, registers: 0 };
              return (
                <TableRow key={idx}>
                  <TableCell className="tabular-nums">{row.date}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {CHANNEL_LABELS[row.channel] || row.channel || "直接访问"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.clicks}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.registers}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{cum.clicks}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{cum.registers}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.points > 0 ? <span className="text-green-600">+{row.points}</span> : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                合计
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{totalClicks}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{totalRegisters}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{cumClicks}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{cumRegisters}</TableCell>
              <TableCell className="text-right font-medium tabular-nums text-green-600">
                {totalPoints > 0 ? `+${totalPoints}` : "-"}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

function AnalyticsPanel({ linkIds }: { linkIds?: string[] }) {
  const [trendRange, setTrendRange] = useState<DateRangeValue>(() => createDateRange(30));
  const [linkSortBy, setLinkSortBy] = useState<"uniqueClicks" | "registers" | "conversionRate">("registers");
  const { data: trendData, isLoading: trendLoading } = trpc.referral.getMyTrendStats.useQuery({
    ...dateRangeToApi(trendRange),
    linkIds,
  });
  const { data: channelData, isLoading: channelLoading } = trpc.referral.getChannelStats.useQuery(
    linkIds?.length ? { linkIds } : undefined,
  );
  const { data: topLinks, isLoading: linksLoading } = trpc.referral.getTopLinks.useQuery({
    limit: 5,
    sortBy: linkSortBy,
    linkIds,
  });

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              推广趋势
            </CardTitle>
            <CardDescription>每日点击与注册变化</CardDescription>
          </div>
          <DateRangePicker value={trendRange} onChange={setTrendRange} presets={TREND_PRESETS} />
        </CardHeader>
        <CardContent className="space-y-3">
          {trendLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : !trendData?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>暂无趋势数据</p>
            </div>
          ) : (
            <>
              <TrendSummary data={trendData} />
              <ChartContainer config={trendChartConfig} className="h-[220px] w-full">
                <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillUniqueClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-uniqueClicks)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-uniqueClicks)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillRegisters" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-registers)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--color-registers)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={formatTrendDate}
                    minTickGap={24}
                  />
                  <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={formatTooltipDate} />} />
                  <Area
                    type="monotone"
                    dataKey="uniqueClicks"
                    stroke="var(--color-uniqueClicks)"
                    fill="url(#fillUniqueClicks)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="registers"
                    stroke="var(--color-registers)"
                    fill="url(#fillRegisters)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Daily History Table */}
      <DailyHistoryTable linkIds={linkIds} dateRange={trendRange} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Channel Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-500" />
              渠道分析
            </CardTitle>
            <CardDescription>各渠道推广效果对比</CardDescription>
          </CardHeader>
          <CardContent>
            {channelLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : !channelData?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无渠道数据</p>
              </div>
            ) : (
              <div className="space-y-4">
                <ChartContainer config={channelChartConfig} className="h-[180px] w-full">
                  <BarChart
                    data={channelData.map((c) => ({
                      ...c,
                      channelLabel: CHANNEL_LABELS[c.channel] || c.channel,
                    }))}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="channelLabel" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="registers" fill="var(--color-registers)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="space-y-2">
                  {channelData.map((ch) => (
                    <div key={ch.channel} className="flex items-center gap-3 text-sm">
                      <Badge variant="secondary" className="text-xs min-w-[60px] justify-center">
                        {CHANNEL_LABELS[ch.channel] || ch.channel}
                      </Badge>
                      <div className="flex-1 flex items-center gap-4 text-muted-foreground">
                        <span>{ch.uniqueClicks} 独立访客</span>
                        <span>{ch.registers} 注册</span>
                        <span className="text-foreground font-medium">{ch.conversionRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Links */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-purple-500" />
                链接排行
              </CardTitle>
              <CardDescription>表现最佳的推广链接</CardDescription>
            </div>
            <Select value={linkSortBy} onValueChange={(v) => setLinkSortBy(v as typeof linkSortBy)}>
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registers">按注册</SelectItem>
                <SelectItem value="uniqueClicks">按访客</SelectItem>
                <SelectItem value="conversionRate">按转化</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {linksLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !topLinks?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无链接数据</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topLinks.map((link, idx) => (
                  <div key={link.id} className="flex items-center gap-3 p-2.5 rounded-lg border">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{link.label || link.code}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {link.channel && <span>{CHANNEL_LABELS[link.channel] || link.channel}</span>}
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3" />
                          {link.uniqueClicks} 访客
                        </span>
                        <span className="flex items-center gap-1">
                          <UserPlus className="h-3 w-3" />
                          {link.registers} 注册
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{link.conversionRate}%</div>
                      <div className="text-xs text-muted-foreground">转化率</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ========== USDT Recharge ==========

function RechargeCard() {
  const [open, setOpen] = useState(false);
  const { data: config } = trpc.payment.getConfig.useQuery();

  if (!config?.usdtPaymentEnabled) return null;

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">USDT 充值</div>
              <div className="text-xs text-muted-foreground">使用 TRC20 USDT 快速充值积分</div>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              充值
            </Button>
          </div>
        </CardContent>
      </Card>

      <RechargeDialog open={open} onOpenChange={setOpen} config={config} />
    </>
  );
}

type PaymentConfig = {
  usdtPaymentEnabled: boolean;
  usdtPointsPerUnit: number;
  usdtMinAmount: number | null;
  usdtMaxAmount: number | null;
  usdtOrderTimeoutMin: number;
};

type OrderResult = {
  id: string;
  orderNo: string;
  amount: number;
  walletAddress: string;
  pointsAmount: number;
  grantUpload: boolean;
  expiresAt: Date;
  description: string | null;
};

function RechargeDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: PaymentConfig;
}) {
  const [step, setStep] = useState<"select" | "paying" | "success">("select");
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const utils = trpc.useUtils();
  const { data: packages } = trpc.payment.getPackages.useQuery(undefined, { enabled: open });
  const createMutation = trpc.payment.createOrder.useMutation({
    onSuccess: async (data) => {
      setOrder(data as unknown as OrderResult);
      setStep("paying");
      try {
        const QRCode = (await import("qrcode")).default;
        const qr = await QRCode.toDataURL(`tron:${data.walletAddress}?amount=${data.amount}`, {
          width: 256,
          margin: 2,
        });
        setQrDataUrl(qr);
      } catch {
        /* qr generation failed, user can still copy address */
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: orderStatus } = trpc.payment.checkOrderStatus.useQuery(
    { orderId: order?.id ?? "" },
    { enabled: step === "paying" && !!order?.id, refetchInterval: 5000 },
  );

  useEffect(() => {
    if (orderStatus?.status === "PAID" && step === "paying") {
      setStep("success");
      utils.user.me.invalidate();
      utils.referral.getMyStats.invalidate();
      utils.referral.getPointsHistory.invalidate();
    }
  }, [orderStatus?.status, step, utils]);

  const reset = useCallback(() => {
    setStep("select");
    setSelectedPkgId(null);
    setCustomAmount("");
    setOrder(null);
    setQrDataUrl("");
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleCreate = () => {
    if (selectedPkgId) {
      createMutation.mutate({ packageId: selectedPkgId });
    } else if (customAmount) {
      const amt = parseFloat(customAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error("请输入有效金额");
        return;
      }
      createMutation.mutate({ customAmount: amt });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "USDT 充值"}
            {step === "paying" && "等待支付"}
            {step === "success" && "充值成功"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            {packages && packages.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">选择套餐</div>
                <div className="grid grid-cols-2 gap-2">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => {
                        setSelectedPkgId(pkg.id);
                        setCustomAmount("");
                      }}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        selectedPkgId === pkg.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-foreground/20"
                      }`}
                    >
                      <div className="font-bold text-lg">{pkg.amount} USDT</div>
                      <div className="text-sm text-muted-foreground">{pkg.pointsAmount.toLocaleString()} 积分</div>
                      {pkg.grantUpload && (
                        <div className="text-xs text-green-500 flex items-center gap-1 mt-1">
                          <Upload className="h-3 w-3" />
                          上传权限
                        </div>
                      )}
                      {pkg.description && <div className="text-xs text-muted-foreground mt-1">{pkg.description}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">自定义金额</div>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  step={0.01}
                  min={config.usdtMinAmount ?? 0.01}
                  max={config.usdtMaxAmount ?? undefined}
                  placeholder={`${config.usdtMinAmount ?? 1}~${config.usdtMaxAmount ?? "不限"} USDT`}
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPkgId(null);
                  }}
                />
                <span className="text-sm text-muted-foreground shrink-0">USDT</span>
              </div>
              {customAmount && !isNaN(parseFloat(customAmount)) && parseFloat(customAmount) > 0 && (
                <div className="text-xs text-muted-foreground">
                  预计获得 {Math.floor(parseFloat(customAmount) * config.usdtPointsPerUnit).toLocaleString()} 积分
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                className="w-full"
                disabled={(!selectedPkgId && !customAmount) || createMutation.isPending}
                onClick={handleCreate}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Wallet className="h-4 w-4 mr-1" />
                立即充值
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "paying" && order && (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-500 text-sm">
              <Clock className="h-4 w-4" />
              <CountdownTimer expiresAt={order.expiresAt} />
            </div>

            {qrDataUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Payment QR" className="w-48 h-48 rounded-lg border" />
              </div>
            )}

            <div className="space-y-3 text-left">
              <div>
                <div className="text-xs text-muted-foreground">收款地址 (TRC20)</div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">{order.walletAddress}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyToClipboard(order.walletAddress)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">精确支付金额</div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-lg font-bold text-primary">{order.amount.toFixed(2)} USDT</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyToClipboard(order.amount.toFixed(2))}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg p-2">
                请务必转账 <strong>精确金额</strong>（含小数），否则系统无法自动匹配。
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在等待链上确认...
            </div>
          </div>
        )}

        {step === "success" && order && (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <div className="text-lg font-bold">充值成功！</div>
              <div className="text-muted-foreground text-sm mt-1">
                {order.amount.toFixed(2)} USDT → {order.pointsAmount.toLocaleString()} 积分
              </div>
              {order.grantUpload && (
                <div className="text-green-500 text-sm mt-1 flex items-center justify-center gap-1">
                  <Upload className="h-4 w-4" />
                  已获得上传权限
                </div>
              )}
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              完成
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CountdownTimer({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(() => {
        const next = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;

  if (remaining <= 0) return <span className="text-red-500">已超时</span>;

  return (
    <span>
      {min}:{sec.toString().padStart(2, "0")}
    </span>
  );
}

function RedeemCodeCard() {
  const [code, setCode] = useState("");
  const utils = trpc.useUtils();

  const redeemMutation = trpc.redeem.redeem.useMutation({
    onSuccess: (data) => {
      const rewardText = data.rewards.join("、");
      toast.success(`兑换成功！获得: ${rewardText}`);
      setCode("");
      utils.referral.getMyStats.invalidate();
      utils.referral.getPointsHistory.invalidate();
      utils.user.me.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Ticket className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm mb-1.5">兑换码</div>
            <div className="flex gap-2">
              <Input
                placeholder="输入兑换码"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.trim()) {
                    redeemMutation.mutate({ code: code.trim() });
                  }
                }}
                className="h-8 text-sm font-mono"
              />
              <Button
                size="sm"
                disabled={!code.trim() || redeemMutation.isPending}
                onClick={() => redeemMutation.mutate({ code: code.trim() })}
                className="shrink-0"
              >
                {redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "兑换"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReferralPage() {
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("analytics");
  const linkIds = selectedLinkIds.length > 0 ? selectedLinkIds : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            推广中心
          </h1>
          <p className="text-muted-foreground mt-1">创建推广链接，邀请新用户注册赚取积分</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkFilter selectedIds={selectedLinkIds} onChange={setSelectedLinkIds} />
          {selectedLinkIds.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedLinkIds([])}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <CheckinCard />

      <RedeemCodeCard />

      <RechargeCard />

      <StatsCards linkIds={linkIds} onNavigate={setActiveTab} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-1" />
            数据分析
          </TabsTrigger>
          <TabsTrigger value="links">推广链接</TabsTrigger>
          <TabsTrigger value="referrals">推广用户</TabsTrigger>
          <TabsTrigger value="points">积分流水</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsPanel linkIds={linkIds} />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <LinksManager />
        </TabsContent>
        <TabsContent value="referrals" className="mt-4">
          <ReferralsList />
        </TabsContent>
        <TabsContent value="points" className="mt-4">
          <PointsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
