"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Volume2, Music } from "lucide-react";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";
import { effectsTabSchema, pickEffectsValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabEffects({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: effectsTabSchema,
    pickValues: pickEffectsValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>视觉效果</CardTitle>
            <CardDescription>配置全站粒子动画和音效默认设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="effectEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用粒子效果</FormLabel>
                    <FormDescription>全站显示粒子动画背景</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>效果类型</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择粒子效果" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sakura">🌸 樱花飘落</SelectItem>
                      <SelectItem value="firefly">✨ 萤火虫</SelectItem>
                      <SelectItem value="snow">❄️ 雪花飘落</SelectItem>
                      <SelectItem value="stars">⭐ 星空闪烁</SelectItem>
                      <SelectItem value="aurora">🌌 极光</SelectItem>
                      <SelectItem value="cyber">💠 赛博雨</SelectItem>
                      <SelectItem value="none">关闭</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectDensity"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>粒子密度</FormLabel>
                    <span className="text-sm text-muted-foreground">{field.value}</span>
                  </div>
                  <FormControl>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </FormControl>
                  <FormDescription>数值越大粒子越多（移动端自动减半）</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectSpeed"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>速度倍率</FormLabel>
                    <span className="text-sm text-muted-foreground">{field.value.toFixed(1)}x</span>
                  </div>
                  <FormControl>
                    <input
                      type="range"
                      min={0.1}
                      max={3.0}
                      step={0.1}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </FormControl>
                  <FormDescription>控制粒子运动速度</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectOpacity"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>透明度</FormLabel>
                    <span className="text-sm text-muted-foreground">{Math.round(field.value * 100)}%</span>
                  </div>
                  <FormControl>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </FormControl>
                  <FormDescription>粒子的整体透明度</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>自定义颜色</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="留空使用预设颜色，如 #ff69b4" />
                  </FormControl>
                  <FormDescription>输入十六进制颜色值覆盖默认配色</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Volume2 className="h-4 w-4" />
                音效设置
              </h3>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="soundDefaultEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>新用户默认开启音效</FormLabel>
                        <FormDescription>首次访问的用户是否自动启用 UI 音效</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    <h4 className="text-sm font-medium">进站音效</h4>
                  </div>
                  <FormField
                    control={form.control}
                    name="entrySoundUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>音效文件</FormLabel>
                        <FormControl>
                          <UrlOrUploadInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            accept="audio/*"
                            placeholder="https://example.com/entry-sound.mp3"
                          />
                        </FormControl>
                        <FormDescription>
                          用户进入网站时播放的音效，留空则不播放。支持 MP3、WAV、OGG 等格式
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="entrySoundVolume"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>音效音量</FormLabel>
                          <span className="text-sm text-muted-foreground">{Math.round(field.value * 100)}%</span>
                        </div>
                        <FormControl>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </FormControl>
                        <FormDescription>进站音效的播放音量</FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="entrySoundMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>播放模式</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择播放模式" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="session">每次会话播放一次</SelectItem>
                            <SelectItem value="once">永久只播放一次</SelectItem>
                            <SelectItem value="interval">定时过期重新播放</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {field.value === "session"
                            ? "关闭浏览器后下次访问会再次播放"
                            : field.value === "once"
                              ? "每个用户只会听到一次，不再重复"
                              : "超过设定时间后再次进站会重新播放"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("entrySoundMode") === "interval" && (
                    <FormField
                      control={form.control}
                      name="entrySoundIntervalHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>过期时长（小时）</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={8760}
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>上次播放后经过多少小时再次播放（1-8760，即最长约 1 年）</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
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
