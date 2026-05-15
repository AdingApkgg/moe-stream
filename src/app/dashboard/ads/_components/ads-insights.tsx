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
import { Eye, MousePointerClick, BarChart3, TrendingUp } from "lucide-react";
import type { Ad } from "@/lib/ads";
import { ChartCard } from "../../_components/charts/chart-card";
import { formatCompact, formatPercent } from "../../_components/charts/utils";

const RANGE_OPTIONS = [
  { value: 7, label: "7天" },
  { value: 14, label: "14天" },
  { value: 30, label: "30天" },
  { value: 90, label: "90天" },
] as const;

const trendConfig = {
  impressions: { label: "曝光", color: "hsl(217, 91%, 60%)" },
  clicks: { label: "点击", color: "hsl(38, 92%, 50%)" },
  ctr: { label: "CTR %", color: "hsl(160, 80%, 45%)" },
} satisfies ChartConfig;

const topConfig = {
  impressions: { label: "曝光", color: "hsl(217, 91%, 60%)" },
  clicks: { label: "点击", color: "hsl(38, 92%, 50%)" },
  ctr: { label: "CTR %", color: "hsl(160, 80%, 45%)" },
} satisfies ChartConfig;

const PALETTE = [
  "hsl(217, 91%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(160, 80%, 45%)",
  "hsl(263, 70%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(187, 85%, 53%)",
  "hsl(289, 75%, 55%)",
  "hsl(330, 80%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(48, 96%, 53%)",
];

export function AdsInsights({ ads }: { ads: Ad[] }) {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30);
  const [sortBy, setSortBy] = useState<"impressions" | "clicks" | "ctr">("impressions");

  const { data: trend, isLoading: trendLoading } = trpc.admin.ads.getDailyTrend.useQuery({ days });
  const { data: topAds, isLoading: topLoading } = trpc.admin.ads.getTopAds.useQuery({
    days,
    by: sortBy,
    limit: 10,
  });

  const trendData = useMemo(() => (trend ?? []).map((d) => ({ ...d, label: d.date.slice(5) })), [trend]);

  const adTitleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ad of ads) map[ad.id] = ad.title || ad.id;
    return map;
  }, [ads]);

  const topData = useMemo(
    () =>
      (topAds ?? []).map((a, i) => ({
        ...a,
        name: adTitleMap[a.adId] || `广告 ${a.adId.slice(0, 6)}`,
        fill: PALETTE[i % PALETTE.length],
      })),
    [topAds, adTitleMap],
  );

  const totalImpressions = trendData.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = trendData.reduce((s, d) => s + d.clicks, 0);
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const peak = trendData.reduce<{ date: string; impressions: number }>(
    (m, d) => (d.impressions > m.impressions ? { date: d.date, impressions: d.impressions } : m),
    { date: "", impressions: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          广告数据洞察
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

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiTile
          icon={Eye}
          label="总曝光"
          value={formatCompact(totalImpressions)}
          color="hsl(217, 91%, 60%)"
          loading={trendLoading}
        />
        <KpiTile
          icon={MousePointerClick}
          label="总点击"
          value={formatCompact(totalClicks)}
          color="hsl(38, 92%, 50%)"
          loading={trendLoading}
        />
        <KpiTile
          icon={TrendingUp}
          label="综合 CTR"
          value={formatPercent(overallCtr)}
          color="hsl(160, 80%, 45%)"
          loading={trendLoading}
        />
        <KpiTile
          icon={BarChart3}
          label="曝光峰值"
          value={peak.date ? `${peak.date.slice(5)} · ${formatCompact(peak.impressions)}` : "—"}
          color="hsl(263, 70%, 55%)"
          loading={trendLoading}
          small
        />
      </div>

      <ChartCard
        title={`曝光 / 点击 / CTR 趋势 · 近 ${days} 天`}
        icon={TrendingUp}
        loading={trendLoading}
        empty={trendData.length === 0 || totalImpressions === 0}
      >
        <ChartContainer config={trendConfig} className="h-[280px] w-full">
          <ComposedChart data={trendData}>
            <defs>
              <linearGradient id="ad-fill-impressions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-impressions)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-impressions)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompact(v)}
              width={42}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v + "%"}
              width={36}
              domain={[0, "auto"]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="impressions"
              stroke="var(--color-impressions)"
              fill="url(#ad-fill-impressions)"
              strokeWidth={2}
              dot={false}
            />
            <Bar yAxisId="left" dataKey="clicks" fill="var(--color-clicks)" radius={[3, 3, 0, 0]} barSize={10} />
            <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="var(--color-ctr)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title={`Top 10 广告（按${sortBy === "impressions" ? "曝光" : sortBy === "clicks" ? "点击" : "CTR"}）`}
        icon={BarChart3}
        loading={topLoading}
        empty={topData.length === 0}
        action={
          <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as "impressions" | "clicks" | "ctr")}>
            <TabsList className="h-7">
              <TabsTrigger value="impressions" className="text-[11px] px-2 h-5">
                曝光
              </TabsTrigger>
              <TabsTrigger value="clicks" className="text-[11px] px-2 h-5">
                点击
              </TabsTrigger>
              <TabsTrigger value="ctr" className="text-[11px] px-2 h-5">
                CTR
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <ChartContainer config={topConfig} className="h-[320px] w-full">
          <BarChart data={topData} layout="vertical" margin={{ left: 0, right: 12 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (sortBy === "ctr" ? v + "%" : formatCompact(v))}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={140}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => (typeof v === "string" && v.length > 14 ? v.slice(0, 14) + "…" : v)}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof topData)[number];
                return (
                  <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md tabular-nums space-y-0.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground">曝光 {formatCompact(p.impressions)}</div>
                    <div className="text-muted-foreground">点击 {formatCompact(p.clicks)}</div>
                    <div className="text-muted-foreground">CTR {p.ctr}%</div>
                  </div>
                );
              }}
            />
            <Bar dataKey={sortBy} radius={[0, 4, 4, 0]} barSize={16}>
              {topData.map((d) => (
                <Cell key={d.adId} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  color,
  loading,
  small,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  color: string;
  loading?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span>{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-20 rounded bg-muted animate-pulse" />
      ) : (
        <div
          className={small ? "text-base font-semibold tabular-nums" : "text-2xl font-bold tabular-nums leading-none"}
        >
          {value}
        </div>
      )}
    </div>
  );
}
