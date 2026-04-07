import { prisma } from "@/lib/prisma";
import type { Ad } from "@/lib/ads";

/** 公开站点配置（不含敏感字段，可安全传给客户端） */
export interface PublicSiteConfig {
  siteName: string;
  siteUrl: string;
  siteDescription: string | null;
  siteLogo: string | null;
  siteFavicon: string | null;
  siteKeywords: string | null;
  googleVerification: string | null;
  githubUrl: string | null;
  securityEmail: string | null;
  announcement: string | null;
  announcementEnabled: boolean;
  allowRegistration: boolean;
  allowUpload: boolean;
  allowComment: boolean;
  requireLoginToComment: boolean;
  contactEmail: string | null;
  socialLinks: Record<string, string> | null;
  privacyPolicy: string | null;
  termsOfService: string | null;
  aboutPage: string | null;
  footerText: string | null;
  footerLinks: Array<{ label: string; url: string }> | null;
  icpBeian: string | null;
  publicSecurityBeian: string | null;
  adsEnabled: boolean;
  adGateEnabled: boolean;
  adGateViewsRequired: number;
  adGateHours: number;
  sponsorAds: Ad[] | null;
  themeHue: number;
  themeColorTemp: number;
  themeBorderRadius: number;
  themeGlassOpacity: number;
  themeAnimations: boolean;
  animationSpeed: number;
  animationPageTransition: boolean;
  animationStagger: boolean;
  animationHover: boolean;
  animationDialog: boolean;
  animationTab: boolean;
  animationPreset: string;
  effectEnabled: boolean;
  effectType: string;
  effectDensity: number;
  effectSpeed: number;
  effectOpacity: number;
  effectColor: string;
  soundDefaultEnabled: boolean;
  entrySoundUrl: string | null;
  entrySoundVolume: number;
  entrySoundMode: string;
  entrySoundIntervalHours: number;
  oauthProviders: string[];
  captchaLogin: string;
  captchaRegister: string;
  captchaComment: string;
  captchaForgotPassword: string;
  turnstileSiteKey: string | null;
  recaptchaSiteKey: string | null;
  hcaptchaSiteKey: string | null;
  referralEnabled: boolean;
  videoSelectorMode: string;
  sectionVideoEnabled: boolean;
  sectionImageEnabled: boolean;
  sectionGameEnabled: boolean;
  videoSortOptions: string;
  gameSortOptions: string;
  imageSortOptions: string;
  videoDefaultSort: string;
  gameDefaultSort: string;
  imageDefaultSort: string;
  analyticsGoogleId: string | null;
  analyticsGtmId: string | null;
  analyticsCfToken: string | null;
  analyticsClarityId: string | null;
  analyticsBingVerification: string | null;
  fileUploadEnabled: boolean;
  channelEnabled: boolean;
  channelMaxPerUser: number;
  channelMaxMembers: number;
  channelMessageMaxLength: number;
  dmEnabled: boolean;
  dmMessageMaxLength: number;
  dmRateLimit: number;
}

// ---------------------------------------------------------------------------
// globalThis 单例（dev 热重载保持引用，prod 整个进程生命周期有效）
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __publicSiteConfig?: PublicSiteConfig };
let _inflight: Promise<PublicSiteConfig> | null = null;

// ---------------------------------------------------------------------------
// DB → PublicSiteConfig
// ---------------------------------------------------------------------------

const OAUTH_KEYS = [
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
] as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function toPublic(c: Record<string, unknown>): PublicSiteConfig {
  const oauthProviders: string[] = [];
  for (const k of OAUTH_KEYS) {
    if (c[`oauth${k}ClientId`] && c[`oauth${k}ClientSecret`]) oauthProviders.push(k.toLowerCase());
  }

  return {
    siteName: (c.siteName as string) || "ACGN Site",
    siteUrl: stripTrailingSlash((c.siteUrl as string) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    siteDescription: (c.siteDescription as string) ?? null,
    siteLogo: (c.siteLogo as string) ?? null,
    siteFavicon: (c.siteFavicon as string) ?? null,
    siteKeywords: (c.siteKeywords as string) ?? null,
    googleVerification: (c.googleVerification as string) ?? null,
    githubUrl: (c.githubUrl as string) ?? null,
    securityEmail: (c.securityEmail as string) ?? null,
    announcement: (c.announcement as string) ?? null,
    announcementEnabled: (c.announcementEnabled as boolean) ?? false,
    allowRegistration: (c.allowRegistration as boolean) ?? true,
    allowUpload: (c.allowUpload as boolean) ?? true,
    allowComment: (c.allowComment as boolean) ?? true,
    requireLoginToComment: (c.requireLoginToComment as boolean) ?? false,
    contactEmail: (c.contactEmail as string) ?? null,
    socialLinks: c.socialLinks as Record<string, string> | null,
    privacyPolicy: (c.privacyPolicy as string) ?? null,
    termsOfService: (c.termsOfService as string) ?? null,
    aboutPage: (c.aboutPage as string) ?? null,
    footerText: (c.footerText as string) ?? null,
    footerLinks: c.footerLinks as Array<{ label: string; url: string }> | null,
    icpBeian: (c.icpBeian as string) ?? null,
    publicSecurityBeian: (c.publicSecurityBeian as string) ?? null,
    adsEnabled: (c.adsEnabled as boolean) ?? false,
    adGateEnabled: (c.adGateEnabled as boolean) ?? false,
    adGateViewsRequired: (c.adGateViewsRequired as number) ?? 3,
    adGateHours: (c.adGateHours as number) ?? 12,
    sponsorAds: c.sponsorAds as Ad[] | null,
    themeHue: (c.themeHue as number) ?? 285,
    themeColorTemp: (c.themeColorTemp as number) ?? 0,
    themeBorderRadius: (c.themeBorderRadius as number) ?? 0.625,
    themeGlassOpacity: (c.themeGlassOpacity as number) ?? 0.7,
    themeAnimations: (c.themeAnimations as boolean) ?? true,
    animationSpeed: (c.animationSpeed as number) ?? 1.0,
    animationPageTransition: (c.animationPageTransition as boolean) ?? true,
    animationStagger: (c.animationStagger as boolean) ?? true,
    animationHover: (c.animationHover as boolean) ?? true,
    animationDialog: (c.animationDialog as boolean) ?? true,
    animationTab: (c.animationTab as boolean) ?? true,
    animationPreset: (c.animationPreset as string) ?? "standard",
    effectEnabled: (c.effectEnabled as boolean) ?? true,
    effectType: (c.effectType as string) ?? "sakura",
    effectDensity: (c.effectDensity as number) ?? 50,
    effectSpeed: (c.effectSpeed as number) ?? 1.0,
    effectOpacity: (c.effectOpacity as number) ?? 0.8,
    effectColor: (c.effectColor as string) ?? "",
    soundDefaultEnabled: (c.soundDefaultEnabled as boolean) ?? true,
    entrySoundUrl: (c.entrySoundUrl as string) ?? null,
    entrySoundVolume: (c.entrySoundVolume as number) ?? 0.5,
    entrySoundMode: (c.entrySoundMode as string) ?? "session",
    entrySoundIntervalHours: (c.entrySoundIntervalHours as number) ?? 24,
    oauthProviders,
    captchaLogin: (c.captchaLogin as string) ?? "math",
    captchaRegister: (c.captchaRegister as string) ?? "none",
    captchaComment: (c.captchaComment as string) ?? "none",
    captchaForgotPassword: (c.captchaForgotPassword as string) ?? "none",
    turnstileSiteKey: (c.turnstileSiteKey as string) ?? null,
    recaptchaSiteKey: (c.recaptchaSiteKey as string) ?? null,
    hcaptchaSiteKey: (c.hcaptchaSiteKey as string) ?? null,
    referralEnabled: (c.referralEnabled as boolean) ?? false,
    videoSelectorMode: (c.videoSelectorMode as string) ?? "series",
    sectionVideoEnabled: (c.sectionVideoEnabled as boolean) ?? true,
    sectionImageEnabled: (c.sectionImageEnabled as boolean) ?? true,
    sectionGameEnabled: (c.sectionGameEnabled as boolean) ?? true,
    videoSortOptions: (c.videoSortOptions as string) ?? "latest,views,likes",
    gameSortOptions: (c.gameSortOptions as string) ?? "latest,views,likes",
    imageSortOptions: (c.imageSortOptions as string) ?? "latest,views",
    videoDefaultSort: (c.videoDefaultSort as string) ?? "latest",
    gameDefaultSort: (c.gameDefaultSort as string) ?? "latest",
    imageDefaultSort: (c.imageDefaultSort as string) ?? "latest",
    analyticsGoogleId: (c.analyticsGoogleId as string) ?? null,
    analyticsGtmId: (c.analyticsGtmId as string) ?? null,
    analyticsCfToken: (c.analyticsCfToken as string) ?? null,
    analyticsClarityId: (c.analyticsClarityId as string) ?? null,
    analyticsBingVerification: (c.analyticsBingVerification as string) ?? null,
    fileUploadEnabled: (c.fileUploadEnabled as boolean) ?? false,
    channelEnabled: (c.channelEnabled as boolean) ?? true,
    channelMaxPerUser: (c.channelMaxPerUser as number) ?? 5,
    channelMaxMembers: (c.channelMaxMembers as number) ?? 200,
    channelMessageMaxLength: (c.channelMessageMaxLength as number) ?? 2000,
    dmEnabled: (c.dmEnabled as boolean) ?? true,
    dmMessageMaxLength: (c.dmMessageMaxLength as number) ?? 2000,
    dmRateLimit: (c.dmRateLimit as number) ?? 30,
  };
}

async function loadFromDB(): Promise<PublicSiteConfig> {
  let row = await prisma.siteConfig.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.siteConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
  }
  return toPublic(row as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 获取公开站点配置。
 * 常驻内存，读取零开销。首次调用自动从 DB 加载（singleflight 防并发）。
 */
export async function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  if (g.__publicSiteConfig) return g.__publicSiteConfig;
  if (_inflight) return _inflight;

  _inflight = loadFromDB()
    .then((c) => {
      g.__publicSiteConfig = c;
      _inflight = null;
      return c;
    })
    .catch((e) => {
      _inflight = null;
      throw e;
    });

  return _inflight;
}

/**
 * 从 DB 重新加载到内存。管理员保存 / 导入配置 / 初始化向导后调用。
 */
export async function reloadPublicSiteConfig(): Promise<void> {
  g.__publicSiteConfig = await loadFromDB();
}
