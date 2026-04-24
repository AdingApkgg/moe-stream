"use client";

import { useMemo } from "react";
import type { Ad } from "@/lib/ads";
import { getPositionsLabel } from "@/lib/ads";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  ImageIcon,
  ExternalLink,
  MonitorPlay,
  ArrowUpDown,
  Calendar,
  Edit2,
  Eye,
  Copy,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAdStatus, formatDate, STATUS_TONE_CLASS } from "./utils";

/** 广告指标（可选，由父级传入） */
export interface AdItemMetric {
  impressions: number;
  clicks: number;
}

interface AdListItemProps {
  ad: Ad;
  selected: boolean;
  saving: boolean;
  onToggleSelect: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onEdit: (ad: Ad) => void;
  onPreview: (ad: Ad) => void;
  onDuplicate: (ad: Ad) => void;
  onDelete: (id: string) => void;
  onPlatformClick: (platform: string) => void;
  metric?: AdItemMetric;
}

export function AdListItem({
  ad,
  selected,
  saving,
  onToggleSelect,
  onToggleEnabled,
  onEdit,
  onPreview,
  onDuplicate,
  onDelete,
  onPlatformClick,
  metric,
}: AdListItemProps) {
  const status = getAdStatus(ad);
  const StatusIcon = status.icon;
  const posLabel = getPositionsLabel(ad.positions);

  const ctr = useMemo(() => {
    if (!metric || metric.impressions === 0) return null;
    return (metric.clicks / metric.impressions) * 100;
  }, [metric]);

  return (
    <Card
      className={cn(
        "transition-all",
        !ad.enabled && "opacity-60",
        selected && "ring-2 ring-primary/30 bg-primary/[0.02]",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex items-center pt-0.5">
            <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(ad.id)} />
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
              <Badge variant="outline" className={cn("gap-1 text-[11px]", STATUS_TONE_CLASS[status.tone])}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
              {ad.platform && (
                <Badge
                  variant="outline"
                  className="text-[11px] cursor-pointer hover:bg-accent"
                  onClick={() => onPlatformClick(ad.platform)}
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
              {metric && (
                <span className="flex items-center gap-1" title="展示 / 点击 / 点击率">
                  <TrendingUp className="h-3 w-3" />
                  {metric.impressions.toLocaleString()} / {metric.clicks.toLocaleString()}
                  {ctr != null && <span className="text-primary font-medium ml-0.5">({ctr.toFixed(1)}%)</span>}
                </span>
              )}
            </div>
          </div>

          {/* 操作 */}
          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={ad.enabled} onCheckedChange={(v) => onToggleEnabled(ad.id, v)} disabled={saving} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(ad)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPreview(ad)}>
                  <Eye className="h-4 w-4 mr-2" />
                  预览
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(ad)}>
                  <Copy className="h-4 w-4 mr-2" />
                  复制
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(ad.id)}>
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
}
