import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getOrSet, setCache } from "@/lib/redis";
import type { Ad } from "@/lib/ads";

/** 公开站点配置的类型定义 */
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
}

const selectFields = {
  siteName: true,
  siteUrl: true,
  siteDescription: true,
  siteLogo: true,
  siteFavicon: true,
  siteKeywords: true,
  googleVerification: true,
  githubUrl: true,
  securityEmail: true,
  announcement: true,
  announcementEnabled: true,
  allowRegistration: true,
  allowUpload: true,
  allowComment: true,
  requireLoginToComment: true,
  contactEmail: true,
  socialLinks: true,
  privacyPolicy: true,
  termsOfService: true,
  aboutPage: true,
  footerText: true,
  footerLinks: true,
  icpBeian: true,
  publicSecurityBeian: true,
  adsEnabled: true,
  adGateEnabled: true,
  adGateViewsRequired: true,
  adGateHours: true,
  sponsorAds: true,
  themeHue: true,
  themeColorTemp: true,
  themeBorderRadius: true,
  themeGlassOpacity: true,
  themeAnimations: true,
  animationSpeed: true,
  animationPageTransition: true,
  animationStagger: true,
  animationHover: true,
  animationDialog: true,
  animationTab: true,
  animationPreset: true,
  effectEnabled: true,
  effectType: true,
  effectDensity: true,
  effectSpeed: true,
  effectOpacity: true,
  effectColor: true,
  soundDefaultEnabled: true,
  captchaLogin: true,
  captchaRegister: true,
  captchaComment: true,
  captchaForgotPassword: true,
  turnstileSiteKey: true,
  recaptchaSiteKey: true,
  hcaptchaSiteKey: true,
  referralEnabled: true,
  videoSelectorMode: true,
  sectionVideoEnabled: true,
  sectionImageEnabled: true,
  sectionGameEnabled: true,
  videoSortOptions: true,
  gameSortOptions: true,
  imageSortOptions: true,
  videoDefaultSort: true,
  gameDefaultSort: true,
  imageDefaultSort: true,
  analyticsGoogleId: true,
  analyticsGtmId: true,
  analyticsCfToken: true,
  analyticsClarityId: true,
  analyticsBingVerification: true,
  fileUploadEnabled: true,
  oauthGoogleClientId: true,
  oauthGoogleClientSecret: true,
  oauthGithubClientId: true,
  oauthGithubClientSecret: true,
  oauthDiscordClientId: true,
  oauthDiscordClientSecret: true,
  oauthAppleClientId: true,
  oauthAppleClientSecret: true,
  oauthTwitterClientId: true,
  oauthTwitterClientSecret: true,
  oauthFacebookClientId: true,
  oauthFacebookClientSecret: true,
  oauthMicrosoftClientId: true,
  oauthMicrosoftClientSecret: true,
  oauthTwitchClientId: true,
  oauthTwitchClientSecret: true,
  oauthSpotifyClientId: true,
  oauthSpotifyClientSecret: true,
  oauthLinkedinClientId: true,
  oauthLinkedinClientSecret: true,
  oauthGitlabClientId: true,
  oauthGitlabClientSecret: true,
  oauthRedditClientId: true,
  oauthRedditClientSecret: true,
} as const;

/** 去除 URL 尾部斜杠，避免拼接时产生 "//" */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const defaultConfig: PublicSiteConfig = {
  siteName: process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
  siteUrl: stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  siteDescription: null,
  siteLogo: null,
  siteFavicon: null,
  siteKeywords: null,
  googleVerification: null,
  githubUrl: null,
  securityEmail: null,
  announcement: null,
  announcementEnabled: false,
  allowRegistration: true,
  allowUpload: true,
  allowComment: true,
  requireLoginToComment: false,
  contactEmail: null,
  socialLinks: null,
  privacyPolicy: null,
  termsOfService: null,
  aboutPage: null,
  footerText: null,
  footerLinks: null,
  icpBeian: null,
  publicSecurityBeian: null,
  adsEnabled: false,
  adGateEnabled: false,
  adGateViewsRequired: 3,
  adGateHours: 12,
  sponsorAds: null,
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
  animationPreset: "standard",
  effectEnabled: true,
  effectType: "sakura",
  effectDensity: 50,
  effectSpeed: 1.0,
  effectOpacity: 0.8,
  effectColor: "",
  soundDefaultEnabled: true,
  oauthProviders: [],
  captchaLogin: "math",
  captchaRegister: "none",
  captchaComment: "none",
  captchaForgotPassword: "none",
  turnstileSiteKey: null,
  recaptchaSiteKey: null,
  hcaptchaSiteKey: null,
  referralEnabled: false,
  videoSelectorMode: "series",
  sectionVideoEnabled: true,
  sectionImageEnabled: true,
  sectionGameEnabled: true,
  videoSortOptions: "latest,views,likes",
  gameSortOptions: "latest,views,likes",
  imageSortOptions: "latest,views",
  videoDefaultSort: "latest",
  gameDefaultSort: "latest",
  imageDefaultSort: "latest",
  analyticsGoogleId: null,
  analyticsGtmId: null,
  analyticsCfToken: null,
  analyticsClarityId: null,
  analyticsBingVerification: null,
  fileUploadEnabled: false,
};

// 上一次成功从 DB 加载的配置快照，作为 DB/Redis 完全不可用时的二级回退。
// 比 defaultConfig 可靠：它反映管理员实际保存的值而非硬编码。
let lastKnownGood: PublicSiteConfig | null = null;

const OAUTH_PROVIDER_PAIRS = [
  ["Google", "google"],
  ["Github", "github"],
  ["Discord", "discord"],
  ["Apple", "apple"],
  ["Twitter", "twitter"],
  ["Facebook", "facebook"],
  ["Microsoft", "microsoft"],
  ["Twitch", "twitch"],
  ["Spotify", "spotify"],
  ["Linkedin", "linkedin"],
  ["Gitlab", "gitlab"],
  ["Reddit", "reddit"],
] as const;

function buildPublicConfig(config: Record<string, unknown>): PublicSiteConfig {
  const oauthProviders: string[] = [];
  for (const [key, id] of OAUTH_PROVIDER_PAIRS) {
    if (config[`oauth${key}ClientId`] && config[`oauth${key}ClientSecret`]) {
      oauthProviders.push(id);
    }
  }

  return {
    ...defaultConfig,
    ...Object.fromEntries(Object.entries(config).filter(([key]) => key in defaultConfig)),
    siteUrl: stripTrailingSlash(
      (config.siteUrl as string) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ),
    socialLinks: config.socialLinks as Record<string, string> | null,
    footerLinks: config.footerLinks as Array<{ label: string; url: string }> | null,
    sponsorAds: config.sponsorAds as Ad[] | null,
    oauthProviders,
  };
}

async function fetchConfigFromDB(): Promise<Record<string, unknown>> {
  let config: Record<string, unknown> | null = null;

  try {
    config = (await prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: selectFields,
    })) as Record<string, unknown> | null;
  } catch {
    config = (await prisma.siteConfig.findUnique({
      where: { id: "default" },
    })) as Record<string, unknown> | null;
  }

  if (!config) {
    throw new Error(
      "[SiteConfig] 数据库中未找到 SiteConfig 记录（id=default）。" +
        "请检查数据库是否被重置，或 instrumentation 是否正常执行。",
    );
  }
  return config;
}

/**
 * 供 instrumentation 调用：从 DB 读取配置并写入 Redis 缓存。
 * 在服务器启动时执行，确保第一个请求直接命中缓存。
 */
export async function warmPublicSiteConfig(): Promise<void> {
  const config = await fetchConfigFromDB();
  const result = buildPublicConfig(config);
  lastKnownGood = result;
  await setCache("site:config", result, CONFIG_TTL);
}

const CONFIG_TTL = 300; // 5 minutes

/**
 * 服务端获取公开站点配置（使用 Redis 5 分钟缓存 + React cache 请求去重）
 * 可在 layout.tsx / page.tsx 等 Server Component 中直接调用。
 *
 * 回退策略（按优先级）：
 * 1. Redis 缓存 → 2. DB 读取 → 3. lastKnownGood 内存快照 → 4. defaultConfig
 */
export const getPublicSiteConfig = cache(async (): Promise<PublicSiteConfig> => {
  try {
    const result = await getOrSet(
      "site:config",
      async () => {
        const config = await fetchConfigFromDB();
        const built = buildPublicConfig(config);
        lastKnownGood = built;
        return built;
      },
      CONFIG_TTL,
    );
    return result;
  } catch (err) {
    // DB 和 Redis 都不可用——优先使用上次成功加载的快照
    if (lastKnownGood) {
      console.warn("[SiteConfig] DB/Redis 不可用，使用内存快照（lastKnownGood）。", (err as Error)?.message);
      return lastKnownGood;
    }
    console.error("[SiteConfig] DB/Redis 完全不可用且无内存快照，回退到硬编码默认值！", err);
    return defaultConfig;
  }
});
