"use client";

import { useCallback, useMemo, useState } from "react";
import type { Ad } from "@/lib/ads";
import { AD_POSITION_SPECIFIC, AD_IMAGE_SIZES } from "@/lib/ads";
import { AdCard } from "@/components/ads/ad-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  START_DATE_PRESETS,
  END_DATE_PRESETS,
  FIELD_ANCHOR,
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

export function AdFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editingId,
  saving,
  onSave,
  platforms = [],
}: AdFormDialogProps) {
  // Dialog 关闭时 Content 会 unmount，打开时重新 mount 使 activeTab 回到初始值 "basic"
  const [activeTab, setActiveTab] = useState<FormTab>("basic");

  const errors = useMemo(() => validateAdForm(form), [form]);
  const tabErrors = useMemo(() => getTabErrors(errors), [errors]);
  const hasError = tabErrors.basic || tabErrors.images || tabErrors.schedule;

  const scrollToError = useCallback(() => {
    const first = firstErrorField(errors);
    if (!first) return;
    setActiveTab(first.tab);
    // 下一帧 Tab 切换完成后再聚焦
    requestAnimationFrame(() => {
      const el = document.getElementById(FIELD_ANCHOR[first.field]);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) el.focus();
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

  // Ctrl/Cmd + Enter 保存
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
    }),
    [form],
  );

  const positionsMode: "all" | "specific" = form.positions.includes("all") ? "all" : "specific";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl sm:max-w-4xl w-[calc(100vw-2rem)] max-h-[92vh] p-0 sm:p-0 gap-0 overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>{editingId ? "编辑广告" : "新建广告"}</DialogTitle>
          <DialogDescription>
            {editingId ? "修改广告信息，保存后立即生效" : "创建新的广告，填写基本信息并配置投放规则"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
          {/* 左侧：Tab + 表单 */}
          <div className="min-w-0 overflow-y-auto px-6 py-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FormTab)}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="basic" className="gap-1.5 relative">
                  基本信息
                  {tabErrors.basic && <AlertCircle className="h-3 w-3 text-destructive" />}
                </TabsTrigger>
                <TabsTrigger value="images" className="gap-1.5 relative">
                  素材图片
                  {tabErrors.images && <AlertCircle className="h-3 w-3 text-destructive" />}
                </TabsTrigger>
                <TabsTrigger value="schedule" className="gap-1.5 relative">
                  投放规则
                  {tabErrors.schedule && <AlertCircle className="h-3 w-3 text-destructive" />}
                </TabsTrigger>
              </TabsList>

              {/* ========== 基本信息 ========== */}
              <TabsContent value="basic" className="space-y-4 pt-4 mt-0">
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

                <Field label="跳转链接" required error={errors.url}>
                  <Input
                    id={FIELD_ANCHOR.url}
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
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

              {/* ========== 素材图片 ========== */}
              <TabsContent value="images" className="space-y-4 pt-4 mt-0">
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
                      size.value === "banner" ? "bannerImage" : size.value === "card" ? "cardImage" : "sidebarImage";
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
                    {positionsMode === "specific" && (
                      <div className="rounded-lg border p-3 grid grid-cols-2 gap-2">
                        {AD_POSITION_SPECIFIC.map((p) => (
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
                    )}
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

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">立即启用</p>
                    <p className="text-[11px] text-muted-foreground">关闭则保存为草稿，不会在前台展示</p>
                  </div>
                  <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧：实时预览 */}
          <aside className="hidden lg:flex lg:flex-col border-l bg-muted/20 overflow-y-auto">
            <div className="p-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">实时预览</p>
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

/** 统一的字段包装：label + 内容 + hint/error */
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

/** 日期预设按钮组 */
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

/** 模式切换按钮（用于展示位置的全部/特定切换） */
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
