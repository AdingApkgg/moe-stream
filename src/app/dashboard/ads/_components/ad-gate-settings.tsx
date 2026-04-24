"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ShieldAlert } from "lucide-react";

interface AdGateSettingsProps {
  enabled: boolean;
  viewsRequired: number;
  hours: number;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onUpdate: (field: "adGateViewsRequired" | "adGateHours", value: number) => void;
}

export function AdGateSettings({ enabled, viewsRequired, hours, disabled, onToggle, onUpdate }: AdGateSettingsProps) {
  return (
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
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">需观看/点击次数</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={viewsRequired}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1 && v <= 20) onUpdate("adGateViewsRequired", v);
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
              value={hours}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1 && v <= 168) onUpdate("adGateHours", v);
              }}
            />
            <p className="text-xs text-muted-foreground">达成后多少小时内不再显示广告门</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
