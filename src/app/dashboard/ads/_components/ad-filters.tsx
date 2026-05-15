"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, X, ChevronsUpDown } from "lucide-react";
import { AD_POSITIONS } from "@/lib/ads";
import { SORT_OPTIONS, type SortField, type SortDir } from "./types";

interface AdFiltersProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filterPosition: string;
  onPositionChange: (v: string) => void;
  filterStatus: string;
  onStatusChange: (v: string) => void;
  filterPlatform: string;
  onPlatformChange: (v: string) => void;
  filterKind: string;
  onKindChange: (v: string) => void;
  platforms: string[];
  sortField: SortField;
  sortDir: SortDir;
  onSortChange: (field: SortField) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  filteredCount: number;
  totalCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: "投放中",
  disabled: "已禁用",
  scheduled: "待投放",
  expired: "已过期",
};

export function AdFilters({
  searchQuery,
  onSearchChange,
  filterPosition,
  onPositionChange,
  filterStatus,
  onStatusChange,
  filterPlatform,
  onPlatformChange,
  filterKind,
  onKindChange,
  platforms,
  sortField,
  sortDir,
  onSortChange,
  activeFilterCount,
  onClearAll,
  filteredCount,
  totalCount,
}: AdFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索广告标题、平台、链接、描述..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={filterPosition} onValueChange={onPositionChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="广告位" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-filter">全部广告位</SelectItem>
            {AD_POSITIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={onStatusChange}>
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
          <Select value={filterPlatform} onValueChange={onPlatformChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterKind} onValueChange={onKindChange}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="image">图片广告</SelectItem>
            <SelectItem value="html">代码广告</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">排序方式</div>
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.value} onClick={() => onSortChange(opt.value)} className="justify-between">
                {opt.label}
                {sortField === opt.value && (
                  <span className="text-xs text-muted-foreground">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {filteredCount === totalCount ? `共 ${totalCount} 个广告` : `${filteredCount} / ${totalCount} 个广告`}
          </span>
          {activeFilterCount > 0 && (
            <>
              <span className="text-muted-foreground/40">|</span>
              {searchQuery.trim() && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => onSearchChange("")}
                >
                  搜索: {searchQuery.length > 8 ? searchQuery.slice(0, 8) + "…" : searchQuery}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterStatus !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => onStatusChange("all")}
                >
                  {STATUS_LABELS[filterStatus] ?? filterStatus}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterPosition !== "all-filter" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => onPositionChange("all-filter")}
                >
                  {AD_POSITIONS.find((p) => p.value === filterPosition)?.label}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterPlatform !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => onPlatformChange("all")}
                >
                  {filterPlatform}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {filterKind !== "all" && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] cursor-pointer"
                  onClick={() => onKindChange("all")}
                >
                  {filterKind === "html" ? "代码广告" : "图片广告"}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={onClearAll}>
                清除全部
              </Button>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">
          按{SORT_OPTIONS.find((o) => o.value === sortField)?.label} {sortDir === "asc" ? "升序" : "降序"}
        </div>
      </div>
    </div>
  );
}
