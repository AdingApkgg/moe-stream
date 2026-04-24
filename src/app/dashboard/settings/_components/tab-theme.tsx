"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Loader2, Save } from "lucide-react";
import { pickThemeValues, themeTabSchema } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";
import { ThemePreviewPanel } from "./theme-preview-panel";

export function TabTheme({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: themeTabSchema,
    pickValues: pickThemeValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">主题色</CardTitle>
                <CardDescription>选择全站主色调，影响按钮、链接、高亮等所有主色元素</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="themeHue"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-6 w-6 rounded-full border shadow-sm"
                            style={{ background: `oklch(0.6 0.24 ${field.value})` }}
                          />
                          <span className="text-sm font-medium">{field.value}°</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => field.onChange(350)}
                        >
                          重置
                        </Button>
                      </div>
                      <FormControl>
                        <div
                          className="relative h-3 cursor-pointer rounded-full"
                          style={{
                            background:
                              "linear-gradient(to right, oklch(0.6 0.24 0), oklch(0.6 0.24 30), oklch(0.6 0.24 60), oklch(0.6 0.24 90), oklch(0.6 0.24 120), oklch(0.6 0.24 150), oklch(0.6 0.24 180), oklch(0.6 0.24 210), oklch(0.6 0.24 240), oklch(0.6 0.24 270), oklch(0.6 0.24 300), oklch(0.6 0.24 330), oklch(0.6 0.24 360))",
                          }}
                        >
                          <input
                            type="range"
                            min={0}
                            max={360}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                          <div
                            className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                            style={{
                              left: `calc(${(field.value / 360) * 100}% - 10px)`,
                              background: `oklch(0.6 0.24 ${field.value})`,
                            }}
                          />
                        </div>
                      </FormControl>
                      <div className="flex flex-wrap gap-1.5 pt-3">
                        {(
                          [
                            { hue: 0, label: "红" },
                            { hue: 25, label: "橙" },
                            { hue: 60, label: "黄" },
                            { hue: 145, label: "绿" },
                            { hue: 200, label: "蓝" },
                            { hue: 270, label: "紫" },
                            { hue: 285, label: "经典紫" },
                            { hue: 350, label: "默认" },
                          ] as const
                        ).map(({ hue, label }) => (
                          <button
                            key={hue}
                            type="button"
                            onClick={() => field.onChange(hue)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                              field.value === hue
                                ? "border-foreground/30 bg-foreground/5 font-medium"
                                : "border-transparent hover:border-border hover:bg-muted/50",
                            )}
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ background: `oklch(0.6 0.24 ${hue})` }}
                            />
                            {label}
                          </button>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">色温</CardTitle>
                  <CardDescription>调节背景和中性面的冷暖色调</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="themeColorTemp"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {field.value === 0
                              ? "中性"
                              : field.value > 0
                                ? `偏暖 +${field.value}`
                                : `偏冷 ${field.value}`}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => field.onChange(0)}
                          >
                            重置
                          </Button>
                        </div>
                        <FormControl>
                          <div
                            className="relative h-3 cursor-pointer rounded-full"
                            style={{
                              background:
                                "linear-gradient(to right, oklch(0.7 0.12 220), oklch(0.92 0.005 0), oklch(0.75 0.12 50))",
                            }}
                          >
                            <input
                              type="range"
                              min={-100}
                              max={100}
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                            <div
                              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white bg-background shadow-md"
                              style={{
                                left: `calc(${((field.value + 100) / 200) * 100}% - 10px)`,
                              }}
                            />
                          </div>
                        </FormControl>
                        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                          <span>冷色调</span>
                          <span>中性</span>
                          <span>暖色调</span>
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">圆角</CardTitle>
                  <CardDescription>控制按钮、卡片等组件圆角大小</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="themeBorderRadius"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">{field.value.toFixed(2)} rem</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => field.onChange(0.625)}
                          >
                            重置
                          </Button>
                        </div>
                        <FormControl>
                          <input
                            type="range"
                            min={0}
                            max={2}
                            step={0.05}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="h-1.5 w-full accent-primary"
                          />
                        </FormControl>
                        <div className="flex items-center gap-2 pt-3">
                          {(
                            [
                              { v: 0, label: "直角" },
                              { v: 0.375, label: "小" },
                              { v: 0.625, label: "默认" },
                              { v: 1.0, label: "大" },
                              { v: 1.5, label: "超大" },
                            ] as const
                          ).map(({ v, label }) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => field.onChange(v)}
                              className={cn(
                                "h-8 flex-1 border text-[10px] transition-all",
                                Math.abs(field.value - v) < 0.01
                                  ? "border-primary bg-primary/10 font-medium text-primary"
                                  : "border-border hover:border-primary/50",
                              )}
                              style={{ borderRadius: `${v}rem` }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">玻璃态透明度</CardTitle>
                  <CardDescription>毛玻璃效果背景的通透程度</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="themeGlassOpacity"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">{Math.round(field.value * 100)}%</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => field.onChange(0.7)}
                          >
                            重置
                          </Button>
                        </div>
                        <FormControl>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="h-1.5 w-full accent-primary"
                          />
                        </FormControl>
                        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                          <span>全透明</span>
                          <span>半透明</span>
                          <span>不透明</span>
                        </div>
                        <div
                          className="relative mt-3 h-16 overflow-hidden rounded-lg"
                          style={{
                            background: `linear-gradient(135deg, oklch(0.6 0.24 ${form.watch("themeHue")}), oklch(0.5 0.2 ${(form.watch("themeHue") + 45) % 360}))`,
                          }}
                        >
                          <div
                            className="absolute inset-2 flex items-center justify-center rounded-md text-xs text-foreground"
                            style={{
                              background: `oklch(1 0 0 / ${Math.round(field.value * 100)}%)`,
                              backdropFilter: "blur(12px)",
                              WebkitBackdropFilter: "blur(12px)",
                            }}
                          >
                            玻璃态预览
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">动画</CardTitle>
                  <CardDescription>控制全站界面过渡与关键帧动画</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="themeAnimations"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">启用界面动画</FormLabel>
                            <FormDescription className="text-xs">关闭后禁用所有过渡和关键帧动画</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <div className={cn("h-3 w-3 rounded-full bg-primary", field.value && "animate-pulse")} />
                          <span>
                            {field.value
                              ? "动画已启用 — 界面元素将展示过渡效果"
                              : "动画已禁用 — 所有过渡和动画将被移除"}
                          </span>
                        </div>
                      </FormItem>
                    )}
                  />

                  {form.watch("themeAnimations") && (
                    <>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <FormLabel className="text-sm">动画预设</FormLabel>
                          <FormDescription className="text-xs">一键切换动画风格强度</FormDescription>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              {
                                value: "minimal" as const,
                                label: "精简",
                                desc: "轻柔微妙",
                                speed: 1.5,
                                toggles: {
                                  pageTransition: true,
                                  stagger: false,
                                  hover: true,
                                  dialog: true,
                                  tab: false,
                                },
                              },
                              {
                                value: "standard" as const,
                                label: "标准",
                                desc: "平衡流畅",
                                speed: 1.0,
                                toggles: {
                                  pageTransition: true,
                                  stagger: true,
                                  hover: true,
                                  dialog: true,
                                  tab: true,
                                },
                              },
                              {
                                value: "rich" as const,
                                label: "丰富",
                                desc: "华丽饱满",
                                speed: 0.8,
                                toggles: {
                                  pageTransition: true,
                                  stagger: true,
                                  hover: true,
                                  dialog: true,
                                  tab: true,
                                },
                              },
                            ] as const
                          ).map(({ value, label, desc, speed, toggles }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                form.setValue("animationPreset", value, { shouldDirty: true });
                                form.setValue("animationSpeed", speed, { shouldDirty: true });
                                form.setValue("animationPageTransition", toggles.pageTransition, {
                                  shouldDirty: true,
                                });
                                form.setValue("animationStagger", toggles.stagger, { shouldDirty: true });
                                form.setValue("animationHover", toggles.hover, { shouldDirty: true });
                                form.setValue("animationDialog", toggles.dialog, { shouldDirty: true });
                                form.setValue("animationTab", toggles.tab, { shouldDirty: true });
                              }}
                              className={cn(
                                "relative overflow-hidden rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                                form.watch("animationPreset") === value
                                  ? "border-primary ring-1 ring-primary/30"
                                  : "border-border hover:border-primary/40",
                              )}
                            >
                              <div className="text-sm font-medium">{label}</div>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">{desc}</p>
                              <div className="mt-2 flex gap-1">
                                {[...Array(value === "minimal" ? 1 : value === "standard" ? 2 : 3)].map((_, i) => (
                                  <div
                                    key={i}
                                    className="h-1 w-3 rounded-full bg-primary/60"
                                    style={{
                                      animation:
                                        form.watch("animationPreset") === value
                                          ? `pulse ${1.5 - i * 0.3}s ease-in-out infinite`
                                          : "none",
                                    }}
                                  />
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="animationSpeed"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel className="text-sm">速度倍率</FormLabel>
                              <span className="text-sm text-muted-foreground">{field.value.toFixed(1)}x</span>
                            </div>
                            <FormControl>
                              <input
                                type="range"
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                value={field.value}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                className="w-full accent-primary"
                              />
                            </FormControl>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>0.5x 慢</span>
                              <span>1.0x 正常</span>
                              <span>2.0x 快</span>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <FormLabel className="text-sm">分类控制</FormLabel>
                          <FormDescription className="text-xs">独立控制各类动画的开关</FormDescription>
                        </div>
                        <div className="space-y-2">
                          {(
                            [
                              {
                                name: "animationPageTransition" as const,
                                label: "页面过渡",
                                desc: "页面加载时的渐入滑动效果",
                              },
                              {
                                name: "animationStagger" as const,
                                label: "列表交错",
                                desc: "卡片网格依次出现的动画",
                              },
                              {
                                name: "animationHover" as const,
                                label: "悬停效果",
                                desc: "鼠标悬停时的缩放和位移",
                              },
                              {
                                name: "animationDialog" as const,
                                label: "弹窗动画",
                                desc: "对话框和侧栏的进出动效",
                              },
                              {
                                name: "animationTab" as const,
                                label: "标签切换",
                                desc: "Tab 内容区域的切换过渡",
                              },
                            ] as const
                          ).map(({ name, label, desc }) => (
                            <FormField
                              key={name}
                              control={form.control}
                              name={name}
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-xs font-medium">{label}</FormLabel>
                                    <FormDescription className="text-[10px]">{desc}</FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      className="scale-90"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">预设主题</CardTitle>
                <CardDescription>一键应用预设的配色方案</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      { label: "默认粉", hue: 350, temp: 0, radius: 0.625, desc: "清新萌系粉" },
                      { label: "经典紫", hue: 285, temp: 0, radius: 0.625, desc: "经典 ACGN 紫" },
                      { label: "海洋蓝", hue: 210, temp: -30, radius: 0.75, desc: "冷色调科技感" },
                      { label: "樱花粉", hue: 340, temp: 20, radius: 1.0, desc: "温暖少女风" },
                      { label: "森林绿", hue: 145, temp: 15, radius: 0.5, desc: "自然清新感" },
                      { label: "极光紫", hue: 270, temp: -15, radius: 0.875, desc: "梦幻冷紫" },
                      { label: "琥珀橙", hue: 30, temp: 50, radius: 0.625, desc: "活力暖色调" },
                      { label: "赛博青", hue: 185, temp: -40, radius: 0.25, desc: "赛博朋克风" },
                      { label: "薰衣草", hue: 295, temp: 10, radius: 1.25, desc: "优雅柔和紫" },
                    ] as const
                  ).map(({ label, hue, temp, radius, desc }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        form.setValue("themeHue", hue, { shouldDirty: true });
                        form.setValue("themeColorTemp", temp, { shouldDirty: true });
                        form.setValue("themeBorderRadius", radius, { shouldDirty: true });
                      }}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                        form.watch("themeHue") === hue && form.watch("themeColorTemp") === temp
                          ? "border-primary ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <div
                          className="h-4 w-4 shrink-0 rounded-full"
                          style={{ background: `oklch(0.6 0.24 ${hue})` }}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <p className="text-[10px] leading-tight text-muted-foreground">{desc}</p>
                      <div
                        className="absolute top-0 right-0 h-full w-1"
                        style={{ background: `oklch(0.6 0.24 ${hue})` }}
                      />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                保存设置
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.setValue("themeHue", 350, { shouldDirty: true });
                  form.setValue("themeColorTemp", 0, { shouldDirty: true });
                  form.setValue("themeBorderRadius", 0.625, { shouldDirty: true });
                  form.setValue("themeGlassOpacity", 0.7, { shouldDirty: true });
                  form.setValue("themeAnimations", true, { shouldDirty: true });
                  form.setValue("animationSpeed", 1.0, { shouldDirty: true });
                  form.setValue("animationPageTransition", true, { shouldDirty: true });
                  form.setValue("animationStagger", true, { shouldDirty: true });
                  form.setValue("animationHover", true, { shouldDirty: true });
                  form.setValue("animationDialog", true, { shouldDirty: true });
                  form.setValue("animationTab", true, { shouldDirty: true });
                  form.setValue("animationPreset", "standard", { shouldDirty: true });
                }}
              >
                全部重置为默认
              </Button>
            </div>
          </div>

          <div className="xl:col-span-1">
            <ThemePreviewPanel
              hue={form.watch("themeHue")}
              colorTemp={form.watch("themeColorTemp")}
              borderRadius={form.watch("themeBorderRadius")}
              glassOpacity={form.watch("themeGlassOpacity")}
              animations={form.watch("themeAnimations")}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
