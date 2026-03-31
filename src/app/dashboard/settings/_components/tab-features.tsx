"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { featuresTabSchema, pickFeaturesValues, type FeaturesTabValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

const SORT_SECTIONS = [
  {
    optionsName: "videoSortOptions" as const,
    defaultName: "videoDefaultSort" as const,
    label: "视频分区",
  },
  {
    optionsName: "gameSortOptions" as const,
    defaultName: "gameDefaultSort" as const,
    label: "游戏分区",
  },
  {
    optionsName: "imageSortOptions" as const,
    defaultName: "imageDefaultSort" as const,
    label: "图片分区",
  },
] as const;

const ALL_SORT_OPTIONS = [
  { id: "latest", label: "最新" },
  { id: "views", label: "热门" },
  { id: "likes", label: "高赞" },
  { id: "titleAsc", label: "标题 A→Z" },
  { id: "titleDesc", label: "标题 Z→A" },
] as const;

export function TabFeatures({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: featuresTabSchema,
    pickValues: pickFeaturesValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>功能开关</CardTitle>
            <CardDescription>控制网站各项功能的开启/关闭</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="allowRegistration"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>允许注册</FormLabel>
                    <FormDescription>关闭后新用户将无法注册</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireEmailVerify"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>注册邮箱验证</FormLabel>
                    <FormDescription>注册时需要验证邮箱</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowUpload"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>允许上传</FormLabel>
                    <FormDescription>关闭后用户将无法上传视频</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowComment"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>允许评论</FormLabel>
                    <FormDescription>关闭后用户将无法发表评论</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireLoginToComment"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>评论需要登录</FormLabel>
                    <FormDescription>开启后只有登录用户才能发表评论，关闭则允许匿名评论</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              保存设置
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>内容分区</CardTitle>
            <CardDescription>控制各内容分区的显示，关闭后侧边栏和页面将隐藏对应分区</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="sectionVideoEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>视频分区</FormLabel>
                    <FormDescription>关闭后视频分区将不可见，已有视频仍会保留</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sectionImageEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>图片分区</FormLabel>
                    <FormDescription>关闭后图片分区将不可见，已有图片仍会保留</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sectionGameEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>游戏分区</FormLabel>
                    <FormDescription>关闭后游戏分区将不可见，已有游戏仍会保留</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              保存设置
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>排序选项</CardTitle>
            <CardDescription>配置各分区列表页可用的排序方式及默认排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {SORT_SECTIONS.map((section) => (
              <div key={section.optionsName} className="space-y-2">
                <FormField
                  control={form.control}
                  name={section.optionsName}
                  render={({ field }) => {
                    const selected = new Set(
                      field.value
                        .split(",")
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                    );
                    const toggle = (id: string) => {
                      const next = new Set(selected);
                      if (next.has(id)) {
                        if (next.size > 1) next.delete(id);
                      } else {
                        next.add(id);
                      }
                      const newValue = ALL_SORT_OPTIONS.map((o) => o.id)
                        .filter((k) => next.has(k))
                        .join(",");
                      field.onChange(newValue);
                      const currentDefault = form.getValues(section.defaultName);
                      if (!next.has(currentDefault)) {
                        const firstRemaining = ALL_SORT_OPTIONS.map((o) => o.id).find((k) => next.has(k));
                        if (firstRemaining) {
                          form.setValue(
                            section.defaultName,
                            firstRemaining as FeaturesTabValues[typeof section.defaultName],
                            { shouldDirty: true },
                          );
                        }
                      }
                    };
                    return (
                      <FormItem>
                        <FormLabel>{section.label}</FormLabel>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {ALL_SORT_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggle(opt.id)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                                selected.has(opt.id)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name={section.defaultName}
                  render={({ field }) => {
                    const enabledKeys = form
                      .watch(section.optionsName)
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean);
                    const enabledOptions = ALL_SORT_OPTIONS.filter((o) => enabledKeys.includes(o.id));
                    return (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel className="text-xs text-muted-foreground whitespace-nowrap">默认排序</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {enabledOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            ))}
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              保存设置
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>USDT 支付</CardTitle>
            <CardDescription>配置 TRC20 USDT 自助充值功能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="usdtPaymentEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用 USDT 支付</FormLabel>
                    <FormDescription>开启后用户可以使用 TRC20 USDT 充值积分</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="usdtWalletAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TRC20 收款钱包地址</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="T..." />
                  </FormControl>
                  <FormDescription>用于接收 USDT 支付的 Tron 钱包地址</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="usdtPointsPerUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>积分汇率（1 USDT）</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>自定义金额充值时 1 USDT 兑换多少积分</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usdtOrderTimeoutMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>订单超时（分钟）</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={5}
                        max={1440}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 30)}
                      />
                    </FormControl>
                    <FormDescription>未支付订单自动过期的时间</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="usdtMinAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最低充值金额（USDT）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="不限"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usdtMaxAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最高充值金额（USDT）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="不限"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              保存设置
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
