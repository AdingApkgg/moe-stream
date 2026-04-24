"use client";

import { useCallback } from "react";
import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HOME_LAYOUT,
  DESKTOP_COLUMN_OPTIONS,
  HOME_LAYOUT_PRESET_IDS,
  HOME_LAYOUT_PRESET_META,
  LANDING_CARD_META,
  MOBILE_COLUMN_OPTIONS,
  REQUIRED_SECTION_MODULES,
  SECTION_MODULE_META,
  applyHomeLayoutPreset,
  type DesktopColumns,
  type HomeLayoutConfig,
  type HomeLayoutPresetId,
  type LandingCardConfig,
  type LandingCardId,
  type MobileColumns,
  type SectionModuleConfig,
  type SectionModuleId,
} from "@/lib/home-layout";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Layout, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { layoutTabSchema, pickLayoutValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabLayout({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: layoutTabSchema,
    pickValues: pickLayoutValues,
    config,
  });

  const layout = form.watch("homeLayout") as HomeLayoutConfig;

  const setLayout = useCallback(
    (next: HomeLayoutConfig) => {
      form.setValue("homeLayout", next, { shouldDirty: true });
    },
    [form],
  );

  const markCustom = useCallback(
    (next: HomeLayoutConfig) => {
      setLayout({ ...next, preset: "custom" });
    },
    [setLayout],
  );

  const handleApplyPreset = useCallback(
    (preset: HomeLayoutPresetId) => {
      setLayout(applyHomeLayoutPreset(layout, preset));
    },
    [layout, setLayout],
  );

  const handleResetAll = useCallback(() => {
    setLayout(JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT)) as HomeLayoutConfig);
  }, [setLayout]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleLandingDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.landing.cards.findIndex((c) => c.id === active.id);
    const newIndex = layout.landing.cards.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    markCustom({
      ...layout,
      landing: { ...layout.landing, cards: arrayMove(layout.landing.cards, oldIndex, newIndex) },
    });
  };

  const handleLandingCardChange = (id: LandingCardId, patch: Partial<LandingCardConfig>) => {
    markCustom({
      ...layout,
      landing: {
        ...layout.landing,
        cards: layout.landing.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    });
  };

  const handleModulesDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.section.modules.findIndex((m) => m.id === active.id);
    const newIndex = layout.section.modules.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    markCustom({
      ...layout,
      section: {
        ...layout.section,
        modules: arrayMove(layout.section.modules, oldIndex, newIndex),
      },
    });
  };

  const handleModuleToggle = (id: SectionModuleId, enabled: boolean) => {
    markCustom({
      ...layout,
      section: {
        ...layout.section,
        modules: layout.section.modules.map((m) => (m.id === id ? { ...m, enabled } : m)),
      },
    });
  };

  const handleMobileColumns = (v: MobileColumns) => {
    markCustom({
      ...layout,
      section: { ...layout.section, gridColumns: { ...layout.section.gridColumns, mobile: v } },
    });
  };
  const handleDesktopColumns = (v: DesktopColumns) => {
    markCustom({
      ...layout,
      section: { ...layout.section, gridColumns: { ...layout.section.gridColumns, desktop: v } },
    });
  };
  const handleAdDensity = (v: number) => {
    markCustom({ ...layout, section: { ...layout.section, adDensity: v } });
  };
  const handleLandingTitle = (v: string) => markCustom({ ...layout, landing: { ...layout.landing, title: v } });
  const handleLandingSubtitle = (v: string) => markCustom({ ...layout, landing: { ...layout.landing, subtitle: v } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-4">
        {/* 预设 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              常用预设
            </CardTitle>
            <CardDescription>一键应用常见布局组合，应用后仍可在下方微调</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {HOME_LAYOUT_PRESET_IDS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                    layout.preset === p
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="text-sm font-medium">{HOME_LAYOUT_PRESET_META[p].label}</div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{HOME_LAYOUT_PRESET_META[p].desc}</p>
                </button>
              ))}
            </div>
            {layout.preset === "custom" && (
              <p className="mt-3 text-xs text-muted-foreground">当前为自定义布局，未匹配任何预设</p>
            )}
          </CardContent>
        </Card>

        {/* 落地页 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="h-4 w-4" />
              落地页
            </CardTitle>
            <CardDescription>首次访问展示的分区选择页 · 标题/副标题/卡片顺序与文案</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormItem>
              <FormLabel>页面标题</FormLabel>
              <Input
                value={layout.landing.title}
                onChange={(e) => handleLandingTitle(e.target.value)}
                placeholder="你想看什么？"
                maxLength={50}
              />
            </FormItem>
            <FormItem>
              <FormLabel>页面副标题</FormLabel>
              <Input
                value={layout.landing.subtitle}
                onChange={(e) => handleLandingSubtitle(e.target.value)}
                placeholder="选择后我们会记住你的偏好…"
                maxLength={120}
              />
            </FormItem>

            <div>
              <FormLabel className="text-sm mb-2 inline-block">选择卡片</FormLabel>
              <p className="text-xs text-muted-foreground mb-2">拖拽排序、切换显隐、自定义文案（留空则使用默认文案）</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLandingDragEnd}>
                <SortableContext items={layout.landing.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {layout.landing.cards.map((card) => (
                      <LandingCardRow
                        key={card.id}
                        card={card}
                        onChange={(patch) => handleLandingCardChange(card.id, patch)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </CardContent>
        </Card>

        {/* 分区页 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="h-4 w-4" />
              分区页布局
            </CardTitle>
            <CardDescription>视频 / 图片 / 游戏页面共用 · 模块堆叠顺序、主网格列数、inline 广告密度</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <FormLabel className="text-sm mb-2 inline-block">模块顺序</FormLabel>
              <p className="text-xs text-muted-foreground mb-2">拖拽调整排列顺序，主内容网格为必须模块</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModulesDragEnd}>
                <SortableContext items={layout.section.modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {layout.section.modules.map((mod) => (
                      <SectionModuleRow
                        key={mod.id}
                        mod={mod}
                        onToggle={(enabled) => handleModuleToggle(mod.id, enabled)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem>
                <FormLabel className="text-sm">主网格列数 · 移动端</FormLabel>
                <div className="grid grid-cols-2 gap-2">
                  {MOBILE_COLUMN_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleMobileColumns(v)}
                      className={cn(
                        "rounded-lg border h-10 text-sm font-medium transition-all",
                        layout.section.gridColumns.mobile === v
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {v} 列
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">手机屏幕（&lt; 640px）的列数</p>
              </FormItem>

              <FormItem>
                <FormLabel className="text-sm">主网格列数 · 桌面端</FormLabel>
                <div className="grid grid-cols-3 gap-2">
                  {DESKTOP_COLUMN_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleDesktopColumns(v)}
                      className={cn(
                        "rounded-lg border h-10 text-sm font-medium transition-all",
                        layout.section.gridColumns.desktop === v
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {v} 列
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">大屏（≥ 1024px）的最大列数</p>
              </FormItem>

              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm">广告密度</FormLabel>
                  <span className="text-xs text-muted-foreground">
                    {layout.section.adDensity === 0 ? "关闭" : `每 ${layout.section.adDensity} 条插入 1 条`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={layout.section.adDensity}
                  onChange={(e) => handleAdDensity(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>关闭</span>
                  <span>稀疏</span>
                  <span>密集</span>
                </div>
              </FormItem>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            保存设置
          </Button>
          <Button type="button" variant="outline" onClick={handleResetAll}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重置为默认
          </Button>
        </div>
      </form>
    </Form>
  );
}

function LandingCardRow({
  card,
  onChange,
}: {
  card: LandingCardConfig;
  onChange: (patch: Partial<LandingCardConfig>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = LANDING_CARD_META[card.id];
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="拖动排序"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 text-sm font-medium">
          {meta.defaultTitle}
          <span className="ml-1 text-xs text-muted-foreground">· {card.id}</span>
        </div>
        <Switch checked={card.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
      </div>
      {card.enabled && (
        <div className="grid gap-2 px-2.5 pb-2.5 sm:grid-cols-2">
          <Input
            value={card.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={meta.defaultTitle}
            maxLength={40}
            className="h-8 text-sm"
          />
          <Input
            value={card.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder={meta.defaultSubtitle}
            maxLength={100}
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}

function SectionModuleRow({ mod, onToggle }: { mod: SectionModuleConfig; onToggle: (enabled: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = SECTION_MODULE_META[mod.id];
  const required = REQUIRED_SECTION_MODULES.includes(mod.id);
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="拖动排序"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium">
          {meta.label}
          {required && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">必需</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{meta.desc}</p>
      </div>
      <Switch checked={mod.enabled} disabled={required} onCheckedChange={onToggle} />
    </div>
  );
}
