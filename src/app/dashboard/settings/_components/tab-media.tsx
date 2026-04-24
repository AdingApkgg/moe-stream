"use client";

import { useFieldArray } from "react-hook-form";
import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { UPLOAD_IMAGE_TYPES, type UploadImageType } from "@/lib/image-compress-config";
import { THUMBNAIL_PRESET_META, THUMBNAIL_PRESET_NAMES } from "@/lib/thumbnail-presets";
import { ChevronDown, ImageIcon, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { mediaTabSchema, pickMediaValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

const TYPE_LABEL: Record<UploadImageType, string> = {
  avatar: "头像",
  cover: "视频封面图",
  misc: "通用图片",
  sticker: "贴图",
};

function newBypassRule() {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `rule-${Date.now()}`,
    name: "新规则",
    enabled: true,
    conditions: {
      mimeTypes: [] as string[],
      uploadTypes: [] as string[],
      maxFileSize: null as number | null,
    },
  };
}

export function TabMedia({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: mediaTabSchema,
    pickValues: pickMediaValues,
    config,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "imageCompressBypassRules",
  });

  const [openTypes, setOpenTypes] = useState<Record<UploadImageType, boolean>>({
    avatar: true,
    cover: false,
    misc: false,
    sticker: false,
  });

  const [openPresets, setOpenPresets] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (let i = 0; i < THUMBNAIL_PRESET_NAMES.length; i++) {
      init[THUMBNAIL_PRESET_NAMES[i]] = i === 0;
    }
    return init;
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              媒体处理
            </CardTitle>
            <CardDescription>配置用户上传图片压缩、列表缩略图代理与视频封面编码</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="imageCompressEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用图片压缩</FormLabel>
                    <FormDescription>
                      关闭后所有上传图片将原样保存（仍尊重下方绕过规则与客户端 noCompress）
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>缩略图与封面代理</CardTitle>
            <CardDescription>
              控制 <code className="text-xs bg-muted px-1 rounded">/api/cover/…?w=&amp;h=&amp;q=</code> 是否生成实时
              WebP 缩略图；影响视频列表、图片区、游戏卡片、排行榜等；与「上传压缩」无关
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="coverProxyThumbEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用列表缩略图代理</FormLabel>
                    <FormDescription>
                      开启时视频/图片/游戏列表会为外链资源请求带尺寸参数并在服务端缩放；关闭则仅走代理原图（体积更大）
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>前端缩略图档位</CardTitle>
            <CardDescription>
              统一前端所有列表 / 网格 / 侧栏缩略图的宽高与质量。原来散落在代码里的{" "}
              <code className="text-xs bg-muted px-1 rounded">imageProxy(url, {"{ w, q }"}</code>{" "}
              <code className="text-xs bg-muted px-1 rounded">)</code>
              硬编码全部来源于这里；调低一档可直接生效到对应区域。「强制缩略图」打开后，忽略上面的「列表缩略图代理」总开关
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {THUMBNAIL_PRESET_NAMES.map((presetKey) => (
              <Collapsible
                key={presetKey}
                open={openPresets[presetKey]}
                onOpenChange={(o) => setOpenPresets((s) => ({ ...s, [presetKey]: o }))}
                className="rounded-lg border"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
                  <span>
                    {THUMBNAIL_PRESET_META[presetKey].label}{" "}
                    <span className="text-muted-foreground font-normal">({presetKey})</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      openPresets[presetKey] ? "rotate-180" : ""
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t px-3 py-4 space-y-4">
                  <p className="text-xs text-muted-foreground">{THUMBNAIL_PRESET_META[presetKey].description}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`thumbnailPresets.${presetKey}.width`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>宽度 (px)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={16}
                              max={4096}
                              value={field.value}
                              onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 16)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`thumbnailPresets.${presetKey}.height`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>高度 (px)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={16}
                              max={4096}
                              value={field.value}
                              onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 16)}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px]">
                            与宽度相同时保持正方形；视频 16:9 / 排行 3:2 等由调用处按需覆盖
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name={`thumbnailPresets.${presetKey}.quality`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>质量 ({field.value})</FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={100}
                            step={1}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`thumbnailPresets.${presetKey}.forceThumb`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-2">
                        <div className="space-y-0.5">
                          <FormLabel className="!mt-0">强制缩略图</FormLabel>
                          <FormDescription className="text-[10px]">
                            打开后此档忽略「列表缩略图代理」开关，永远走 sharp 缩放
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>上传压缩配置</CardTitle>
            <CardDescription>按上传类型（表单 type 参数）分别设置输出格式、质量与最大边长</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {UPLOAD_IMAGE_TYPES.map((typeKey) => (
              <Collapsible
                key={typeKey}
                open={openTypes[typeKey]}
                onOpenChange={(o) => setOpenTypes((s) => ({ ...s, [typeKey]: o }))}
                className="rounded-lg border"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
                  <span>
                    {TYPE_LABEL[typeKey]} <span className="text-muted-foreground font-normal">({typeKey})</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openTypes[typeKey] ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t px-3 py-4 space-y-4">
                  <FormField
                    control={form.control}
                    name={`imageCompressProfiles.${typeKey}.enabled`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-2">
                        <FormLabel className="!mt-0">此类型启用压缩</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`imageCompressProfiles.${typeKey}.format`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>输出格式</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="webp">WebP</SelectItem>
                              <SelectItem value="avif">AVIF</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`imageCompressProfiles.${typeKey}.lossless`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border p-2">
                          <FormLabel className="!mt-0">无损</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name={`imageCompressProfiles.${typeKey}.quality`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>质量 ({field.value})</FormLabel>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={100}
                            step={1}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`imageCompressProfiles.${typeKey}.maxWidth`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>最大宽度 (px)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={16}
                              max={8192}
                              value={field.value}
                              onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 16)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`imageCompressProfiles.${typeKey}.maxHeight`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>最大高度 (px)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={16}
                              max={8192}
                              value={field.value}
                              onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 16)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>绕过规则</CardTitle>
            <CardDescription>
              对每条已启用的规则：仅当「所有已填写的条件」同时满足时跳过压缩（MIME
              列表、上传类型、文件大小上限至少填一类）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((f, index) => (
              <div key={f.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <FormField
                    control={form.control}
                    name={`imageCompressBypassRules.${index}.enabled`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">启用</FormLabel>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="删除规则">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name={`imageCompressBypassRules.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>规则名称</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={200} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`imageCompressBypassRules.${index}.conditions.mimeTypes`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MIME 类型（逗号分隔）</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如 image/gif, image/png"
                          value={field.value.join(", ")}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`imageCompressBypassRules.${index}.conditions.uploadTypes`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>上传类型（不选表示不限制）</FormLabel>
                      <div className="flex flex-wrap gap-3">
                        {UPLOAD_IMAGE_TYPES.map((t) => (
                          <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={field.value.includes(t)}
                              onCheckedChange={(checked) => {
                                const next = new Set(field.value);
                                if (checked === true) next.add(t);
                                else next.delete(t);
                                field.onChange([...next]);
                              }}
                            />
                            {TYPE_LABEL[t]} ({t})
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`imageCompressBypassRules.${index}.conditions.maxFileSize`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最大文件大小（字节，≤ 此大小则匹配）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="留空表示不按大小匹配"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            field.onChange(v === "" ? null : Number.parseInt(v, 10));
                          }}
                        />
                      </FormControl>
                      <FormDescription>例如 51200 表示不超过约 50KB 的文件命中该条件</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append(newBypassRule())}>
              <Plus className="h-4 w-4 mr-1" />
              添加规则
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>视频封面生成</CardTitle>
            <CardDescription>影响 ffmpeg 抽帧后 sharp 输出多格式封面的编码参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="coverWidth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>输出宽度 (px)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={256}
                      max={4096}
                      value={field.value}
                      onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 256)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverAvifQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AVIF 质量 ({field.value})</FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverAvifEffort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AVIF Effort ({field.value}，越高越慢)</FormLabel>
                  <FormControl>
                    <Slider
                      min={0}
                      max={9}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverWebpQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WebP 质量 ({field.value})</FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverJpegQuality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>JPEG 质量 ({field.value})</FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            保存设置
          </Button>
        </div>
      </form>
    </Form>
  );
}
