"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  Send,
  Save,
  Info,
  ToggleLeft,
  FileText,
  Link2,
  Shield,
  Megaphone,
  Plus,
  Trash2,
  HardDrive,
  Download,
  Upload,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "@/lib/toast-with-sound";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// 配置表单 schema
const configFormSchema = z.object({
  // 基本信息
  siteName: z.string().min(1, "网站名称不能为空").max(100),
  siteUrl: z.string().url("请输入有效的 URL").optional().nullable().or(z.literal("")),
  siteDescription: z.string().max(500).optional().nullable(),
  siteLogo: z.string().url("请输入有效的 URL").optional().nullable().or(z.literal("")),
  siteFavicon: z.string().url("请输入有效的 URL").optional().nullable().or(z.literal("")),
  siteKeywords: z.string().max(500).optional().nullable(),
  
  // SEO / 验证
  googleVerification: z.string().max(200).optional().nullable().or(z.literal("")),
  githubUrl: z.string().url("请输入有效的 URL").optional().nullable().or(z.literal("")),
  securityEmail: z.string().email("请输入有效的邮箱").optional().nullable().or(z.literal("")),
  
  // 公告
  announcement: z.string().max(2000).optional().nullable(),
  announcementEnabled: z.boolean(),
  
  // 功能开关
  allowRegistration: z.boolean(),
  allowUpload: z.boolean(),
  allowComment: z.boolean(),
  requireEmailVerify: z.boolean(),
  
  // 内容设置
  videosPerPage: z.number().int().min(5).max(100),
  commentsPerPage: z.number().int().min(5).max(100),
  maxUploadSize: z.number().int().min(10).max(10000),
  allowedVideoFormats: z.string().max(200),
  
  // 联系方式
  contactEmail: z.string().email("请输入有效的邮箱").optional().nullable().or(z.literal("")),
  
  // 页脚
  footerText: z.string().max(1000).optional().nullable(),
  
  // 备案
  icpBeian: z.string().max(100).optional().nullable(),
  publicSecurityBeian: z.string().max(100).optional().nullable(),

  // 广告系统
  adsEnabled: z.boolean(),

  // 广告门
  adGateEnabled: z.boolean(),
  adGateViewsRequired: z.number().int().min(1).max(20),
  adGateHours: z.number().int().min(1).max(168),

  // 广告列表（统一管理，广告门和页面广告位共用）
  sponsorAds: z.array(z.object({
    title: z.string().min(1, "标题必填").max(200),
    platform: z.string().max(100),
    url: z.string().url("请输入有效 URL"),
    description: z.string().max(500),
    imageUrl: z.string().max(2000),
    weight: z.number().int().min(1).max(100),
    enabled: z.boolean(),
  })),

  // 对象存储
  storageProvider: z.enum(["local", "s3", "r2", "minio", "oss", "cos"]),
  storageEndpoint: z.string().max(500).optional().nullable().or(z.literal("")),
  storageBucket: z.string().max(200).optional().nullable().or(z.literal("")),
  storageRegion: z.string().max(100).optional().nullable().or(z.literal("")),
  storageAccessKey: z.string().max(500).optional().nullable().or(z.literal("")),
  storageSecretKey: z.string().max(500).optional().nullable().or(z.literal("")),
  storageCustomDomain: z.string().max(500).optional().nullable().or(z.literal("")),
  storagePathPrefix: z.string().max(200).optional().nullable().or(z.literal("")),

  // 视觉效果
  effectEnabled: z.boolean(),
  effectType: z.enum(["sakura", "firefly", "snow", "stars", "none"]),
  effectDensity: z.number().int().min(1).max(100),
  effectSpeed: z.number().min(0.1).max(3.0),
  effectOpacity: z.number().min(0).max(1),
  effectColor: z.string().max(50).optional().nullable().or(z.literal("")),
  soundDefaultEnabled: z.boolean(),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

type AdsFieldArrayProps = {
  control: Control<ConfigFormValues>;
  fields: Array<{ id: string }>;
  append: (item: { title: string; platform: string; url: string; description: string; imageUrl: string; weight: number; enabled: boolean }) => void;
  remove: (index: number) => void;
};

function AdsFieldArray({ control, fields, append, remove }: AdsFieldArrayProps) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">广告 #{index + 1}</span>
            <div className="flex items-center gap-2">
              <FormField
                control={control}
                name={`sponsorAds.${index}.enabled`}
                render={({ field: f }) => (
                  <FormItem className="flex items-center gap-1.5 space-y-0">
                    <FormLabel className="text-xs text-muted-foreground">启用</FormLabel>
                    <FormControl>
                      <Switch checked={f.value ?? true} onCheckedChange={f.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <FormField
              control={control}
              name={`sponsorAds.${index}.title`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">广告标题</FormLabel>
                  <FormControl>
                    <Input {...f} placeholder="例如：XXX推广" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`sponsorAds.${index}.platform`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">广告平台名</FormLabel>
                  <FormControl>
                    <Input {...f} value={f.value ?? ""} placeholder="例如：Google、百度联盟" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`sponsorAds.${index}.url`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">跳转链接</FormLabel>
                  <FormControl>
                    <Input {...f} type="url" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`sponsorAds.${index}.imageUrl`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">图片链接</FormLabel>
                  <FormControl>
                    <Input {...f} value={f.value ?? ""} placeholder="https://...图片URL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`sponsorAds.${index}.description`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">描述（可选）</FormLabel>
                  <FormControl>
                    <Input {...f} value={f.value ?? ""} placeholder="简短广告描述" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`sponsorAds.${index}.weight`}
              render={({ field: f }) => (
                <FormItem>
                  <FormLabel className="text-xs">权重（1-100）</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={f.value ?? 1}
                      onChange={(e) => f.onChange(parseInt(e.target.value, 10) || 1)}
                      placeholder="1"
                    />
                  </FormControl>
                  <FormDescription className="text-[10px]">数值越大展示概率越高</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ title: "", platform: "", url: "", description: "", imageUrl: "", weight: 1, enabled: true })}
      >
        <Plus className="h-4 w-4 mr-2" />
        添加广告
      </Button>
    </div>
  );
}

interface SearchEngineStatus {
  indexnow: { configured: boolean; keyFile: string | null };
  google: { configured: boolean; note: string | null };
}

export default function AdminSettingsPage() {
  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    refetch,
  } = trpc.admin.getSiteConfig.useQuery(undefined, {
    enabled: !!permissions?.scopes.includes("settings:manage"),
    retry: 1,
  });
  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: () => {
      toast.success("配置已保存");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "保存失败");
    },
  });

  const exportConfig = trpc.admin.exportSiteConfig.useQuery(undefined, {
    enabled: false,
  });

  const importConfig = trpc.admin.importSiteConfig.useMutation({
    onSuccess: (result) => {
      toast.success(`已还原 ${result.imported} 项配置`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "还原失败");
    },
  });

  const handleExportConfig = async () => {
    try {
      const result = await exportConfig.refetch();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `site-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("配置已导出");
      }
    } catch {
      toast.error("导出失败");
    }
  };

  const handleImportConfig = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (typeof data !== "object" || data === null) {
          toast.error("文件格式不正确");
          return;
        }
        setPendingImport(data);
        setShowImportDialog(true);
      } catch {
        toast.error("文件解析失败，请确保是有效的 JSON 文件");
      }
    };
    input.click();
  };

  const confirmImport = () => {
    if (pendingImport) {
      importConfig.mutate({ data: pendingImport });
    }
    setShowImportDialog(false);
    setPendingImport(null);
  };

  const [engineStatus, setEngineStatus] = useState<SearchEngineStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentDays, setRecentDays] = useState(7);
  const [lastResult, setLastResult] = useState<{ type: string; message: string; time: Date } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<Record<string, unknown> | null>(null);

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      siteName: "",
      siteUrl: "",
      siteDescription: "",
      siteLogo: "",
      siteFavicon: "",
      siteKeywords: "",
      googleVerification: "",
      githubUrl: "",
      securityEmail: "",
      announcement: "",
      announcementEnabled: false,
      allowRegistration: true,
      allowUpload: true,
      allowComment: true,
      requireEmailVerify: false,
      videosPerPage: 20,
      commentsPerPage: 20,
      maxUploadSize: 500,
      allowedVideoFormats: "mp4,webm,m3u8",
      contactEmail: "",
      footerText: "",
      icpBeian: "",
      publicSecurityBeian: "",
      adsEnabled: false,
      adGateEnabled: false,
      adGateViewsRequired: 3,
      adGateHours: 12,
      sponsorAds: [],
      storageProvider: "local",
      storageEndpoint: "",
      storageBucket: "",
      storageRegion: "",
      storageAccessKey: "",
      storageSecretKey: "",
      storageCustomDomain: "",
      storagePathPrefix: "",
      effectEnabled: true,
      effectType: "sakura",
      effectDensity: 50,
      effectSpeed: 1.0,
      effectOpacity: 0.8,
      effectColor: "",
      soundDefaultEnabled: true,
    },
  });
  const { fields: adsFields, append: appendAd, remove: removeAd } = useFieldArray({
    control: form.control,
    name: "sponsorAds",
  });

  // 当配置加载完成后，更新表单
  useEffect(() => {
    if (config) {
      form.reset({
        siteName: config.siteName,
        siteUrl: (config as Record<string, unknown>).siteUrl as string || "",
        siteDescription: config.siteDescription || "",
        siteLogo: config.siteLogo || "",
        siteFavicon: config.siteFavicon || "",
        siteKeywords: config.siteKeywords || "",
        googleVerification: (config as Record<string, unknown>).googleVerification as string || "",
        githubUrl: (config as Record<string, unknown>).githubUrl as string || "",
        securityEmail: (config as Record<string, unknown>).securityEmail as string || "",
        announcement: config.announcement || "",
        announcementEnabled: config.announcementEnabled,
        allowRegistration: config.allowRegistration,
        allowUpload: config.allowUpload,
        allowComment: config.allowComment,
        requireEmailVerify: config.requireEmailVerify,
        videosPerPage: config.videosPerPage,
        commentsPerPage: config.commentsPerPage,
        maxUploadSize: config.maxUploadSize,
        allowedVideoFormats: config.allowedVideoFormats,
        contactEmail: config.contactEmail || "",
        footerText: config.footerText || "",
        icpBeian: config.icpBeian || "",
        publicSecurityBeian: config.publicSecurityBeian || "",
        adsEnabled: (config as { adsEnabled?: boolean }).adsEnabled ?? false,
        adGateEnabled: (config as { adGateEnabled?: boolean }).adGateEnabled ?? false,
        adGateViewsRequired: (config as { adGateViewsRequired?: number }).adGateViewsRequired ?? 3,
        adGateHours: (config as { adGateHours?: number }).adGateHours ?? 12,
        sponsorAds: ((config as unknown as { sponsorAds?: ConfigFormValues["sponsorAds"] }).sponsorAds ?? []).map((item) => ({
          title: item.title ?? "",
          platform: item.platform ?? "",
          url: item.url ?? "",
          description: item.description ?? "",
          imageUrl: item.imageUrl ?? "",
          weight: item.weight ?? 1,
          enabled: item.enabled !== false,
        })),
        storageProvider: ((config as Record<string, unknown>).storageProvider as ConfigFormValues["storageProvider"]) ?? "local",
        storageEndpoint: ((config as Record<string, unknown>).storageEndpoint as string) || "",
        storageBucket: ((config as Record<string, unknown>).storageBucket as string) || "",
        storageRegion: ((config as Record<string, unknown>).storageRegion as string) || "",
        storageAccessKey: ((config as Record<string, unknown>).storageAccessKey as string) || "",
        storageSecretKey: ((config as Record<string, unknown>).storageSecretKey as string) || "",
        storageCustomDomain: ((config as Record<string, unknown>).storageCustomDomain as string) || "",
        storagePathPrefix: ((config as Record<string, unknown>).storagePathPrefix as string) || "",
        effectEnabled: (config as Record<string, unknown>).effectEnabled as boolean ?? true,
        effectType: ((config as Record<string, unknown>).effectType as ConfigFormValues["effectType"]) ?? "sakura",
        effectDensity: (config as Record<string, unknown>).effectDensity as number ?? 50,
        effectSpeed: (config as Record<string, unknown>).effectSpeed as number ?? 1.0,
        effectOpacity: (config as Record<string, unknown>).effectOpacity as number ?? 0.8,
        effectColor: ((config as Record<string, unknown>).effectColor as string) || "",
        soundDefaultEnabled: (config as Record<string, unknown>).soundDefaultEnabled as boolean ?? true,
      });
    }
  }, [config, form]);

  useEffect(() => {
    fetch("/api/indexnow")
      .then((res) => res.json())
      .then(setEngineStatus)
      .catch(() => setEngineStatus({
        indexnow: { configured: false, keyFile: null },
        google: { configured: false, note: null },
      }));
  }, []);

  const handleSubmitIndex = async (type: "recent" | "all" | "site" | "sitemap") => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, days: recentDays }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setLastResult({ type, message: data.message, time: new Date() });
      } else {
        toast.error(data.error || "提交失败");
      }
    } catch {
      toast.error("请求失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = (values: ConfigFormValues) => {
    updateConfig.mutate(values);
  };

  if (!permissions?.scopes.includes("settings:manage")) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        您没有系统设置权限
      </div>
    );
  }

  if (configLoading && !config) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {configError && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          配置加载失败，请点击下方「保存设置」尝试创建或刷新后重试。
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            系统设置
          </h1>
          <p className="text-muted-foreground mt-1">
            配置网站的系统参数
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportConfig}>
            <Download className="h-4 w-4 mr-1" />
            备份配置
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportConfig}>
            <Upload className="h-4 w-4 mr-1" />
            还原配置
          </Button>
        </div>
      </div>

      <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认还原配置</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>还原将覆盖当前的所有系统配置（含友情链接），此操作不可撤销。建议先备份当前配置后再还原。</p>
                {typeof pendingImport?._exportedAt === "string" && (
                  <p className="mt-2 text-xs">
                    配置备份时间：{new Date(pendingImport._exportedAt).toLocaleString()}
                  </p>
                )}
                {Array.isArray(pendingImport?._friendLinks) && (
                  <p className="mt-1 text-xs">
                    包含 {(pendingImport._friendLinks as unknown[]).length} 条友情链接
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport} disabled={importConfig.isPending}>
              {importConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              确认还原
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 lg:w-auto lg:inline-grid">
          <TabsTrigger value="basic" className="gap-2">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">基本信息</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            <ToggleLeft className="h-4 w-4" />
            <span className="hidden sm:inline">功能开关</span>
          </TabsTrigger>
          <TabsTrigger value="effects" className="gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">视觉效果</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">内容设置</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">对象存储</span>
          </TabsTrigger>
          <TabsTrigger value="footer" className="gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">页脚备案</span>
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-2">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">广告</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* 基本信息 */}
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle>基本信息</CardTitle>
                  <CardDescription>设置网站的基本信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>网站名称</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Your Site Name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="siteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>站点 URL</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="https://www.example.com" />
                        </FormControl>
                        <FormDescription>站点的访问地址，用于生成 SEO、Sitemap、RSS 等。留空则使用 .env 中的 NEXT_PUBLIC_APP_URL</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="siteDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>网站描述</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="一句话介绍你的网站..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="siteLogo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://..." />
                          </FormControl>
                          <FormDescription>留空使用默认 Logo</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="siteFavicon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Favicon URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://..." />
                          </FormControl>
                          <FormDescription>留空使用默认图标</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="siteKeywords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SEO 关键词</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="关键词1,关键词2,关键词3" />
                        </FormControl>
                        <FormDescription>多个关键词用逗号分隔</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>联系邮箱</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="email" placeholder="admin@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">公告设置</h4>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="announcementEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>启用公告</FormLabel>
                              <FormDescription>在首页顶部显示公告横幅</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="announcement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>公告内容</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ""}
                                placeholder="支持 Markdown 格式..."
                                rows={4}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 功能开关 */}
            <TabsContent value="features">
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

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 视觉效果 */}
            <TabsContent value="effects">
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
                    <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      音效设置
                    </h3>
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
                  </div>

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 内容设置 */}
            <TabsContent value="content">
              <Card>
                <CardHeader>
                  <CardTitle>内容设置</CardTitle>
                  <CardDescription>配置内容相关的参数</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="videosPerPage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>每页视频数</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={5}
                              max={100}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 20)}
                            />
                          </FormControl>
                          <FormDescription>首页每页显示的视频数量</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="commentsPerPage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>每页评论数</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={5}
                              max={100}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 20)}
                            />
                          </FormControl>
                          <FormDescription>每页显示的评论数量</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maxUploadSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>最大上传大小 (MB)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={10}
                              max={10000}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 500)}
                            />
                          </FormControl>
                          <FormDescription>单个文件最大上传大小</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowedVideoFormats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>允许的视频格式</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="mp4,webm,m3u8" />
                          </FormControl>
                          <FormDescription>逗号分隔</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 对象存储 */}
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    对象存储
                  </CardTitle>
                  <CardDescription>
                    配置 S3 兼容的对象存储服务，用于存放图片、视频封面等静态资源。切换为对象存储后，新上传的文件将保存至远程存储桶。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    对象存储功能尚在开发中，当前仅支持配置保存，实际上传仍使用本地存储。
                  </div>

                  <FormField
                    control={form.control}
                    name="storageProvider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>存储提供商</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择存储提供商" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="local">本地存储</SelectItem>
                            <SelectItem value="s3">Amazon S3</SelectItem>
                            <SelectItem value="r2">Cloudflare R2</SelectItem>
                            <SelectItem value="minio">MinIO</SelectItem>
                            <SelectItem value="oss">阿里云 OSS</SelectItem>
                            <SelectItem value="cos">腾讯云 COS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>选择「本地存储」时下方配置无需填写</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("storageProvider") !== "local" && (
                    <div className="space-y-4 pt-2">
                      <FormField
                        control={form.control}
                        name="storageEndpoint"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Endpoint</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="https://s3.amazonaws.com" />
                            </FormControl>
                            <FormDescription>S3 兼容的端点地址，如 https://s3.us-east-1.amazonaws.com</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="storageBucket"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>存储桶名称</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="my-bucket" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="storageRegion"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>区域</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="us-east-1" />
                              </FormControl>
                              <FormDescription>部分服务商可留空</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="storageAccessKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Access Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="AKIA..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="storageSecretKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secret Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} type="password" placeholder="••••••••" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="storageCustomDomain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>自定义域名</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="https://cdn.example.com" />
                            </FormControl>
                            <FormDescription>用于替换默认的存储桶域名，设置后文件公开链接将使用此域名</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="storagePathPrefix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>路径前缀</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="uploads/" />
                            </FormControl>
                            <FormDescription>文件在存储桶中的路径前缀，如 uploads/</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 页脚备案 */}
            <TabsContent value="footer">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    页脚与备案
                  </CardTitle>
                  <CardDescription>配置页脚信息和备案号</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="githubUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub 链接</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="https://github.com/your-org/your-repo" />
                        </FormControl>
                        <FormDescription>页脚显示的 GitHub 仓库链接，留空则不显示</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="footerText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>页脚文本</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="自定义页脚文本，支持简单 HTML..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="icpBeian"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ICP 备案号</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="京ICP备XXXXXXXX号" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="publicSecurityBeian"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>公安备案号</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="京公网安备XXXXXXXXXXXXXX号" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 广告 */}
            <TabsContent value="ads">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5" />
                    广告设置
                  </CardTitle>
                  <CardDescription>
                    统一管理全站广告。广告将随机展示在首页视频列表、侧栏、视频页等广告位中，广告门也使用同一广告列表。可为每条广告设置权重来调整展示概率。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="adsEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>启用广告</FormLabel>
                          <FormDescription>开启后，广告将展示在首页、侧栏等位置（可在「用户管理」中单独关闭某用户的广告）</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 广告列表 */}
                  <div className="space-y-3">
                    <FormLabel>广告列表</FormLabel>
                    <FormDescription>
                      配置多条广告，系统会按权重随机选取展示。每条广告可设置图片、跳转链接、平台名和权重。
                    </FormDescription>
                    <AdsFieldArray
                      control={form.control}
                      fields={adsFields}
                      append={appendAd}
                      remove={removeAd}
                    />
                  </div>

                  {/* 广告门 */}
                  <div className="border-t pt-6 space-y-4">
                    <h4 className="font-medium">广告门</h4>
                    <FormDescription className="mt-0">
                      启用后，用户访问站点时需先点击广告链接并返回本页，满足指定次数后在设定时间内不再显示广告门。广告门使用上方同一广告列表。
                    </FormDescription>
                    <FormField
                      control={form.control}
                      name="adGateEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>启用广告门</FormLabel>
                            <FormDescription>开启后，未达成次数时访问站点会先看到广告页</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="adGateViewsRequired"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>需观看/点击次数</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={20}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 3)}
                              />
                            </FormControl>
                            <FormDescription>例如 3 次</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="adGateHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>免广告时长（小时）</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                max={168}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 12)}
                              />
                            </FormControl>
                            <FormDescription>达成后多少小时内不再显示，例如 12</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </form>
        </Form>

        {/* SEO 搜索引擎 */}
        <TabsContent value="seo">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    SEO 设置
                  </CardTitle>
                  <CardDescription>
                    搜索引擎验证和安全联系配置
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="googleVerification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google 验证码</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="Google Search Console 验证码" />
                        </FormControl>
                        <FormDescription>Google Search Console 的网站验证码，会自动添加到页面 meta 标签中</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="securityEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>安全联系邮箱</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="email" placeholder="security@example.com" />
                        </FormControl>
                        <FormDescription>用于 security.txt 中的安全联系方式，留空则不显示</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                搜索引擎推送
              </CardTitle>
              <CardDescription>
                主动通知搜索引擎索引新内容，加快收录速度
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 配置状态 */}
              <div className="space-y-2">
                <p className="text-sm font-medium">配置状态</p>
                {engineStatus === null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">IndexNow:</span>
                      {engineStatus.indexnow.configured ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          已配置
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          未配置
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Google:</span>
                      {engineStatus.google.configured ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          已配置
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          未配置
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <p className="font-medium mb-1">自动触发场景：</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>视频发布成功后</li>
                  <li>视频信息更新后</li>
                  <li>管理员审核通过后</li>
                </ul>
              </div>

              {(engineStatus?.indexnow.configured || engineStatus?.google.configured) && (
                <div className="space-y-3 pt-2 border-t">
                  <p className="text-sm font-medium">手动提交</p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSubmitIndex("site")}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                      提交站点页面
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSubmitIndex("recent")}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                        最近
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={recentDays}
                        onChange={(e) => setRecentDays(parseInt(e.target.value) || 7)}
                        className="w-16 h-8 text-center"
                      />
                      <span className="text-sm text-muted-foreground">天</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSubmitIndex("all")}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      提交全部视频
                    </Button>

                    {engineStatus?.google.configured && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSubmitIndex("sitemap")}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                        通知 Google 更新 Sitemap
                      </Button>
                    )}
                  </div>

                  {lastResult && (
                    <p className="text-xs text-muted-foreground">
                      上次提交: {lastResult.message} ({lastResult.time.toLocaleTimeString()})
                    </p>
                  )}
                </div>
              )}

              {!engineStatus?.indexnow.configured && !engineStatus?.google.configured && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>请在 .env 中配置：</p>
                  <ul className="list-disc list-inside text-xs">
                    <li>IndexNow: INDEXNOW_KEY + 对应密钥文件</li>
                    <li>Google: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
