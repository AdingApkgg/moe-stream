"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, TrendingUp, Layers, Users } from "lucide-react";
import { ChartCard } from "../../_components/charts/chart-card";
import { ConversionFunnel } from "../../_components/charts/conversion-funnel";
import { formatCompact, formatUSDT } from "../../_components/charts/utils";

const CHANNEL_LABELS: Record<string, string> = {
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

const RANGE_OPTIONS = [
  { value: 7, label: "7天" },
  { value: 14, label: "14天" },
  { value: 30, label: "30天" },
  { value: 90, label: "90天" },
] as const;

const FUNNEL_COLORS = ["hsl(217, 91%, 60%)", "hsl(263, 70%, 55%)", "hsl(289, 75%, 55%)", "hsl(160, 80%, 45%)"];

const trendConfig = {
  clicks: { label: "总点击", color: "hsl(217, 91%, 60%)" },
  uniqueClicks: { label: "独立访客", color: "hsl(263, 70%, 55%)" },
  registers: { label: "注册", color: "hsl(289, 75%, 55%)" },
  paymentCount: { label: "付费", color: "hsl(160, 80%, 45%)" },
  paymentAmount: { label: "金额", color: "hsl(38, 92%, 50%)" },
} satisfies ChartConfig;

const channelConfig = {
  uniqueClicks: { label: "独立访客", color: "hsl(217, 91%, 60%)" },
  registers: { label: "注册", color: "hsl(263, 70%, 55%)" },
  paymentCount: { label: "付费", color: "hsl(160, 80%, 45%)" },
  paymentAmount: { label: "金额", color: "hsl(38, 92%, 50%)" },
} satisfies ChartConfig;

const CHANNEL_PALETTE = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 80%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(263, 70%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(187, 85%, 53%)",
  "hsl(289, 75%, 55%)",
  "hsl(330, 80%, 60%)",
];

export function ReferralInsights() {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30);

  const { data: trend, isLoading: trendLoading } = trpc.referral.adminGetTrendStats.useQuery({ days });
  const { data: channels, isLoading: channelsLoading } = trpc.referral.adminGetChannelBreakdown.useQuery({ days });
  const { data: funnel, isLoading: funnelLoading } = trpc.referral.adminGetFunnel.useQuery({ days });
  const { data: topReferrers, isLoading: topLoading } = trpc.referral.adminGetTopReferrers.useQuery({ limit: 10 });

  const trendData = useMemo(
    () =>
      (trend ?? []).map((d) => ({
        ...d,
        label: d.date.slice(5),
      })),
    [trend],
  );

  const channelData = useMemo(
    () =>
      (channels ?? []).map((c, i) => ({
        ...c,
        name: CHANNEL_LABELS[c.channel] ?? c.channel,
        fill: CHANNEL_PALETTE[i % CHANNEL_PALETTE.length],
      })),
    [channels],
  );

  const funnelStages = useMemo(
    () => (funnel?.funnel ?? []).map((s, i) => ({ ...s, fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length] })),
    [funnel],
  );

  const topData = useMemo(
    () =>
      (topReferrers ?? []).map((r, i) => ({
        name: r.user.nickname || r.user.username,
        referralCount: r.referralCount,
        totalPoints: r.totalPoints,
        fill: CHANNEL_PALETTE[i % CHANNEL_PALETTE.length],
      })),
    [topReferrers],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          推广数据洞察
        </h2>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 14 | 30 | 90)}>
          <TabsList className="h-8">
            {RANGE_OPTIONS.map((o) => (
              <TabsTrigger key={o.value} value={String(o.value)} className="text-xs px-2.5 h-6">
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title={`每日推广趋势 · 近 ${days} 天`}
            icon={TrendingUp}
            loading={trendLoading}
            empty={trendData.length === 0}
          >
            <ChartContainer config={trendConfig} className="h-[280px] w-full">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="ref-fill-amount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-paymentAmount)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-paymentAmount)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(v)}
                  width={36}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => "$" + formatCompact(v)}
                  width={48}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  yAxisId="left"
                  dataKey="uniqueClicks"
                  fill="var(--color-uniqueClicks)"
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                />
                <Bar
                  yAxisId="left"
                  dataKey="registers"
                  fill="var(--color-registers)"
                  radius={[3, 3, 0, 0]}
                  barSize={8}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="paymentCount"
                  stroke="var(--color-paymentCount)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="paymentAmount"
                  stroke="var(--color-paymentAmount)"
                  fill="url(#ref-fill-amount)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          </ChartCard>
        </div>

        <ChartCard
          title="推广转化漏斗"
          icon={Target}
          loading={funnelLoading}
          empty={!funnel || funnelStages.every((s) => s.value === 0)}
          description={`近 ${days} 天`}
          footer={
            funnel && (
              <div className="grid grid-cols-3 gap-1 tabular-nums">
                <div>
                  <div className="text-muted-foreground text-[10px]">独立率</div>
                  <div className="font-medium">{funnel.rates.uniqueRate}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">注册率</div>
                  <div className="font-medium">{funnel.rates.registerRate}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px]">付费率</div>
                  <div className="font-medium text-emerald-500">{funnel.rates.paymentRate}%</div>
                </div>
              </div>
            )
          }
        >
          <div className="h-[230px] flex items-center">
            <ConversionFunnel data={funnelStages} className="w-full" format={formatCompact} />
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="渠道贡献"
          icon={Layers}
          loading={channelsLoading}
          empty={channelData.length === 0}
          description="按独立访客排序"
        >
          <ChartContainer config={channelConfig} className="h-[280px] w-full">
            <BarChart data={channelData} layout="vertical" margin={{ left: 0, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={70}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof channelData)[number];
                  return (
                    <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md tabular-nums space-y-0.5">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted-foreground">独立 {p.uniqueClicks.toLocaleString()}</div>
                      <div className="text-muted-foreground">注册 {p.registers.toLocaleString()}</div>
                      <div className="text-muted-foreground">
                        付费 {p.paymentCount} 笔 · {formatUSDT(p.paymentAmount)}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="uniqueClicks" radius={[0, 4, 4, 0]} barSize={16}>
                {channelData.map((c) => (
                  <Cell key={c.channel} fill={c.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="Top 10 推广人"
          icon={Users}
          loading={topLoading}
          empty={topData.length === 0}
          description="按推广人数"
        >
          <ChartContainer config={channelConfig} className="h-[280px] w-full">
            <BarChart data={topData} layout="vertical" margin={{ left: 0, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={92}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof topData)[number];
                  return (
                    <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md tabular-nums">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted-foreground">
                        推广 {p.referralCount} 人 · 积分 {p.totalPoints.toLocaleString()}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="referralCount" radius={[0, 4, 4, 0]} barSize={14}>
                {topData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </div>
  );
}
