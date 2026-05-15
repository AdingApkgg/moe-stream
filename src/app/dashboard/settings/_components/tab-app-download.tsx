"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Apple, Smartphone, Monitor, Laptop } from "lucide-react";
import { useMemo } from "react";
import {
  appDownloadTabSchema,
  pickAppDownloadValues,
  APP_DOWNLOAD_PLATFORM_IDS,
  type AppDownloadPlatformId,
} from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

const PLATFORM_META: Record<AppDownloadPlatformId, { label: string; icon: React.ReactNode; urlField: string }> = {
  ios: { label: "iOS", icon: <Apple className="h-4 w-4" />, urlField: "appDownloadPopupUrlIos" },
  android: { label: "Android", icon: <Smartphone className="h-4 w-4" />, urlField: "appDownloadPopupUrlAndroid" },
  windows: { label: "Windows", icon: <Monitor className="h-4 w-4" />, urlField: "appDownloadPopupUrlWindows" },
  macos: { label: "macOS", icon: <Laptop className="h-4 w-4" />, urlField: "appDownloadPopupUrlMacos" },
};

export function TabAppDownload({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: appDownloadTabSchema,
    pickValues: pickAppDownloadValues,
    config,
  });

  const platformsCsv = form.watch("appDownloadPopupPlatforms") ?? "";
  const selectedPlatforms = useMemo(() => {
    return new Set(
      platformsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [platformsCsv]);

  const togglePlatform = (id: AppDownloadPlatformId, on: boolean) => {
    const next = new Set(selectedPlatforms);
    if (on) next.add(id);
    else next.delete(id);
    const ordered = APP_DOWNLOAD_PLATFORM_IDS.filter((p) => next.has(p));
    form.setValue("appDownloadPopupPlatforms", ordered.join(","), { shouldDirty: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>APP 下载推荐弹窗</CardTitle>
            <CardDescription>引导用户下载客户端 APP，可按设备平台定向展示</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="appDownloadPopupEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用下载弹窗</FormLabel>
                    <FormDescription>开启后，符合平台筛选条件的访客将看到推荐弹窗</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">展示平台</h4>
              <p className="mb-3 text-xs text-muted-foreground">
                勾选需要展示弹窗的设备系统平台。未勾选的平台访客不会看到弹窗。
              </p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {APP_DOWNLOAD_PLATFORM_IDS.map((id) => {
                  const meta = PLATFORM_META[id];
                  const checked = selectedPlatforms.has(id);
                  return (
                    <label
                      key={id}
                      className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {meta.icon}
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                      <Switch checked={checked} onCheckedChange={(v) => togglePlatform(id, v)} />
                    </label>
                  );
                })}
              </div>
              <FormField
                control={form.control}
                name="appDownloadPopupPlatforms"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <input type="hidden" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">下载链接</h4>
              <p className="mb-3 text-xs text-muted-foreground">
                按平台分别配置下载链接。弹窗会根据访客的设备系统自动选择对应链接，若该平台留空则使用兜底链接。
              </p>
              <div className="space-y-3">
                {APP_DOWNLOAD_PLATFORM_IDS.map((id) => {
                  const meta = PLATFORM_META[id];
                  return (
                    <FormField
                      key={id}
                      control={form.control}
                      name={meta.urlField as keyof import("../_lib/schema").AppDownloadTabValues}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm">
                            {meta.icon}
                            {meta.label} 下载链接
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={(field.value as string) || ""}
                              placeholder={`https://example.com/app-${id}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}

                <FormField
                  control={form.control}
                  name="appDownloadPopupUrlFallback"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>兜底链接</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={(field.value as string) || ""}
                          placeholder="https://example.com/download"
                        />
                      </FormControl>
                      <FormDescription>当用户的平台未配置专属链接时使用此链接</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">弹窗内容</h4>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="appDownloadPopupTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>标题</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="下载客户端 APP" />
                      </FormControl>
                      <FormDescription>留空则使用默认「下载客户端 APP」</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appDownloadPopupDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="原生体验更流畅，离线收藏一键访问..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="appDownloadPopupImage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>图标 / 图片 URL</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="https://..." />
                        </FormControl>
                        <FormDescription>可选，用于弹窗左侧展示</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="appDownloadPopupButtonText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>按钮文案</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="立即下载" />
                        </FormControl>
                        <FormDescription>留空则使用默认「立即下载」</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">展示控制</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="appDownloadPopupDelayMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>展示延迟（毫秒）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={60000}
                          step={100}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>进站后等待多久弹出，避免阻塞首屏</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appDownloadPopupCooldownHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>关闭冷却（小时）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={8760}
                          step={1}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>用户关闭后多久内不再弹出（0 = 每次刷新都弹）</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存设置
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
