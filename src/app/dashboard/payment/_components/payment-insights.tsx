"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Clock, Package as PackageIcon, PieChart as PieIcon } from "lucide-react";
import { ChartCard } from "../../_components/charts/chart-card";
import { formatCompact, formatUSDT } from "../../_components/charts/utils";

const RANGE_OPTIONS = [
  { value: 7, label: "7天" },
  { value: 14, label: "14天" },
  { value: 30, label: "30天" },
  { value: 90, label: "90天" },
] as const;

const revenueConfig = {
  revenue: { label: "收入", color: "hsl(160, 80%, 45%)" },
  orders: { label: "订单数", color: "hsl(217, 91%, 60%)" },
} satisfies ChartConfig;

const hourlyConfig = {
  orders: { label: "下单", color: "hsl(217, 91%, 60%)" },
  paid: { label: "付款", color: "hsl(160, 80%, 45%)" },
  rate: { label: "成交率", color: "hsl(38, 92%, 50%)" },
} satisfies ChartConfig;

const statusConfig = {
  count: { label: "订单" },
  PENDING: { label: "待支付", color: "hsl(48, 96%, 53%)" },
  PAID: { label: "已支付", color: "hsl(160, 80%, 45%)" },
  EXPIRED: { label: "已过期", color: "hsl(0, 0%, 60%)" },
  CANCELLED: { label: "已取消", color: "hsl(0, 84%, 60%)" },
} satisfies ChartConfig;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已支付",
  EXPIRED: "已过期",
  CANCELLED: "已取消",
};

const PACKAGE_PALETTE = [
  "hsl(160, 80%, 45%)",
  "hsl(217, 91%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(263, 70%, 55%)",
  "hsl(0, 84%, 60%)",
  "hsl(187, 85%, 53%)",
  "hsl(289, 75%, 55%)",
  "hsl(330, 80%, 60%)",
];

export function PaymentInsights() {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(30);

  const { data: trend, isLoading: trendLoading } = trpc.payment.adminGetRevenueTrend.useQuery({ days });
  const { data: packages, isLoading: pkgLoading } = trpc.payment.adminGetPackageDistribution.useQuery();
  const { data: status, isLoading: statusLoading } = trpc.payment.adminGetStatusBreakdown.useQuery();
  const { data: hourly, isLoading: hourlyLoading } = trpc.payment.adminGetHourlyPattern.useQuery({ days });

  const trendData = useMemo(() => (trend ?? []).map((d) => ({ ...d, label: d.date.slice(5) })), [trend]);

  const pkgData = useMemo(
    () =>
      (packages ?? []).map((p, i) => ({
        ...p,
        fill: PACKAGE_PALETTE[i % PACKAGE_PALETTE.length],
      })),
    [packages],
  );

  const statusData = useMemo(
    () =>
      (status ?? []).map((s) => ({
        name: STATUS_LABEL[s.status] ?? s.status,
        status: s.status,
        count: s.count,
        amount: s.amount,
        fill: `var(--color-${s.status})`,
      })),
    [status],
  );

  const totalRevenue = trendData.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = trendData.reduce((s, d) => s + d.orders, 0);
  const avgOrderAmount = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const peakDay = trendData.reduce<{ date: string; revenue: number }>(
    (max, d) => (d.revenue > max.revenue ? { date: d.date, revenue: d.revenue } : max),
    { date: "", revenue: 0 },
  );

  const peakHour = (hourly ?? []).reduce<{ hour: number; orders: number }>(
    (max, h) => (h.orders > max.orders ? { hour: h.hour, orders: h.orders } : max),
    { hour: 0, orders: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">数据洞察</h2>
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
            title={`收入趋势 · 近 ${days} 天`}
            icon={DollarSign}
            loading={trendLoading}
            empty={trendData.length === 0 || totalRevenue === 0}
            footer={
              <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                <span>
                  合计 <span className="text-emerald-500 font-medium">{formatUSDT(totalRevenue)}</span>
                </span>
                <span>
                  订单 <span className="font-medium">{totalOrders}</span>
                </span>
                <span>
                  客单价 <span className="font-medium">{formatUSDT(avgOrderAmount)}</span>
                </span>
                {peakDay.date && (
                  <span>
                    峰值 <span className="font-medium">{peakDay.date.slice(5)}</span> ·{" "}
                    <span className="text-emerald-500">{formatUSDT(peakDay.revenue)}</span>
                  </span>
                )}
              </div>
            }
          >
            <ChartContainer config={revenueConfig} className="h-[260px] w-full">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="pay-fill-revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => "$" + formatCompact(v)}
                  width={50}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(v)}
                  width={32}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="url(#pay-fill-revenue)"
                  strokeWidth={2}
                  dot={false}
                />
                <Bar yAxisId="right" dataKey="orders" fill="var(--color-orders)" radius={[3, 3, 0, 0]} barSize={10} />
              </ComposedChart>
            </ChartContainer>
          </ChartCard>
        </div>

        <ChartCard
          title="订单状态分布"
          icon={PieIcon}
          loading={statusLoading}
          empty={statusData.length === 0}
          footer={
            <div className="space-y-1">
              {statusData.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-[11px] tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.fill }} />
                    <span>{s.name}</span>
                  </div>
                  <span className="font-medium">
                    {s.count} 单
                    {s.status === "PAID" && (
                      <span className="text-muted-foreground ml-1.5">· {formatUSDT(s.amount)}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          }
        >
          <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[220px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                strokeWidth={2}
                stroke="hsl(var(--background))"
              />
            </PieChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="套餐销售排行"
          icon={PackageIcon}
          loading={pkgLoading}
          empty={pkgData.length === 0}
          description="按收入降序"
        >
          <ChartContainer config={revenueConfig} className="h-[260px] w-full">
            <BarChart data={pkgData} layout="vertical" margin={{ left: 0, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => "$" + formatCompact(v)} />
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
                  const p = payload[0].payload as (typeof pkgData)[number];
                  return (
                    <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md tabular-nums">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted-foreground">
                        收入 {formatUSDT(p.revenue)} · {p.orders} 单
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
                {pkgData.map((p) => (
                  <Cell key={p.id} fill={p.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="24 小时下单/付款时段"
          icon={Clock}
          loading={hourlyLoading}
          empty={!hourly || hourly.every((h) => h.orders === 0)}
          description={`近 ${days} 天 · 按本地小时聚合`}
          footer={
            peakHour.orders > 0 && (
              <span className="tabular-nums">
                高峰时段{" "}
                <span className="font-medium text-foreground">{String(peakHour.hour).padStart(2, "0")}:00</span> ·{" "}
                {peakHour.orders} 单
              </span>
            )
          }
        >
          <ChartContainer config={hourlyConfig} className="h-[260px] w-full">
            <ComposedChart data={hourly ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => String(v).padStart(2, "0")}
                interval={2}
              />
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
                tickFormatter={(v) => v + "%"}
                width={36}
                domain={[0, 100]}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="left" dataKey="orders" fill="var(--color-orders)" radius={[3, 3, 0, 0]} barSize={8} />
              <Bar yAxisId="left" dataKey="paid" fill="var(--color-paid)" radius={[3, 3, 0, 0]} barSize={8} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rate"
                stroke="var(--color-rate)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </div>
  );
}
