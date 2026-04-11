"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getRedirectUrl } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link2, Search, X, MousePointerClick, Users, StickyNote, ExternalLink, Copy } from "lucide-react";
import { toast } from "@/lib/toast-with-sound";

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

const CHANNEL_LABELS: Record<string, string> = Object.fromEntries(
  CHANNEL_OPTIONS.filter((c) => c.value).map((c) => [c.value, c.label]),
);

type SortBy = "createdAt" | "clicks" | "uniqueClicks" | "registers" | "paymentAmount";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "createdAt", label: "创建时间" },
  { value: "clicks", label: "总点击" },
  { value: "uniqueClicks", label: "独立访客" },
  { value: "registers", label: "注册数" },
  { value: "paymentAmount", label: "充值金额" },
];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success("已复制到剪贴板");
  });
}

export default function ReferralAdminPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
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

  const { data, isLoading } = trpc.referral.adminGetAllLinks.useQuery(queryInput);

  const hasFilters = !!(searchQuery.trim() || filterChannel || filterActive !== "all");
  const clearFilters = () => {
    setSearchQuery("");
    setFilterChannel("");
    setFilterActive("all");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6" />
          全站推广管理
        </h1>
        <p className="text-muted-foreground mt-1">查看所有用户的推广链接及数据</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">推广链接列表</CardTitle>
          <CardDescription>全站所有推广链接，支持按用户、渠道、状态搜索筛选</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选栏 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标签、推广码、备注或用户名..."
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
                const [field, dir] = v.split("-") as [SortBy, "asc" | "desc"];
                setSortBy(field);
                setSortDir(dir);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
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
                  {filterChannel === "_none" ? "无渠道" : CHANNEL_LABELS[filterChannel] || filterChannel}
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
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.links.length ? (
            <div className="text-center py-12 text-muted-foreground">
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
                <p>暂无推广链接数据</p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>标签 / 推广码</TableHead>
                      <TableHead>渠道</TableHead>
                      <TableHead className="text-right">独立访客</TableHead>
                      <TableHead className="text-right">注册</TableHead>
                      <TableHead className="text-right">转化率</TableHead>
                      <TableHead className="text-right">充值额</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="text-right">创建时间</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TooltipProvider>
                      {data.links.map((link) => {
                        const conversionRate =
                          link.uniqueClicks > 0 ? ((link.registers / link.uniqueClicks) * 100).toFixed(1) : "0";
                        return (
                          <TableRow key={link.id}>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[100px]">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                                  {(link.user.nickname || link.user.username)?.[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm truncate max-w-[120px]">
                                  {link.user.nickname || link.user.username}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="min-w-[100px]">
                                <div className="font-medium text-sm truncate">{link.label || link.code}</div>
                                <div className="text-xs text-muted-foreground font-mono">{link.code}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {link.channel ? (
                                <Badge variant="secondary" className="text-xs">
                                  {CHANNEL_LABELS[link.channel] || link.channel}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="flex items-center justify-end gap-1">
                                <MousePointerClick className="h-3 w-3 text-muted-foreground" />
                                {link.uniqueClicks}
                              </div>
                              <div className="text-xs text-muted-foreground">总 {link.clicks}</div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="flex items-center justify-end gap-1">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                {link.registers}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{conversionRate}%</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {link.paymentAmount > 0 ? (
                                <span className="text-green-600">${link.paymentAmount.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={link.isActive ? "default" : "outline"} className="text-xs">
                                {link.isActive ? "启用" : "停用"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {link.note ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help max-w-[120px]">
                                      <StickyNote className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{link.note}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[300px]">
                                    <p className="whitespace-pre-wrap">{link.note}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(link.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => copyToClipboard(link.code)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                {link.targetUrl && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                    <a href={getRedirectUrl(link.targetUrl)} target="_blank" rel="noreferrer">
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TooltipProvider>
                  </TableBody>
                </Table>
              </div>

              {data.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
