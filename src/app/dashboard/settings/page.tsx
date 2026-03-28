"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTabParam } from "@/hooks/use-tab-param";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  HardDrive,
  Download,
  Upload,
  Sparkles,
  Volume2,
  KeyRound,
  Mail,
  FolderOpen,
  Palette,
  ShieldCheck,
  TriangleAlert,
  Copy,
  ScrollText,
  BarChart3,
} from "lucide-react";
import type { SiteConfig } from "@/generated/prisma/client";
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
  requireLoginToComment: z.boolean(),
  requireEmailVerify: z.boolean(),

  // 内容分区开关
  sectionVideoEnabled: z.boolean(),
  sectionImageEnabled: z.boolean(),
  sectionGameEnabled: z.boolean(),

  // 分区排序选项
  videoSortOptions: z.string().max(200),
  gameSortOptions: z.string().max(200),
  imageSortOptions: z.string().max(200),
  videoDefaultSort: z.string(),
  gameDefaultSort: z.string(),
  imageDefaultSort: z.string(),

  // 内容设置
  videoSelectorMode: z.enum(["series", "author", "uploader", "disabled"]).catch("series"),
  videosPerPage: z.number().int().min(5).max(100),
  commentsPerPage: z.number().int().min(5).max(100),
  maxUploadSize: z.number().int().min(10).max(10000),
  allowedVideoFormats: z.string().max(200),
  adminBatchLimit: z.number().int().min(100).max(100000),

  // 联系方式
  contactEmail: z.string().email("请输入有效的邮箱").optional().nullable().or(z.literal("")),

  // 法律与信息页面
  privacyPolicy: z.string().max(50000).optional().nullable(),
  termsOfService: z.string().max(50000).optional().nullable(),
  aboutPage: z.string().max(50000).optional().nullable(),

  // 页脚
  footerText: z.string().max(1000).optional().nullable(),

  // 备案
  icpBeian: z.string().max(100).optional().nullable(),
  publicSecurityBeian: z.string().max(100).optional().nullable(),

  // 验证码 / 人机验证
  captchaLogin: z.enum(["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"]).catch("math"),
  captchaRegister: z.enum(["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"]).catch("none"),
  captchaComment: z.enum(["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"]).catch("none"),
  captchaForgotPassword: z.enum(["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"]).catch("none"),
  turnstileSiteKey: z.string().max(500).optional().nullable().or(z.literal("")),
  turnstileSecretKey: z.string().max(500).optional().nullable().or(z.literal("")),
  recaptchaSiteKey: z.string().max(500).optional().nullable().or(z.literal("")),
  recaptchaSecretKey: z.string().max(500).optional().nullable().or(z.literal("")),
  hcaptchaSiteKey: z.string().max(500).optional().nullable().or(z.literal("")),
  hcaptchaSecretKey: z.string().max(500).optional().nullable().or(z.literal("")),

  // SMTP 邮件
  mailSendMode: z.enum(["smtp", "http_api"]).catch("smtp"),
  smtpHost: z.string().max(500).optional().nullable().or(z.literal("")),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().max(500).optional().nullable().or(z.literal("")),
  smtpPassword: z.string().max(500).optional().nullable().or(z.literal("")),
  smtpFrom: z.string().max(500).optional().nullable().or(z.literal("")),
  mailApiUrl: z.string().url("请输入有效的 URL").optional().nullable().or(z.literal("")),
  mailApiKey: z.string().max(1000).optional().nullable().or(z.literal("")),
  mailApiFrom: z.string().max(500).optional().nullable().or(z.literal("")),
  mailApiHeaders: z.string().max(10000).optional().nullable().or(z.literal("")),

  // 上传目录
  uploadDir: z.string().max(500).optional(),

  // 搜索引擎推送密钥
  indexNowKey: z.string().max(500).optional().nullable().or(z.literal("")),
  googleServiceAccountEmail: z.string().max(500).optional().nullable().or(z.literal("")),
  googlePrivateKey: z.string().max(10000).optional().nullable().or(z.literal("")),

  // 对象存储
  storageProvider: z.enum(["local", "s3", "r2", "minio", "oss", "cos"]).catch("local"),
  storageEndpoint: z.string().max(500).optional().nullable().or(z.literal("")),
  storageBucket: z.string().max(200).optional().nullable().or(z.literal("")),
  storageRegion: z.string().max(100).optional().nullable().or(z.literal("")),
  storageAccessKey: z.string().max(500).optional().nullable().or(z.literal("")),
  storageSecretKey: z.string().max(500).optional().nullable().or(z.literal("")),
  storageCustomDomain: z.string().max(500).optional().nullable().or(z.literal("")),
  storagePathPrefix: z.string().max(200).optional().nullable().or(z.literal("")),

  // 个性化样式
  themeHue: z.number().int().min(0).max(360),
  themeColorTemp: z.number().int().min(-100).max(100),
  themeBorderRadius: z.number().min(0).max(2),
  themeGlassOpacity: z.number().min(0).max(1),
  themeAnimations: z.boolean(),

  // 动画细分配置
  animationSpeed: z.number().min(0.5).max(2.0),
  animationPageTransition: z.boolean(),
  animationStagger: z.boolean(),
  animationHover: z.boolean(),
  animationDialog: z.boolean(),
  animationTab: z.boolean(),
  animationPreset: z.enum(["minimal", "standard", "rich"]).catch("standard"),

  // 视觉效果
  effectEnabled: z.boolean(),
  effectType: z.enum(["sakura", "firefly", "snow", "stars", "aurora", "cyber", "none"]).catch("sakura"),
  effectDensity: z.number().int().min(1).max(100),
  effectSpeed: z.number().min(0.1).max(3.0),
  effectOpacity: z.number().min(0).max(1),
  effectColor: z.string().max(50).optional().nullable().or(z.literal("")),
  soundDefaultEnabled: z.boolean(),

  // USDT 支付
  usdtPaymentEnabled: z.boolean(),
  usdtWalletAddress: z.string().max(100).optional().nullable().or(z.literal("")),
  usdtPointsPerUnit: z.number().int().min(1),
  usdtOrderTimeoutMin: z.number().int().min(5).max(1440),
  usdtMinAmount: z.number().min(0).optional().nullable(),
  usdtMaxAmount: z.number().min(0).optional().nullable(),

  // 统计分析
  analyticsGoogleId: z.string().max(200).optional().nullable().or(z.literal("")),
  analyticsGtmId: z.string().max(200).optional().nullable().or(z.literal("")),
  analyticsCfToken: z.string().max(200).optional().nullable().or(z.literal("")),
  analyticsClarityId: z.string().max(200).optional().nullable().or(z.literal("")),
  analyticsBingVerification: z.string().max(200).optional().nullable().or(z.literal("")),

  // OAuth 社交登录
  oauthGoogleClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthGoogleClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthGithubClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthGithubClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthDiscordClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthDiscordClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthAppleClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthAppleClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthTwitterClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthTwitterClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthFacebookClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthFacebookClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthMicrosoftClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthMicrosoftClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthTwitchClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthTwitchClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthSpotifyClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthSpotifyClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthLinkedinClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthLinkedinClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthGitlabClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthGitlabClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthRedditClientId: z.string().max(500).optional().nullable().or(z.literal("")),
  oauthRedditClientSecret: z.string().max(500).optional().nullable().or(z.literal("")),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

const validEnum = <T extends string>(value: unknown, valid: readonly T[], fallback: T): T =>
  valid.includes(value as T) ? (value as T) : fallback;

function TestEmailButton() {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const sendTest = trpc.admin.sendTestEmail.useMutation({
    onSuccess: () => {
      toast.success("测试邮件已发送，请检查收件箱");
      setOpen(false);
      setEmail("");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4 mr-2" />
        发送测试邮件
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>发送测试邮件</AlertDialogTitle>
            <AlertDialogDescription>
              请先保存配置，然后输入收件人邮箱发送一封测试邮件来验证配置是否正确。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input type="email" placeholder="收件人邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={!email.includes("@") || sendTest.isPending}
              onClick={(e) => {
                e.preventDefault();
                sendTest.mutate({ to: email });
              }}
            >
              {sendTest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ThemePreviewPanel({
  hue,
  colorTemp,
  borderRadius,
  glassOpacity,
  animations,
}: {
  hue: number;
  colorTemp: number;
  borderRadius: number;
  glassOpacity: number;
  animations: boolean;
}) {
  const accentHue = (hue + 45) % 360;
  let neutralHue = hue;
  if (colorTemp > 0) neutralHue = hue + (50 - hue) * (colorTemp / 100);
  else if (colorTemp < 0) neutralHue = hue + (220 - hue) * (-colorTemp / 100);

  const p = `oklch(0.55 0.24 ${hue})`;
  const pDark = `oklch(0.7 0.2 ${hue})`;
  const bg = `oklch(0.99 0.005 ${neutralHue})`;
  const bgDark = `oklch(0.13 0.02 ${neutralHue})`;
  const cardDarkAlpha = (a: number) => `oklch(0.18 0.025 ${hue} / ${a}%)`;
  const mutedFg = `oklch(0.5 0.03 ${hue})`;
  const mutedFgDark = `oklch(0.65 0.03 ${hue})`;
  const accent = `oklch(0.92 0.05 ${accentHue})`;
  const border = `oklch(0.9 0.02 ${hue})`;
  const borderDark = `oklch(1 0 0 / 12%)`;
  const r = `${borderRadius}rem`;
  const rSm = `${Math.max(0, borderRadius - 0.25)}rem`;

  return (
    <div className="sticky top-6 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">实时预览</p>

      {/* Light mode preview */}
      <div
        className="overflow-hidden border shadow-sm"
        style={{ background: bg, borderRadius: r, borderColor: border }}
      >
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full" style={{ background: p }} />
            <span className="text-xs font-medium" style={{ color: `oklch(0.15 0.02 ${hue})` }}>
              浅色模式
            </span>
          </div>
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#eab308" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e" }} />
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex gap-2">
            <div
              className={`px-3 py-1.5 text-[10px] text-white font-medium ${animations ? "transition-all" : ""}`}
              style={{ background: p, borderRadius: rSm }}
            >
              主要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px] font-medium"
              style={{ background: accent, borderRadius: rSm, color: `oklch(0.25 0.1 ${accentHue})` }}
            >
              次要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px]"
              style={{ border: `1px solid ${border}`, borderRadius: rSm, color: mutedFg }}
            >
              描边按钮
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-7 px-2 flex items-center text-[10px]"
              style={{
                border: `1px solid ${border}`,
                borderRadius: rSm,
                color: mutedFg,
                background: `oklch(0.92 0.02 ${hue})`,
              }}
            >
              输入框...
            </div>
            <div className="h-4 w-8 rounded-full" style={{ background: p }} />
          </div>
          <div
            className="p-2.5"
            style={{
              background: `oklch(1 0 0 / ${Math.round(glassOpacity * 100)}%)`,
              borderRadius: rSm,
              border: `1px solid ${border}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="h-2 w-3/4 rounded-full mb-1.5"
              style={{ background: `oklch(0.15 0.02 ${hue})`, opacity: 0.7 }}
            />
            <div className="h-2 w-1/2 rounded-full" style={{ background: mutedFg, opacity: 0.4 }} />
          </div>
          <div className="flex gap-1.5">
            {[hue, accentHue, (hue + 85) % 360, (hue + 135) % 360].map((ch, i) => (
              <div
                key={i}
                className="flex-1 h-6 rounded-sm"
                style={{ background: `oklch(0.65 0.2 ${ch})`, borderRadius: rSm, opacity: 0.8 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Dark mode preview */}
      <div
        className="overflow-hidden border shadow-sm"
        style={{ background: bgDark, borderRadius: r, borderColor: borderDark }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${borderDark}` }}
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full" style={{ background: pDark }} />
            <span className="text-xs font-medium" style={{ color: `oklch(0.95 0.01 ${hue})` }}>
              深色模式
            </span>
          </div>
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#eab308" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e" }} />
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex gap-2">
            <div
              className={`px-3 py-1.5 text-[10px] font-medium ${animations ? "transition-all" : ""}`}
              style={{ background: pDark, borderRadius: rSm, color: `oklch(0.13 0.02 ${hue})` }}
            >
              主要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px] font-medium"
              style={{
                background: `oklch(0.35 0.1 ${accentHue})`,
                borderRadius: rSm,
                color: `oklch(0.92 0.05 ${accentHue})`,
              }}
            >
              次要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px]"
              style={{ border: `1px solid ${borderDark}`, borderRadius: rSm, color: mutedFgDark }}
            >
              描边按钮
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-7 px-2 flex items-center text-[10px]"
              style={{
                border: `1px solid ${borderDark}`,
                borderRadius: rSm,
                color: mutedFgDark,
                background: `oklch(1 0 0 / 15%)`,
              }}
            >
              输入框...
            </div>
            <div className="h-4 w-8 rounded-full" style={{ background: pDark }} />
          </div>
          <div
            className="p-2.5"
            style={{
              background: cardDarkAlpha(Math.round(glassOpacity * 100)),
              borderRadius: rSm,
              border: `1px solid ${borderDark}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="h-2 w-3/4 rounded-full mb-1.5"
              style={{ background: `oklch(0.95 0.01 ${hue})`, opacity: 0.7 }}
            />
            <div className="h-2 w-1/2 rounded-full" style={{ background: mutedFgDark, opacity: 0.4 }} />
          </div>
          <div className="flex gap-1.5">
            {[hue, accentHue, (hue + 85) % 360, (hue + 135) % 360].map((ch, i) => (
              <div
                key={i}
                className="flex-1 h-6 rounded-sm"
                style={{ background: `oklch(0.7 0.2 ${ch})`, borderRadius: rSm, opacity: 0.8 }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">保存后全站生效，刷新页面查看完整效果</p>
    </div>
  );
}

interface SearchEngineStatus {
  indexnow: { configured: boolean; keyFile: string | null };
  google: { configured: boolean; note: string | null };
}

export default function AdminSettingsPage() {
  const utils = trpc.useUtils();
  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    refetch,
  } = trpc.admin.getSiteConfig.useQuery(undefined, {
    enabled: !!permissions?.scopes.includes("settings:manage"),
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const configInitRef = useRef(false);

  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: (data) => {
      toast.success("配置已保存");
      resetFormFromConfig(data);
      utils.admin.getSiteConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "保存失败");
    },
  });

  const exportConfig = trpc.admin.exportSiteConfig.useQuery(undefined, {
    enabled: false,
  });

  const importConfig = trpc.admin.importSiteConfig.useMutation({
    onSuccess: async (result) => {
      toast.success(`已还原 ${result.imported} 项配置`);
      const { data } = await refetch();
      if (data) resetFormFromConfig(data);
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

  const { data: engineStatus = null } = useQuery<SearchEngineStatus>({
    queryKey: ["indexnow-status"],
    queryFn: () =>
      fetch("/api/indexnow")
        .then((res) => res.json())
        .catch(() => ({
          indexnow: { configured: false, keyFile: null },
          google: { configured: false, note: null },
        })),
    staleTime: 60 * 1000,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentDays, setRecentDays] = useState(7);
  const [lastResult, setLastResult] = useState<{ type: string; message: string; time: Date } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useTabParam("basic");

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    shouldUnregister: false,
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
      requireLoginToComment: false,
      requireEmailVerify: false,
      sectionVideoEnabled: true,
      sectionImageEnabled: true,
      sectionGameEnabled: true,
      videoSortOptions: "latest,views,likes",
      gameSortOptions: "latest,views,likes",
      imageSortOptions: "latest,views",
      videoDefaultSort: "latest",
      gameDefaultSort: "latest",
      imageDefaultSort: "latest",
      videoSelectorMode: "series" as const,
      videosPerPage: 20,
      commentsPerPage: 20,
      maxUploadSize: 500,
      allowedVideoFormats: "mp4,webm,m3u8",
      adminBatchLimit: 10000,
      contactEmail: "",
      privacyPolicy: "",
      termsOfService: "",
      aboutPage: "",
      footerText: "",
      icpBeian: "",
      publicSecurityBeian: "",
      captchaLogin: "math",
      captchaRegister: "none",
      captchaComment: "none",
      captchaForgotPassword: "none",
      turnstileSiteKey: "",
      turnstileSecretKey: "",
      recaptchaSiteKey: "",
      recaptchaSecretKey: "",
      hcaptchaSiteKey: "",
      hcaptchaSecretKey: "",
      mailSendMode: "smtp",
      smtpHost: "",
      smtpPort: 465,
      smtpUser: "",
      smtpPassword: "",
      smtpFrom: "",
      mailApiUrl: "",
      mailApiKey: "",
      mailApiFrom: "",
      mailApiHeaders: "",
      uploadDir: "./uploads",
      indexNowKey: "",
      googleServiceAccountEmail: "",
      googlePrivateKey: "",
      storageProvider: "local",
      storageEndpoint: "",
      storageBucket: "",
      storageRegion: "",
      storageAccessKey: "",
      storageSecretKey: "",
      storageCustomDomain: "",
      storagePathPrefix: "",
      themeHue: 285,
      themeColorTemp: 0,
      themeBorderRadius: 0.625,
      themeGlassOpacity: 0.7,
      themeAnimations: true,
      animationSpeed: 1.0,
      animationPageTransition: true,
      animationStagger: true,
      animationHover: true,
      animationDialog: true,
      animationTab: true,
      animationPreset: "standard" as const,
      effectEnabled: true,
      effectType: "sakura",
      effectDensity: 50,
      effectSpeed: 1.0,
      effectOpacity: 0.8,
      effectColor: "",
      soundDefaultEnabled: true,
      oauthGoogleClientId: "",
      oauthGoogleClientSecret: "",
      oauthGithubClientId: "",
      oauthGithubClientSecret: "",
      oauthDiscordClientId: "",
      oauthDiscordClientSecret: "",
      oauthAppleClientId: "",
      oauthAppleClientSecret: "",
      oauthTwitterClientId: "",
      oauthTwitterClientSecret: "",
      oauthFacebookClientId: "",
      oauthFacebookClientSecret: "",
      oauthMicrosoftClientId: "",
      oauthMicrosoftClientSecret: "",
      oauthTwitchClientId: "",
      oauthTwitchClientSecret: "",
      oauthSpotifyClientId: "",
      oauthSpotifyClientSecret: "",
      oauthLinkedinClientId: "",
      oauthLinkedinClientSecret: "",
      oauthGitlabClientId: "",
      oauthGitlabClientSecret: "",
      oauthRedditClientId: "",
      oauthRedditClientSecret: "",
      usdtPaymentEnabled: false,
      usdtWalletAddress: "",
      usdtPointsPerUnit: 10000,
      usdtOrderTimeoutMin: 30,
      usdtMinAmount: null,
      usdtMaxAmount: null,
    },
  });

  const resetFormFromConfig = useCallback(
    (cfg: SiteConfig) => {
      if (!cfg) return;
      form.reset({
        siteName: cfg.siteName,
        siteUrl: (cfg.siteUrl as string) || "",
        siteDescription: cfg.siteDescription || "",
        siteLogo: cfg.siteLogo || "",
        siteFavicon: cfg.siteFavicon || "",
        siteKeywords: cfg.siteKeywords || "",
        googleVerification: (cfg.googleVerification as string) || "",
        githubUrl: (cfg.githubUrl as string) || "",
        securityEmail: (cfg.securityEmail as string) || "",
        announcement: cfg.announcement || "",
        announcementEnabled: cfg.announcementEnabled,
        allowRegistration: cfg.allowRegistration,
        allowUpload: cfg.allowUpload,
        allowComment: cfg.allowComment,
        requireLoginToComment: cfg.requireLoginToComment ?? false,
        requireEmailVerify: cfg.requireEmailVerify,
        sectionVideoEnabled: cfg.sectionVideoEnabled ?? true,
        sectionImageEnabled: cfg.sectionImageEnabled ?? true,
        sectionGameEnabled: cfg.sectionGameEnabled ?? true,
        videoSortOptions: (cfg.videoSortOptions as string) || "latest,views,likes",
        gameSortOptions: (cfg.gameSortOptions as string) || "latest,views,likes",
        imageSortOptions: (cfg.imageSortOptions as string) || "latest,views",
        videoDefaultSort: (cfg.videoDefaultSort as string) || "latest",
        gameDefaultSort: (cfg.gameDefaultSort as string) || "latest",
        imageDefaultSort: (cfg.imageDefaultSort as string) || "latest",
        videoSelectorMode: (["series", "author", "uploader", "disabled"] as const).includes(
          cfg.videoSelectorMode as "series" | "author" | "uploader" | "disabled",
        )
          ? (cfg.videoSelectorMode as "series" | "author" | "uploader" | "disabled")
          : "series",
        videosPerPage: cfg.videosPerPage,
        commentsPerPage: cfg.commentsPerPage,
        maxUploadSize: cfg.maxUploadSize,
        allowedVideoFormats: cfg.allowedVideoFormats,
        adminBatchLimit: (cfg.adminBatchLimit as number) ?? 10000,
        contactEmail: cfg.contactEmail || "",
        privacyPolicy: (cfg.privacyPolicy as string) || "",
        termsOfService: (cfg.termsOfService as string) || "",
        aboutPage: (cfg.aboutPage as string) || "",
        footerText: cfg.footerText || "",
        icpBeian: cfg.icpBeian || "",
        publicSecurityBeian: cfg.publicSecurityBeian || "",
        captchaLogin: validEnum(
          cfg.captchaLogin,
          ["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"] as const,
          "math",
        ),
        captchaRegister: validEnum(
          cfg.captchaRegister,
          ["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"] as const,
          "none",
        ),
        captchaComment: validEnum(
          cfg.captchaComment,
          ["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"] as const,
          "none",
        ),
        captchaForgotPassword: validEnum(
          cfg.captchaForgotPassword,
          ["none", "math", "slider", "turnstile", "recaptcha", "hcaptcha"] as const,
          "none",
        ),
        turnstileSiteKey: (cfg.turnstileSiteKey as string) || "",
        turnstileSecretKey: (cfg.turnstileSecretKey as string) || "",
        recaptchaSiteKey: (cfg.recaptchaSiteKey as string) || "",
        recaptchaSecretKey: (cfg.recaptchaSecretKey as string) || "",
        hcaptchaSiteKey: (cfg.hcaptchaSiteKey as string) || "",
        hcaptchaSecretKey: (cfg.hcaptchaSecretKey as string) || "",
        mailSendMode: validEnum(cfg.mailSendMode, ["smtp", "http_api"] as const, "smtp"),
        smtpHost: (cfg.smtpHost as string) || "",
        smtpPort: (cfg.smtpPort as number) ?? 465,
        smtpUser: (cfg.smtpUser as string) || "",
        smtpPassword: (cfg.smtpPassword as string) || "",
        smtpFrom: (cfg.smtpFrom as string) || "",
        mailApiUrl: (cfg.mailApiUrl as string) || "",
        mailApiKey: (cfg.mailApiKey as string) || "",
        mailApiFrom: (cfg.mailApiFrom as string) || "",
        mailApiHeaders: (cfg.mailApiHeaders as string) || "",
        uploadDir: (cfg.uploadDir as string) || "./uploads",
        indexNowKey: (cfg.indexNowKey as string) || "",
        googleServiceAccountEmail: (cfg.googleServiceAccountEmail as string) || "",
        googlePrivateKey: (cfg.googlePrivateKey as string) || "",
        storageProvider: validEnum(cfg.storageProvider, ["local", "s3", "r2", "minio", "oss", "cos"] as const, "local"),
        storageEndpoint: (cfg.storageEndpoint as string) || "",
        storageBucket: (cfg.storageBucket as string) || "",
        storageRegion: (cfg.storageRegion as string) || "",
        storageAccessKey: (cfg.storageAccessKey as string) || "",
        storageSecretKey: (cfg.storageSecretKey as string) || "",
        storageCustomDomain: (cfg.storageCustomDomain as string) || "",
        storagePathPrefix: (cfg.storagePathPrefix as string) || "",
        themeHue: (cfg.themeHue as number) ?? 285,
        themeColorTemp: (cfg.themeColorTemp as number) ?? 0,
        themeBorderRadius: (cfg.themeBorderRadius as number) ?? 0.625,
        themeGlassOpacity: (cfg.themeGlassOpacity as number) ?? 0.7,
        themeAnimations: (cfg.themeAnimations as boolean) ?? true,
        animationSpeed: (cfg.animationSpeed as number) ?? 1.0,
        animationPageTransition: (cfg.animationPageTransition as boolean) ?? true,
        animationStagger: (cfg.animationStagger as boolean) ?? true,
        animationHover: (cfg.animationHover as boolean) ?? true,
        animationDialog: (cfg.animationDialog as boolean) ?? true,
        animationTab: (cfg.animationTab as boolean) ?? true,
        animationPreset: validEnum(cfg.animationPreset, ["minimal", "standard", "rich"] as const, "standard"),
        effectEnabled: (cfg.effectEnabled as boolean) ?? true,
        effectType: validEnum(
          cfg.effectType,
          ["sakura", "firefly", "snow", "stars", "aurora", "cyber", "none"] as const,
          "sakura",
        ),
        effectDensity: (cfg.effectDensity as number) ?? 50,
        effectSpeed: (cfg.effectSpeed as number) ?? 1.0,
        effectOpacity: (cfg.effectOpacity as number) ?? 0.8,
        effectColor: (cfg.effectColor as string) || "",
        soundDefaultEnabled: (cfg.soundDefaultEnabled as boolean) ?? true,
        analyticsGoogleId: (cfg.analyticsGoogleId as string) || "",
        analyticsGtmId: (cfg.analyticsGtmId as string) || "",
        analyticsCfToken: (cfg.analyticsCfToken as string) || "",
        analyticsClarityId: (cfg.analyticsClarityId as string) || "",
        analyticsBingVerification: (cfg.analyticsBingVerification as string) || "",
        usdtPaymentEnabled: (cfg.usdtPaymentEnabled as boolean) ?? false,
        usdtWalletAddress: (cfg.usdtWalletAddress as string) || "",
        usdtPointsPerUnit: (cfg.usdtPointsPerUnit as number) ?? 10000,
        usdtOrderTimeoutMin: (cfg.usdtOrderTimeoutMin as number) ?? 30,
        usdtMinAmount: (cfg.usdtMinAmount as number) ?? null,
        usdtMaxAmount: (cfg.usdtMaxAmount as number) ?? null,
        ...Object.fromEntries(
          [
            "Google",
            "Github",
            "Discord",
            "Apple",
            "Twitter",
            "Facebook",
            "Microsoft",
            "Twitch",
            "Spotify",
            "Linkedin",
            "Gitlab",
            "Reddit",
          ].flatMap((k) => [
            [`oauth${k}ClientId`, ((cfg as Record<string, unknown>)[`oauth${k}ClientId`] as string) || ""],
            [`oauth${k}ClientSecret`, ((cfg as Record<string, unknown>)[`oauth${k}ClientSecret`] as string) || ""],
          ]),
        ),
      });
    },
    [form],
  );

  // 仅在首次加载配置时初始化表单，避免 query refetch 导致未保存的修改被清除
  useEffect(() => {
    if (config && !configInitRef.current) {
      configInitRef.current = true;
      resetFormFromConfig(config);
    }
  }, [config, resetFormFromConfig]);

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
    const dirtyFields = form.formState.dirtyFields;
    const dirtyKeys = Object.keys(dirtyFields).filter((key) => (dirtyFields as Record<string, unknown>)[key]);

    if (dirtyKeys.length === 0) {
      toast.info("没有修改");
      return;
    }

    const dirtyValues = Object.fromEntries(dirtyKeys.map((key) => [key, (values as Record<string, unknown>)[key]]));

    updateConfig.mutate(dirtyValues as ConfigFormValues);
  };

  const onFormError = (errors: Record<string, unknown>) => {
    const keys = Object.keys(errors);
    if (keys.length > 0) {
      const details = keys
        .map((k) => {
          const err = errors[k] as { message?: string } | undefined;
          return err?.message ? `${k}: ${err.message}` : k;
        })
        .join("; ");
      console.error("[设置表单验证失败]", errors);
      toast.error(`表单验证失败：${details}`);
    }
  };

  if (!permissions?.scopes.includes("settings:manage")) {
    return <div className="flex items-center justify-center h-[400px] text-muted-foreground">您没有系统设置权限</div>;
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
          <p className="text-muted-foreground mt-1">配置网站的系统参数</p>
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
                  <p className="mt-2 text-xs">配置备份时间：{new Date(pendingImport._exportedAt).toLocaleString()}</p>
                )}
                {Array.isArray(pendingImport?._friendLinks) && (
                  <p className="mt-1 text-xs">包含 {(pendingImport._friendLinks as unknown[]).length} 条友情链接</p>
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

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation="vertical"
        className="flex-col md:flex-row md:gap-6 gap-4"
      >
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-48 shrink-0">
          <TabsList
            variant="line"
            className="flex flex-col h-auto w-full items-stretch bg-transparent p-0 gap-0.5 sticky top-20"
          >
            <span className="text-xs font-medium text-muted-foreground/70 px-3 py-1.5 select-none">通用</span>
            <TabsTrigger value="basic" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <Info className="h-3.5 w-3.5" /> 基本信息
            </TabsTrigger>
            <TabsTrigger value="features" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <ToggleLeft className="h-3.5 w-3.5" /> 功能开关
            </TabsTrigger>
            <TabsTrigger value="content" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <FileText className="h-3.5 w-3.5" /> 内容设置
            </TabsTrigger>

            <span className="text-xs font-medium text-muted-foreground/70 px-3 py-1.5 mt-3 select-none">外观</span>
            <TabsTrigger value="theme" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <Palette className="h-3.5 w-3.5" /> 样式
            </TabsTrigger>
            <TabsTrigger value="effects" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <Sparkles className="h-3.5 w-3.5" /> 视觉效果
            </TabsTrigger>

            <span className="text-xs font-medium text-muted-foreground/70 px-3 py-1.5 mt-3 select-none">页面</span>
            <TabsTrigger value="pages" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <ScrollText className="h-3.5 w-3.5" /> 页面管理
            </TabsTrigger>
            <TabsTrigger value="footer" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <Link2 className="h-3.5 w-3.5" /> 页脚
            </TabsTrigger>
            <span className="text-xs font-medium text-muted-foreground/70 px-3 py-1.5 mt-3 select-none">
              安全与认证
            </span>
            <TabsTrigger value="captcha" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <ShieldCheck className="h-3.5 w-3.5" /> 验证码
            </TabsTrigger>
            <TabsTrigger value="oauth" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <KeyRound className="h-3.5 w-3.5" /> 登录
            </TabsTrigger>
            <TabsTrigger value="email" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <Mail className="h-3.5 w-3.5" /> 邮件
            </TabsTrigger>

            <span className="text-xs font-medium text-muted-foreground/70 px-3 py-1.5 mt-3 select-none">集成</span>
            <TabsTrigger value="storage" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <HardDrive className="h-3.5 w-3.5" /> 存储
            </TabsTrigger>
            <TabsTrigger value="seo" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <Search className="h-3.5 w-3.5" /> SEO
            </TabsTrigger>
            <TabsTrigger value="analytics" className="justify-start gap-2 px-3 h-8 text-[13px]">
              <BarChart3 className="h-3.5 w-3.5" /> 统计
            </TabsTrigger>
          </TabsList>
        </aside>

        {/* Mobile select */}
        <div className="md:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>通用</SelectLabel>
                <SelectItem value="basic">基本信息</SelectItem>
                <SelectItem value="features">功能开关</SelectItem>
                <SelectItem value="content">内容设置</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>外观</SelectLabel>
                <SelectItem value="theme">样式</SelectItem>
                <SelectItem value="effects">视觉效果</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>页面</SelectLabel>
                <SelectItem value="pages">页面管理</SelectItem>
                <SelectItem value="footer">页脚</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>安全与认证</SelectLabel>
                <SelectItem value="captcha">验证码</SelectItem>
                <SelectItem value="oauth">登录</SelectItem>
                <SelectItem value="email">邮件</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>集成</SelectLabel>
                <SelectItem value="storage">存储</SelectItem>
                <SelectItem value="seo">SEO</SelectItem>
                <SelectItem value="analytics">统计</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
              {/* 基本信息 */}
              <TabsContent value="basic" forceMount className="data-[state=inactive]:hidden">
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
                          <FormDescription>
                            站点的访问地址，用于生成 SEO、Sitemap、RSS 等。留空则使用 .env 中的 NEXT_PUBLIC_APP_URL
                          </FormDescription>
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
              <TabsContent value="features" forceMount className="data-[state=inactive]:hidden">
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

                {/* 内容分区开关 */}
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

                {/* 分区排序选项 */}
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>排序选项</CardTitle>
                    <CardDescription>配置各分区列表页可用的排序方式及默认排序</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {(
                      [
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
                      ] as const
                    ).map((section) => {
                      const allOptions = [
                        { id: "latest", label: "最新" },
                        { id: "views", label: "热门" },
                        { id: "likes", label: "高赞" },
                        { id: "titleAsc", label: "标题 A→Z" },
                        { id: "titleDesc", label: "标题 Z→A" },
                      ];
                      return (
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
                                const newValue = allOptions
                                  .map((o) => o.id)
                                  .filter((k) => next.has(k))
                                  .join(",");
                                field.onChange(newValue);
                                const currentDefault = form.getValues(section.defaultName);
                                if (!next.has(currentDefault)) {
                                  form.setValue(section.defaultName, [...next][0]);
                                }
                              };
                              return (
                                <FormItem>
                                  <FormLabel>{section.label}</FormLabel>
                                  <div className="flex flex-wrap gap-2 mt-1.5">
                                    {allOptions.map((opt) => (
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
                              const enabledOptions = allOptions.filter((o) => enabledKeys.includes(o.id));
                              return (
                                <FormItem>
                                  <div className="flex items-center gap-2">
                                    <FormLabel className="text-xs text-muted-foreground whitespace-nowrap">
                                      默认排序
                                    </FormLabel>
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
                      );
                    })}

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

                {/* USDT 支付配置 */}
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

              {/* 个性化样式 */}
              <TabsContent value="theme" forceMount className="data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {/* 左侧：设置控件 */}
                  <div className="xl:col-span-2 space-y-4">
                    {/* 主题色 */}
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
                              <div className="flex items-center justify-between mb-2">
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
                                  onClick={() => field.onChange(285)}
                                >
                                  重置
                                </Button>
                              </div>
                              <FormControl>
                                <div
                                  className="relative h-3 rounded-full cursor-pointer"
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
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white shadow-md pointer-events-none"
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
                                    { hue: 0, label: "红", emoji: "🔴" },
                                    { hue: 25, label: "橙", emoji: "🟠" },
                                    { hue: 60, label: "黄", emoji: "🟡" },
                                    { hue: 145, label: "绿", emoji: "🟢" },
                                    { hue: 200, label: "蓝", emoji: "🔵" },
                                    { hue: 270, label: "紫", emoji: "🟣" },
                                    { hue: 285, label: "默认", emoji: "💜" },
                                    { hue: 330, label: "粉", emoji: "🩷" },
                                  ] as const
                                ).map(({ hue, label }) => (
                                  <button
                                    key={hue}
                                    type="button"
                                    onClick={() => field.onChange(hue)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-all ${
                                      field.value === hue
                                        ? "border-foreground/30 bg-foreground/5 font-medium"
                                        : "border-transparent hover:border-border hover:bg-muted/50"
                                    }`}
                                  >
                                    <span
                                      className="h-3 w-3 rounded-full shrink-0"
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

                    {/* 色温 & 圆角 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="flex items-center justify-between mb-2">
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
                                    className="relative h-3 rounded-full cursor-pointer"
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
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white shadow-md bg-background pointer-events-none"
                                      style={{
                                        left: `calc(${((field.value + 100) / 200) * 100}% - 10px)`,
                                      }}
                                    />
                                  </div>
                                </FormControl>
                                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
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
                                <div className="flex items-center justify-between mb-2">
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
                                    className="w-full accent-primary h-1.5"
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
                                      className={`flex-1 h-8 border text-[10px] transition-all ${
                                        Math.abs(field.value - v) < 0.01
                                          ? "border-primary bg-primary/10 text-primary font-medium"
                                          : "border-border hover:border-primary/50"
                                      }`}
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

                    {/* 透明度 & 动画 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="flex items-center justify-between mb-2">
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
                                    className="w-full accent-primary h-1.5"
                                  />
                                </FormControl>
                                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                                  <span>全透明</span>
                                  <span>半透明</span>
                                  <span>不透明</span>
                                </div>
                                {/* 玻璃态预览 */}
                                <div
                                  className="mt-3 relative overflow-hidden rounded-lg h-16"
                                  style={{
                                    background: "linear-gradient(135deg, oklch(0.6 0.24 285), oklch(0.5 0.2 330))",
                                  }}
                                >
                                  <div
                                    className="absolute inset-2 rounded-md flex items-center justify-center text-xs text-foreground"
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
                          {/* 总开关 */}
                          <FormField
                            control={form.control}
                            name="themeAnimations"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm">启用界面动画</FormLabel>
                                    <FormDescription className="text-xs">
                                      关闭后禁用所有过渡和关键帧动画
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                </div>
                                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                                  <div
                                    className={`h-3 w-3 rounded-full bg-primary ${field.value ? "animate-pulse" : ""}`}
                                  />
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
                              {/* 预设方案 */}
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
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                                      <div className="mt-2 flex gap-1">
                                        {[...Array(value === "minimal" ? 1 : value === "standard" ? 2 : 3)].map(
                                          (_, i) => (
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
                                          ),
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 速度倍率 */}
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

                              {/* 分类开关 */}
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

                    {/* 预设主题 */}
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">预设主题</CardTitle>
                        <CardDescription>一键应用预设的配色方案</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(
                            [
                              { label: "默认紫", hue: 285, temp: 0, radius: 0.625, desc: "经典 ACGN 紫" },
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
                              className={`group relative overflow-hidden rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                                form.watch("themeHue") === hue && form.watch("themeColorTemp") === temp
                                  ? "border-primary ring-1 ring-primary/30"
                                  : "border-border hover:border-primary/40"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <div
                                  className="h-4 w-4 rounded-full shrink-0"
                                  style={{ background: `oklch(0.6 0.24 ${hue})` }}
                                />
                                <span className="text-sm font-medium">{label}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
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
                      <Button type="submit" disabled={updateConfig.isPending}>
                        {updateConfig.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        保存设置
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          form.setValue("themeHue", 285, { shouldDirty: true });
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

                  {/* 右侧：实时预览 */}
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
              </TabsContent>

              {/* 验证码设置 */}
              <TabsContent value="captcha" forceMount className="data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      验证码 / 人机验证
                    </CardTitle>
                    <CardDescription>
                      为不同场景配置验证码方式。支持本地验证（数学、滑块）和第三方平台（Turnstile、reCAPTCHA、hCaptcha）。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 快速统一设置 */}
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                      <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">统一设置所有场景</span>
                      <Select
                        onValueChange={(v) => {
                          const val = v as "none" | "math" | "slider" | "turnstile" | "recaptcha" | "hcaptcha";
                          form.setValue("captchaLogin", val, { shouldDirty: true });
                          form.setValue("captchaRegister", val, { shouldDirty: true });
                          form.setValue("captchaComment", val, { shouldDirty: true });
                          form.setValue("captchaForgotPassword", val, { shouldDirty: true });
                        }}
                      >
                        <SelectTrigger className="w-52">
                          <SelectValue placeholder="选择类型..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">全部关闭</SelectItem>
                          <SelectItem value="math">全部数学验证码</SelectItem>
                          <SelectItem value="slider">全部滑块验证</SelectItem>
                          <SelectItem value="turnstile">全部 Turnstile</SelectItem>
                          <SelectItem value="recaptcha">全部 reCAPTCHA</SelectItem>
                          <SelectItem value="hcaptcha">全部 hCaptcha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 第三方密钥缺失警告 */}
                    {(() => {
                      const vals = [
                        form.watch("captchaLogin"),
                        form.watch("captchaRegister"),
                        form.watch("captchaComment"),
                        form.watch("captchaForgotPassword"),
                      ];
                      const warnings: string[] = [];
                      if (
                        vals.includes("turnstile") &&
                        (!form.watch("turnstileSiteKey")?.trim() || !form.watch("turnstileSecretKey")?.trim())
                      ) {
                        warnings.push("Turnstile 密钥未配置");
                      }
                      if (
                        vals.includes("recaptcha") &&
                        (!form.watch("recaptchaSiteKey")?.trim() || !form.watch("recaptchaSecretKey")?.trim())
                      ) {
                        warnings.push("reCAPTCHA 密钥未配置");
                      }
                      if (
                        vals.includes("hcaptcha") &&
                        (!form.watch("hcaptchaSiteKey")?.trim() || !form.watch("hcaptchaSecretKey")?.trim())
                      ) {
                        warnings.push("hCaptcha 密钥未配置");
                      }
                      if (warnings.length === 0) return null;
                      return (
                        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
                          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{warnings.join("、")}。未配置密钥时前端将自动跳过验证，请在下方填写对应平台密钥。</span>
                        </div>
                      );
                    })()}

                    {/* 各场景验证码选择器 */}
                    <div className="space-y-4">
                      {[
                        { name: "captchaLogin" as const, label: "登录", desc: "用户登录时需要完成的验证" },
                        {
                          name: "captchaRegister" as const,
                          label: "注册",
                          desc: "用户注册时需要完成的验证（邮箱验证码独立于此设置）",
                        },
                        { name: "captchaComment" as const, label: "评论", desc: "用户发表评论时需要完成的验证" },
                        {
                          name: "captchaForgotPassword" as const,
                          label: "忘记密码",
                          desc: "用户重置密码时需要完成的验证",
                        },
                      ].map(({ name, label, desc }) => {
                        const captchaLabels: Record<string, string> = {
                          none: "关闭",
                          math: "数学",
                          slider: "滑块",
                          turnstile: "Turnstile",
                          recaptcha: "reCAPTCHA",
                          hcaptcha: "hCaptcha",
                        };
                        return (
                          <FormField
                            key={name}
                            control={form.control}
                            name={name}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  {label}
                                  <Badge
                                    variant={field.value === "none" ? "outline" : "default"}
                                    className="text-[10px] px-1.5 py-0 font-normal"
                                  >
                                    {captchaLabels[field.value] ?? field.value}
                                  </Badge>
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="选择验证码类型" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">无验证</SelectItem>
                                    <SelectItem value="math">数学验证码</SelectItem>
                                    <SelectItem value="slider">滑块验证</SelectItem>
                                    <SelectItem value="turnstile">Cloudflare Turnstile</SelectItem>
                                    <SelectItem value="recaptcha">Google reCAPTCHA v2</SelectItem>
                                    <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>{desc}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Cloudflare Turnstile */}
                    <div className="border-t pt-6 space-y-4">
                      <h4 className="font-medium">Cloudflare Turnstile 配置</h4>
                      <FormDescription className="mt-0">
                        在{" "}
                        <a
                          href="https://dash.cloudflare.com/?to=/:account/turnstile"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Cloudflare Dashboard
                        </a>{" "}
                        创建 Turnstile 站点后获取密钥。
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="turnstileSiteKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="0x..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="turnstileSecretKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secret Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} type="password" placeholder="0x..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Google reCAPTCHA */}
                    <div className="border-t pt-6 space-y-4">
                      <h4 className="font-medium">Google reCAPTCHA v2 配置</h4>
                      <FormDescription className="mt-0">
                        在{" "}
                        <a
                          href="https://www.google.com/recaptcha/admin"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Google reCAPTCHA 管理后台
                        </a>{" "}
                        创建 v2 (Checkbox) 类型站点后获取密钥。
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="recaptchaSiteKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="6Le..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="recaptchaSecretKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secret Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} type="password" placeholder="6Le..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* hCaptcha */}
                    <div className="border-t pt-6 space-y-4">
                      <h4 className="font-medium">hCaptcha 配置</h4>
                      <FormDescription className="mt-0">
                        在{" "}
                        <a
                          href="https://dashboard.hcaptcha.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          hCaptcha Dashboard
                        </a>{" "}
                        创建站点后获取密钥。hCaptcha 注重隐私保护，是 reCAPTCHA 的替代方案。
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="hcaptchaSiteKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="站点密钥" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="hcaptchaSecretKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secret Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} type="password" placeholder="密钥" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">验证码类型说明</p>
                      <ul className="list-disc list-inside text-xs space-y-0.5">
                        <li>
                          <strong>无验证</strong>：不需要任何额外验证
                        </li>
                        <li>
                          <strong>数学验证码</strong>：本地生成，答案通过 HMAC 签名验证，无需外部服务
                        </li>
                        <li>
                          <strong>滑块验证</strong>：本地拖拽交互验证，无需外部服务，体验友好
                        </li>
                        <li>
                          <strong>Cloudflare Turnstile</strong>：无感人机验证，需配置 Cloudflare 密钥
                        </li>
                        <li>
                          <strong>Google reCAPTCHA v2</strong>：复选框人机验证，需配置 Google 密钥
                        </li>
                        <li>
                          <strong>hCaptcha</strong>：注重隐私的人机验证，需配置 hCaptcha 密钥
                        </li>
                      </ul>
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

              {/* 视觉效果 */}
              <TabsContent value="effects" forceMount className="data-[state=inactive]:hidden">
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
              <TabsContent value="content" forceMount className="data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle>内容设置</CardTitle>
                    <CardDescription>配置内容相关的参数</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="videoSelectorMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>播放页选集器模式</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full md:w-64">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="series">合集</SelectItem>
                              <SelectItem value="author">原作者</SelectItem>
                              <SelectItem value="uploader">上传者</SelectItem>
                              <SelectItem value="disabled">关闭</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            控制播放页右侧选集器按什么维度聚合视频：合集（Series 剧集）、原作者（extraInfo 中的 author
                            字段）、上传者（UP 主）、或关闭
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                      <FormField
                        control={form.control}
                        name="adminBatchLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>后台批量操作上限</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 10000)}
                              />
                            </FormControl>
                            <FormDescription>批量转移、删除等操作的最大数量</FormDescription>
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

              {/* 邮件配置 */}
              <TabsContent value="email" forceMount className="data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      邮件配置
                    </CardTitle>
                    <CardDescription>支持 SMTP 与 HTTP API 两种发送方式，用于验证码、通知等邮件发送。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="mailSendMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>发送方式</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="选择邮件发送方式" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="smtp">SMTP</SelectItem>
                                <SelectItem value="http_api">HTTP API</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>选择 SMTP 直连邮箱服务，或通过 HTTP API 网关发送邮件。</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("mailSendMode") === "smtp" ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="smtpHost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP 主机</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="smtp.example.com" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="smtpPort"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP 端口</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    min={1}
                                    max={65535}
                                    value={field.value ?? 465}
                                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 465)}
                                  />
                                </FormControl>
                                <FormDescription>通常为 465 (SSL) 或 587 (TLS)</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="smtpUser"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP 用户名</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="user@example.com" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="smtpPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP 密码</FormLabel>
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
                          name="smtpFrom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>发件人地址</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="noreply@example.com" />
                              </FormControl>
                              <FormDescription>发件人邮箱地址</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <>
                        <FormField
                          control={form.control}
                          name="mailApiUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>HTTP API 地址</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="https://api.example.com/send-email"
                                />
                              </FormControl>
                              <FormDescription>将以 POST JSON 方式调用该接口发送邮件</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="mailApiFrom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>发件人地址</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} placeholder="noreply@example.com" />
                                </FormControl>
                                <FormDescription>用于构造 From 字段</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="mailApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Key（可选）</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ""} type="password" placeholder="sk-xxxxxx" />
                                </FormControl>
                                <FormDescription>未配置 Authorization 时将自动使用 Bearer</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="mailApiHeaders"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>自定义请求头（JSON，可选）</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value || ""}
                                  rows={4}
                                  placeholder={'{"X-API-KEY":"your-key","Authorization":"Bearer xxx"}'}
                                />
                              </FormControl>
                              <FormDescription>仅支持 JSON 对象，值需为字符串</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        上传设置
                      </h4>
                      <FormField
                        control={form.control}
                        name="uploadDir"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>上传目录</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="./uploads" />
                            </FormControl>
                            <FormDescription>本地文件上传的存储路径，相对于项目根目录</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="submit" disabled={updateConfig.isPending}>
                        {updateConfig.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        保存设置
                      </Button>
                      <TestEmailButton />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 对象存储 */}
              <TabsContent value="storage" forceMount className="data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5" />
                      对象存储
                    </CardTitle>
                    <CardDescription>
                      配置 S3
                      兼容的对象存储服务，用于存放图片、视频封面等静态资源。切换为对象存储后，新上传的文件将保存至远程存储桶。
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
                              <FormDescription>
                                S3 兼容的端点地址，如 https://s3.us-east-1.amazonaws.com
                              </FormDescription>
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
                              <FormDescription>
                                用于替换默认的存储桶域名，设置后文件公开链接将使用此域名
                              </FormDescription>
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

              {/* 页面内容 */}
              <TabsContent value="pages" forceMount className="data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      页面内容管理
                    </CardTitle>
                    <CardDescription>
                      编辑隐私政策、服务条款、关于我们等页面内容，支持 MDX 格式（Markdown +
                      JSX）。配置后将自动在页脚显示对应链接。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="privacyPolicy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>隐私政策</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder={
                                "# 隐私政策\n\n本网站非常重视用户的隐私保护...\n\n## 信息收集\n\n支持 MDX 格式（Markdown + JSX）"
                              }
                              rows={12}
                              className="font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>留空则不显示隐私政策页面。访问路径：/privacy</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="termsOfService"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>服务条款</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder={
                                "# 服务条款\n\n欢迎使用本网站提供的服务...\n\n## 使用规则\n\n支持 MDX 格式（Markdown + JSX）"
                              }
                              rows={12}
                              className="font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>留空则不显示服务条款页面。访问路径：/terms</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aboutPage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>关于我们</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder={
                                "# 关于我们\n\n本站是一个 ACGN 内容分享平台...\n\n## 联系方式\n\n支持 MDX 格式（Markdown + JSX）"
                              }
                              rows={12}
                              className="font-mono text-sm"
                            />
                          </FormControl>
                          <FormDescription>留空则不显示关于页面。访问路径：/about</FormDescription>
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

              {/* 页脚备案 */}
              <TabsContent value="footer" forceMount className="data-[state=inactive]:hidden">
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
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="https://github.com/your-org/your-repo"
                            />
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
            </form>
          </Form>

          {/* OAuth 社交登录 */}
          <TabsContent value="oauth" forceMount className="data-[state=inactive]:hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5" />
                      社交登录（OAuth）
                    </CardTitle>
                    <CardDescription>
                      配置第三方 OAuth 提供商，允许用户使用社交账号登录。填入 Client ID 和 Client Secret
                      即可启用，清空则禁用。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {(
                      [
                        {
                          key: "Google",
                          label: "Google",
                          callbackId: "google",
                          url: "https://console.cloud.google.com/apis/credentials",
                          urlLabel: "Google Cloud Console",
                        },
                        {
                          key: "Github",
                          label: "GitHub",
                          callbackId: "github",
                          url: "https://github.com/settings/developers",
                          urlLabel: "GitHub Developer Settings",
                        },
                        {
                          key: "Discord",
                          label: "Discord",
                          callbackId: "discord",
                          url: "https://discord.com/developers/applications",
                          urlLabel: "Discord Developer Portal",
                        },
                        {
                          key: "Apple",
                          label: "Apple",
                          callbackId: "apple",
                          url: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
                          urlLabel: "Apple Developer",
                        },
                        {
                          key: "Twitter",
                          label: "X (Twitter)",
                          callbackId: "twitter",
                          url: "https://developer.x.com/en/portal/dashboard",
                          urlLabel: "X Developer Portal",
                        },
                        {
                          key: "Facebook",
                          label: "Facebook",
                          callbackId: "facebook",
                          url: "https://developers.facebook.com/apps",
                          urlLabel: "Meta for Developers",
                        },
                        {
                          key: "Microsoft",
                          label: "Microsoft",
                          callbackId: "microsoft",
                          url: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
                          urlLabel: "Azure Portal",
                        },
                        {
                          key: "Twitch",
                          label: "Twitch",
                          callbackId: "twitch",
                          url: "https://dev.twitch.tv/console/apps",
                          urlLabel: "Twitch Developer Console",
                        },
                        {
                          key: "Spotify",
                          label: "Spotify",
                          callbackId: "spotify",
                          url: "https://developer.spotify.com/dashboard",
                          urlLabel: "Spotify Developer Dashboard",
                        },
                        {
                          key: "Linkedin",
                          label: "LinkedIn",
                          callbackId: "linkedin",
                          url: "https://www.linkedin.com/developers/apps",
                          urlLabel: "LinkedIn Developer Portal",
                        },
                        {
                          key: "Gitlab",
                          label: "GitLab",
                          callbackId: "gitlab",
                          url: "https://gitlab.com/-/user_settings/applications",
                          urlLabel: "GitLab Applications",
                        },
                        {
                          key: "Reddit",
                          label: "Reddit",
                          callbackId: "reddit",
                          url: "https://www.reddit.com/prefs/apps",
                          urlLabel: "Reddit App Preferences",
                        },
                      ] as const
                    ).map(({ key, label, callbackId, url, urlLabel }, idx) => {
                      const idField = `oauth${key}ClientId` as keyof ConfigFormValues;
                      const secretField = `oauth${key}ClientSecret` as keyof ConfigFormValues;
                      const hasId = form.watch(idField);
                      const hasSecret = form.watch(secretField);
                      return (
                        <div key={key}>
                          {idx > 0 && <div className="border-t mb-4" />}
                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2">
                              {label}
                              {hasId && hasSecret && (
                                <Badge variant="default" className="text-xs">
                                  已启用
                                </Badge>
                              )}
                            </h4>
                            <FormDescription>
                              在{" "}
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {urlLabel}
                              </a>{" "}
                              创建应用。回调 URL：
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">{`{站点URL}/api/auth/callback/${callbackId}`}</code>
                            </FormDescription>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <FormField
                                control={form.control}
                                name={idField}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Client ID</FormLabel>
                                    <FormControl>
                                      <Input {...field} value={(field.value as string) || ""} placeholder="Client ID" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={secretField}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Client Secret</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        value={(field.value as string) || ""}
                                        type="password"
                                        placeholder="••••••••"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">账号关联说明</p>
                      <ul className="list-disc list-inside text-xs space-y-0.5">
                        <li>已启用的提供商将在登录和注册页面显示对应按钮</li>
                        <li>如果 OAuth 登录的邮箱与已有账号一致，将自动关联</li>
                        <li>首次使用 OAuth 登录且邮箱无匹配时将自动创建新账号</li>
                        <li>保存后立即生效，无需重启服务</li>
                      </ul>
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
              </form>
            </Form>
          </TabsContent>

          {/* SEO 搜索引擎 */}
          <TabsContent value="seo" forceMount className="data-[state=inactive]:hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      SEO 设置
                    </CardTitle>
                    <CardDescription>搜索引擎验证和安全联系配置</CardDescription>
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
                          <FormDescription>
                            Google Search Console 的网站验证码，会自动添加到页面 meta 标签中
                          </FormDescription>
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
                            <Input
                              {...field}
                              value={field.value || ""}
                              type="email"
                              placeholder="security@example.com"
                            />
                          </FormControl>
                          <FormDescription>用于 security.txt 中的安全联系方式，留空则不显示</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-3">搜索引擎推送配置</h4>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="indexNowKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IndexNow Key</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} placeholder="your-indexnow-key" />
                              </FormControl>
                              <FormDescription>IndexNow 密钥，用于向 Bing/Yandex 等搜索引擎推送更新</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="googleServiceAccountEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Service Account Email</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="xxx@xxx.iam.gserviceaccount.com"
                                />
                              </FormControl>
                              <FormDescription>Google Search Console 服务账号邮箱</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="googlePrivateKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Google Private Key</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value || ""}
                                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                                  rows={4}
                                  className="font-mono text-xs"
                                />
                              </FormControl>
                              <FormDescription>Google 服务账号私钥（PEM 格式）</FormDescription>
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
              </form>
            </Form>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  搜索引擎推送
                </CardTitle>
                <CardDescription>主动通知搜索引擎索引新内容，加快收录速度</CardDescription>
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
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Globe className="h-4 w-4 mr-1" />
                        )}
                        提交站点页面
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSubmitIndex("recent")}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
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
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        提交全部视频
                      </Button>

                      {engineStatus?.google.configured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSubmitIndex("sitemap")}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Globe className="h-4 w-4 mr-1" />
                          )}
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
                    <p>请在上方「SEO 设置」卡片中配置搜索引擎推送密钥：</p>
                    <ul className="list-disc list-inside text-xs">
                      <li>IndexNow: 填写 IndexNow Key</li>
                      <li>Google: 填写 Service Account Email + Private Key</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 统计分析 */}
          <TabsContent value="analytics" forceMount className="data-[state=inactive]:hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      统计分析
                    </CardTitle>
                    <CardDescription>
                      接入各大分析统计平台，追踪网站流量和用户行为。填入对应平台的 ID/Token 即可启用，留空则不加载。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Globe className="h-4 w-4" />
                        Google Analytics 4
                      </div>
                      <FormField
                        control={form.control}
                        name="analyticsGoogleId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Measurement ID</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="G-XXXXXXXXXX" />
                            </FormControl>
                            <FormDescription>
                              Google Analytics 4 的衡量 ID，可在 GA4 管理面板 &gt; 数据流中找到
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Globe className="h-4 w-4" />
                        Google Tag Manager
                      </div>
                      <FormField
                        control={form.control}
                        name="analyticsGtmId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Container ID</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="GTM-XXXXXXX" />
                            </FormControl>
                            <FormDescription>
                              Google Tag Manager 的容器 ID，可在 GTM 控制台 &gt; 管理 &gt; 容器设置中找到
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Shield className="h-4 w-4" />
                        Cloudflare Web Analytics
                      </div>
                      <FormField
                        control={form.control}
                        name="analyticsCfToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Beacon Token</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              />
                            </FormControl>
                            <FormDescription>
                              Cloudflare Web Analytics 的 beacon token，可在 Cloudflare 控制台 &gt; Web Analytics 中获取
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Search className="h-4 w-4" />
                        Microsoft Clarity
                      </div>
                      <FormField
                        control={form.control}
                        name="analyticsClarityId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project ID</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="xxxxxxxxxx" />
                            </FormControl>
                            <FormDescription>
                              Microsoft Clarity 的项目 ID，可在 Clarity 控制台 &gt; 设置 &gt; 项目信息中找到
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Globe className="h-4 w-4" />
                        Bing Webmaster Tools
                      </div>
                      <FormField
                        control={form.control}
                        name="analyticsBingVerification"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>验证码</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                              />
                            </FormControl>
                            <FormDescription>
                              Bing Webmaster Tools 验证码，会自动生成 meta 标签用于站点验证
                            </FormDescription>
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
              </form>
            </Form>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
