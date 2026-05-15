"use client";

import { useCallback, useMemo, useState } from "react";
import type { Ad, AdDevice, AdLoginState } from "@/lib/ads";
import { AD_POSITION_SPECIFIC, AD_IMAGE_SIZES, AD_DEVICES, AD_LOGIN_STATES } from "@/lib/ads";
import { AdCard } from "@/components/ads/ad-card";
import { AdHtml } from "@/components/ads/ad-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Code2, ImageIcon, Info, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  START_DATE_PRESETS,
  END_DATE_PRESETS,
  FIELD_ANCHOR,
  FORM_TABS,
  validateAdForm,
  getTabErrors,
  firstErrorField,
  type FormTab,
} from "./utils";
import type { AdFormData } from "./types";

interface AdFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AdFormData;
  setForm: React.Dispatch<React.SetStateAction<AdFormData>>;
  editingId: string | null;
  saving: boolean;
  onSave: () => void;
  /** 已有平台列表，用于 datalist 提供候选 */
  platforms?: string[];
  /** 已有分类标签列表，用于自动完成 */
  knownCategories?: string[];
}

function dateToInputValue(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return d.slice(0, 10);
  } catch {
    return "";
  }
}

function inputToStartIso(v: string): string | null {
  if (!v) return null;
  return new Date(`${v}T00:00:00`).toISOString();
}

function inputToEndIso(v: string): string | null {
  if (!v) return null;
  return new Date(`${v}T23:59:59`).toISOString();
}

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function AdFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingId,
  saving,
  onSave,
  platforms = [],
  knownCategories = [],
}: AdFormDialogProps) {
  const [activeTab, setActiveTab] = useState<FormTab>("basic");

  const errors = useMemo(() => validateAdForm(form), [form]);
  const tabErrors = useMemo(() => getTabErrors(errors), [errors]);
  const hasError = Object.values(tabErrors).some(Boolean);
  const kind = form.kind ?? "image";
  const isHtml = kind === "html";

  const scrollToError = useCallback(() => {
    const first = firstErrorField(errors);
    if (!first) return;
    setActiveTab(first.tab);
    requestAnimationFrame(() => {
      const el = document.getElementById(FIELD_ANCHOR[first.field]);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement)
          el.focus();
      }
    });
  }, [errors]);

  const handleSaveClick = useCallback(() => {
    if (hasError) {
      scrollToError();
      return;
    }
    onSave();
  }, [hasError, onSave, scrollToError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !saving) {
        e.preventDefault();
        handleSaveClick();
      }
    },
    [saving, handleSaveClick],
  );

  const livePreviewAd: Ad = useMemo(
    () => ({
      id: "preview",
      title: form.title || "广告标题预览",
      platform: form.platform || "",
      url: form.url || "#",
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      images: form.images,
      weight: form.weight,
      enabled: true,
      positions: form.positions,
      kind,
      html: form.html || undefined,
    }),
    [form, kind],
  );

  const positionsMode: "all" | "specific" = form.positions.includes("all") ? "all" : "specific";

  const targeting = form.targeting ?? {};
  const toggleDevice = (d: AdDevice, checked: boolean) => {
    setForm((f) => {
      const cur = new Set(f.targeting?.devices ?? []);
      if (checked) cur.add(d);
      else cur.delete(d);
      return { ...f, targeting: { ...f.targeting, devices: Array.from(cur) } };
    });
  };
  const toggleLogin = (s: AdLoginState, checked: boolean) => {
    setForm((f) => {
      const cur = new Set(f.targeting?.loginStates ?? []);
      if (checked) cur.add(s);
      else cur.delete(s);
      return { ...f, targeting: { ...f.targeting, loginStates: Array.from(cur) } };
    });
  };

  const schedule = form.schedule ?? {};
  const toggleDay = (d: number) => {
    setForm((f) => {
      const cur = new Set(f.schedule?.daysOfWeek ?? []);
      if (cur.has(d)) cur.delete(d);
      else cur.add(d);
      return {
        ...f,
        schedule: { ...f.schedule, daysOfWeek: Array.from(cur).sort((a, b) => a - b) },
      };
    });
  };
  const addHourRange = () => {
    setForm((f) => ({
      ...f,
      schedule: { ...f.schedule, hourRanges: [...(f.schedule?.hourRanges ?? []), [9, 22]] },
    }));
  };
  const removeHourRange = (idx: number) => {
    setForm((f) => ({
      ...f,
      schedule: { ...f.schedule, hourRanges: (f.schedule?.hourRanges ?? []).filter((_, i) => i !== idx) },
    }));
  };
  const updateHourRange = (idx: number, which: 0 | 1, value: number) => {
    setForm((f) => ({
      ...f,
      schedule: {
        ...f.schedule,
        hourRanges: (f.schedule?.hourRanges ?? []).map((r, i): [number, number] => {
          if (i !== idx) return r;
          const next: [number, number] = [r[0], r[1]];
          next[which] = value;
          return next;
        }),
      },
    }));
  };

  const caps = form.caps ?? {};
  const updateCap = (key: keyof typeof caps, value: number | null) => {
    setForm((f) => ({ ...f, caps: { ...f.caps, [key]: value } }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl sm:max-w-5xl w-[calc(100vw-2rem)] max-h-[92vh] p-0 sm:p-0 gap-0 overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>{editingId ? "编辑广告" : "新建广告"}</DialogTitle>
          <DialogDescription>
            {editingId ? "修改广告信息，保存后立即生效" : "创建新的广告，填写基本信息并配置投放规则"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
          <div className="min-w-0 overflow-y-auto px-6 py-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FormTab)}>
              <TabsList className="w-full grid grid-cols-5">
                {FORM_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="gap-1.5 relative text-xs sm:text-sm">
                    {t.label}
                    {tabErrors[t.value] && <AlertCircle className="h-3 w-3 text-destructive" />}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ========== 基本信息 ========== */}
              <TabsContent value="basic" className="space-y-4 pt-4 mt-0">
                <Field label="广告类型" hint="图片广告：自动展示卡片；代码广告：注入自定义 HTML/JS（如 AdSense）">
                  <div className="grid grid-cols-2 gap-2">
                    <KindButton
                      active={!isHtml}
                      onClick={() => setForm((f) => ({ ...f, kind: "image" }))}
                      icon={<ImageIcon className="h-4 w-4" />}
                      title="图片广告"
                      desc="上传图片 + 跳转链接"
                    />
                    <KindButton
                      active={isHtml}
                      onClick={() => setForm((f) => ({ ...f, kind: "html" }))}
                      icon={<Code2 className="h-4 w-4" />}
                      title="代码广告"
                      desc="HTML/JS 代码片段"
                    />
                  </div>
                </Field>

                <Field label="广告标题" required error={errors.title}>
                  <Input
                    id={FIELD_ANCHOR.title}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="例如：XXX 推广"
                    className={cn(errors.title && "border-destructive focus-visible:ring-destructive")}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="广告平台" hint="可选，用于归类（如 Google、百度联盟）">
                    <Input
                      list="ad-platform-options"
                      value={form.platform}
                      onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                      placeholder="例如：Google"
                    />
                    {platforms.length > 0 && (
                      <datalist id="ad-platform-options">
                        {platforms.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    )}
                  </Field>
                  <Field label="权重" hint="1-100，数值越大展示概率越高">
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={form.weight}
                        onChange={(e) => {
                          const v = Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1));
                          setForm((f) => ({ ...f, weight: v }));
                        }}
                        className="w-20"
                      />
                      <Slider
                        value={[form.weight]}
                        onValueChange={(v) => setForm((f) => ({ ...f, weight: v[0] }))}
                        min={1}
                        max={100}
                        step={1}
                        className="flex-1"
                      />
                    </div>
                  </Field>
                </div>

                <Field
                  label={isHtml ? "跳转链接（可选）" : "跳转链接"}
                  required={!isHtml}
                  hint={isHtml ? "代码广告通常由 SDK 自身处理跳转，留空即可" : undefined}
                  error={errors.url}
                >
                  <Input
                    id={FIELD_ANCHOR.url}
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder={isHtml ? "https://...（可选）" : "https://..."}
                    type="url"
                    className={cn(errors.url && "border-destructive focus-visible:ring-destructive")}
                  />
                </Field>

                <Field label="描述" hint="简短文案，出现在卡片标题下方">
                  <Input
                    value={form.description || ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="简短广告描述"
                  />
                </Field>
              </TabsContent>

              {/* ========== 素材 / 代码 ========== */}
              <TabsContent value="creative" className="space-y-4 pt-4 mt-0">
                {isHtml ? (
                  <>
                    <Field
                      label="HTML / JS 代码"
                      required
                      hint="支持 <script> 标签，将在客户端注入并执行。请仅粘贴来自可信广告平台的代码"
                      error={errors.html}
                    >
                      <Textarea
                        id={FIELD_ANCHOR.html}
                        value={form.html || ""}
                        onChange={(e) => setForm((f) => ({ ...f, html: e.target.value }))}
                        placeholder={
                          '<ins class="adsbygoogle" ...></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>'
                        }
                        rows={12}
                        className={cn(
                          "font-mono text-xs",
                          errors.html && "border-destructive focus-visible:ring-destructive",
                        )}
                      />
                    </Field>
                    <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-2.5 text-xs text-yellow-700 dark:text-yellow-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        安全提示：代码片段会以 <code className="font-mono">innerHTML</code> 注入并执行其中的{" "}
                        <code className="font-mono">&lt;script&gt;</code> 标签。仅粘贴来自 Google
                        AdSense、Cloudflare、百度联盟等可信平台的官方代码，避免引入 XSS 风险。
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Field label="默认图片" hint="所有广告位的回退图；未配置专用尺寸时使用此图" error={errors.imageUrl}>
                      <Input
                        id={FIELD_ANCHOR.imageUrl}
                        value={form.imageUrl || ""}
                        onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                        placeholder="https://...图片 URL"
                        className={cn(errors.imageUrl && "border-destructive focus-visible:ring-destructive")}
                      />
                    </Field>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>可选：为不同广告位配置专用尺寸图片，投放时自动匹配；留空则回退到默认图片。</span>
                      </div>
                      {AD_IMAGE_SIZES.map((size) => {
                        const value = form.images?.[size.value] || "";
                        const errorKey =
                          size.value === "banner"
                            ? "bannerImage"
                            : size.value === "card"
                              ? "cardImage"
                              : "sidebarImage";
                        const anchor =
                          size.value === "banner"
                            ? FIELD_ANCHOR.bannerImage
                            : size.value === "card"
                              ? FIELD_ANCHOR.cardImage
                              : FIELD_ANCHOR.sidebarImage;
                        const err = errors[errorKey];
                        return (
                          <Field key={size.value} label={size.label} hint={size.hint} error={err}>
                            <Input
                              id={anchor}
                              value={value}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  images: { ...f.images, [size.value]: e.target.value },
                                }))
                              }
                              placeholder="https://..."
                              className={cn(err && "border-destructive focus-visible:ring-destructive")}
                            />
                          </Field>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ========== 投放规则 ========== */}
              <TabsContent value="schedule" className="space-y-4 pt-4 mt-0">
                <Field label="展示位置" required error={errors.positions}>
                  <div id={FIELD_ANCHOR.positions} className="space-y-3">
                    <div className="flex gap-2">
                      <ModeButton
                        active={positionsMode === "all"}
                        onClick={() => setForm((f) => ({ ...f, positions: ["all"] }))}
                      >
                        全部位置
                      </ModeButton>
                      <ModeButton
                        active={positionsMode === "specific"}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            positions: f.positions.includes("all") ? [] : f.positions,
                          }))
                        }
                      >
                        特定位置
                      </ModeButton>
                    </div>
                    {positionsMode === "specific" && <PositionGrid form={form} setForm={setForm} />}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="开始日期" hint="留空表示立即投放">
                    <DatePresets
                      presets={START_DATE_PRESETS}
                      onPick={(v) =>
                        setForm((f) => ({
                          ...f,
                          startDate: v ? inputToStartIso(v) : null,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      value={dateToInputValue(form.startDate)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          startDate: inputToStartIso(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="结束日期" hint="留空表示长期有效" error={errors.dateRange}>
                    <DatePresets
                      presets={END_DATE_PRESETS}
                      onPick={(v) =>
                        setForm((f) => ({
                          ...f,
                          endDate: v ? inputToEndIso(v) : null,
                        }))
                      }
                    />
                    <Input
                      id={FIELD_ANCHOR.dateRange}
                      type="date"
                      value={dateToInputValue(form.endDate)}
                      min={dateToInputValue(form.startDate)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          endDate: inputToEndIso(e.target.value),
                        }))
                      }
                      className={cn(errors.dateRange && "border-destructive focus-visible:ring-destructive")}
                    />
                  </Field>
                </div>

                <Field label="投放星期" hint="不选表示每天投放，选中后仅在勾选的星期展示">
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, idx) => {
                      const active = (schedule.daysOfWeek ?? []).includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          className={cn(
                            "h-8 w-10 rounded-md border text-sm transition-colors",
                            active
                              ? "border-primary bg-primary/15 text-primary font-medium"
                              : "border-border bg-card text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {(schedule.daysOfWeek?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, schedule: { ...f.schedule, daysOfWeek: [] } }))}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>

                <Field
                  label="投放小时区间"
                  hint="不设置表示全天投放；每段为 [开始, 结束) 即包含开始小时、不含结束小时"
                  error={errors.hourRanges}
                >
                  <div id={FIELD_ANCHOR.hourRanges} className="space-y-2">
                    {(schedule.hourRanges ?? []).map(([s, e], idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          value={s}
                          onChange={(ev) =>
                            updateHourRange(idx, 0, Math.max(0, Math.min(24, parseInt(ev.target.value, 10) || 0)))
                          }
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">点 ~</span>
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          value={e}
                          onChange={(ev) =>
                            updateHourRange(idx, 1, Math.max(0, Math.min(24, parseInt(ev.target.value, 10) || 0)))
                          }
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">点</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeHourRange(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1" onClick={addHourRange}>
                      <Plus className="h-3.5 w-3.5" />
                      添加小时区间
                    </Button>
                  </div>
                </Field>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">立即启用</p>
                    <p className="text-[11px] text-muted-foreground">关闭则保存为草稿，不会在前台展示</p>
                  </div>
                  <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
                </div>
              </TabsContent>

              {/* ========== 定向投放 ========== */}
              <TabsContent value="targeting" className="space-y-4 pt-4 mt-0">
                <Field label="设备类型" hint="不选表示全部设备；选中后仅在勾选的设备上展示">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                    {AD_DEVICES.map((d) => (
                      <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(targeting.devices ?? []).includes(d.value)}
                          onCheckedChange={(c) => toggleDevice(d.value, c === true)}
                        />
                        <span className="text-sm">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="登录状态" hint="不选表示不限；可仅对游客或仅对已登录用户展示">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                    {AD_LOGIN_STATES.map((s) => (
                      <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={(targeting.loginStates ?? []).includes(s.value)}
                          onCheckedChange={(c) => toggleLogin(s.value, c === true)}
                        />
                        <span className="text-sm">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="分类标签" hint='匹配页面 currentCategory 上下文，例如 "video""image""game"。不填表示不限'>
                  <TagInput
                    values={targeting.categories ?? []}
                    suggestions={knownCategories}
                    onChange={(vals) => setForm((f) => ({ ...f, targeting: { ...f.targeting, categories: vals } }))}
                    placeholder="输入标签后回车，例如 video"
                  />
                </Field>

                <Field label="语言地区" hint="匹配浏览器语言前缀，例如 zh / en / ja。不填表示不限">
                  <TagInput
                    values={targeting.locales ?? []}
                    suggestions={["zh-CN", "zh-TW", "en", "ja", "ko"]}
                    onChange={(vals) => setForm((f) => ({ ...f, targeting: { ...f.targeting, locales: vals } }))}
                    placeholder="输入语言代码后回车，例如 zh-CN"
                  />
                </Field>
              </TabsContent>

              {/* ========== 上限 / 备注 ========== */}
              <TabsContent value="advanced" className="space-y-4 pt-4 mt-0">
                <Field label="投放上限" hint="设置后会被后台定期统计；达到上限的广告将不再被随机选中。留空 = 不限">
                  <div className="grid grid-cols-2 gap-3">
                    <CapInput
                      label="每日展示上限"
                      value={caps.dailyImpressions}
                      onChange={(v) => updateCap("dailyImpressions", v)}
                    />
                    <CapInput
                      label="每日点击上限"
                      value={caps.dailyClicks}
                      onChange={(v) => updateCap("dailyClicks", v)}
                    />
                    <CapInput
                      label="总展示上限"
                      value={caps.totalImpressions}
                      onChange={(v) => updateCap("totalImpressions", v)}
                    />
                    <CapInput
                      label="总点击上限"
                      value={caps.totalClicks}
                      onChange={(v) => updateCap("totalClicks", v)}
                    />
                  </div>
                </Field>

                <Field label="备注" hint="仅后台可见，不会展示到前台">
                  <Textarea
                    value={form.notes || ""}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="例如：合作方联系人、投放目的、特殊说明……"
                    rows={4}
                  />
                </Field>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="hidden lg:flex lg:flex-col border-l bg-muted/20 overflow-y-auto">
            <div className="p-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">实时预览</p>
              {isHtml ? (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">代码注入</p>
                  <div className="rounded-lg border bg-card p-2 min-h-[100px]">
                    {form.html ? (
                      <AdHtml html={form.html} adId="preview" />
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-6">在「素材」标签填写 HTML 后预览</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">信息流卡片</p>
                    <AdCard ad={livePreviewAd} slotId="in-feed" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">侧栏紧凑</p>
                    <AdCard ad={livePreviewAd} compact slotId="sidebar" />
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="shrink-0 px-6 py-3 border-t sm:justify-between">
          <p className="hidden sm:block text-[11px] text-muted-foreground">
            快捷键：<kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">⌘/Ctrl</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> 保存
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSaveClick} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "保存修改" : "创建广告"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function DatePresets({
  presets,
  onPick,
}: {
  presets: { label: string; getValue: () => string | null }[];
  onPick: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onPick(preset.getValue())}
          className="text-[11px] px-2 py-0.5 rounded border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function KindButton({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border bg-card hover:bg-muted",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        <span className={cn("text-sm font-medium", active && "text-primary")}>{title}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
    </button>
  );
}

function PositionGrid({
  form,
  setForm,
}: {
  form: AdFormData;
  setForm: React.Dispatch<React.SetStateAction<AdFormData>>;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof AD_POSITION_SPECIFIC>();
    for (const item of AD_POSITION_SPECIFIC) {
      const key = item.group ?? "其他";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="rounded-lg border divide-y">
      {groups.map(([group, items]) => (
        <div key={group} className="p-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{group}</p>
          <div className="grid grid-cols-2 gap-2">
            {items.map((p) => (
              <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.positions.includes(p.value)}
                  onCheckedChange={(checked) => {
                    setForm((f) => {
                      const without = f.positions.filter((v) => v !== "all" && v !== p.value);
                      return { ...f, positions: checked ? [...without, p.value] : without };
                    });
                  }}
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CapInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={0}
        value={value == null ? "" : value}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (v === "") onChange(null);
          else {
            const n = parseInt(v, 10);
            onChange(Number.isFinite(n) && n >= 0 ? n : null);
          }
        }}
        placeholder="不限"
      />
    </div>
  );
}

function TagInput({
  values,
  suggestions,
  onChange,
  placeholder,
}: {
  values: string[];
  suggestions?: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <div className="rounded-md border bg-transparent px-2 py-1.5 min-h-9">
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="rounded hover:bg-primary/20 transition-colors"
              aria-label={`移除 ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          list={suggestions && suggestions.length > 0 ? "ad-tag-suggestions" : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {suggestions && suggestions.length > 0 && (
          <datalist id="ad-tag-suggestions">
            {suggestions
              .filter((s) => !values.includes(s))
              .map((s) => (
                <option key={s} value={s} />
              ))}
          </datalist>
        )}
      </div>
    </div>
  );
}
