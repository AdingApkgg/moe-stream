import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getOrSet, setCache } from "@/lib/redis";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export interface HttpEmailApiConfig {
  url: string;
  key: string | null;
  from: string;
  headers: Record<string, string>;
}

export interface ServerConfig {
  siteUrl: string;
  siteName: string;
  uploadDir: string;
  mailSendMode: "smtp" | "http_api";
  smtp: SmtpConfig | null;
  httpEmailApi: HttpEmailApiConfig | null;
  indexNowKey: string | null;
  googleServiceAccountEmail: string | null;
  googlePrivateKey: string | null;
  turnstileSecretKey: string | null;
  recaptchaSecretKey: string | null;
  hcaptchaSecretKey: string | null;
}

const selectFields = {
  siteName: true,
  siteUrl: true,
  uploadDir: true,
  smtpHost: true,
  smtpPort: true,
  smtpUser: true,
  smtpPassword: true,
  smtpFrom: true,
  mailSendMode: true,
  mailApiUrl: true,
  mailApiKey: true,
  mailApiFrom: true,
  mailApiHeaders: true,
  indexNowKey: true,
  googleServiceAccountEmail: true,
  googlePrivateKey: true,
  turnstileSecretKey: true,
  recaptchaSecretKey: true,
  hcaptchaSecretKey: true,
} as const;

const defaultConfig: ServerConfig = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  siteName: process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  mailSendMode: "smtp",
  smtp: null,
  httpEmailApi: null,
  indexNowKey: null,
  googleServiceAccountEmail: null,
  googlePrivateKey: null,
  turnstileSecretKey: null,
  recaptchaSecretKey: null,
  hcaptchaSecretKey: null,
};

let lastKnownGood: ServerConfig | null = null;

function parseHttpHeaders(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([k, v]) => typeof k === "string" && typeof v === "string")
        .map(([k, v]) => [k.trim(), v.trim()])
        .filter(([k, v]) => k.length > 0 && v.length > 0),
    );
  } catch {
    return {};
  }
}

function buildServerConfig(row: Record<string, unknown>): ServerConfig {
  const smtpHost = row.smtpHost as string | null;
  const smtpUser = row.smtpUser as string | null;
  const smtpPassword = row.smtpPassword as string | null;
  const smtpFrom = row.smtpFrom as string | null;
  const hasSmtp = !!(smtpHost && smtpUser && smtpPassword && smtpFrom);
  const mailApiUrl = row.mailApiUrl as string | null;
  const mailApiFrom = row.mailApiFrom as string | null;
  const mailApiKey = row.mailApiKey as string | null;
  const hasHttpApi = !!(mailApiUrl && mailApiFrom);
  const mailSendMode = (row.mailSendMode as string) === "http_api" ? "http_api" : "smtp";

  return {
    siteUrl: (row.siteUrl as string) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    siteName: (row.siteName as string) || process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
    uploadDir: (row.uploadDir as string) || process.env.UPLOAD_DIR || "./uploads",
    mailSendMode,
    smtp: hasSmtp
      ? {
          host: smtpHost!,
          port: (row.smtpPort as number) ?? 465,
          user: smtpUser!,
          password: smtpPassword!,
          from: smtpFrom!,
        }
      : null,
    httpEmailApi: hasHttpApi
      ? {
          url: mailApiUrl!,
          key: mailApiKey || null,
          from: mailApiFrom!,
          headers: parseHttpHeaders(row.mailApiHeaders),
        }
      : null,
    indexNowKey: (row.indexNowKey as string) || null,
    googleServiceAccountEmail: (row.googleServiceAccountEmail as string) || null,
    googlePrivateKey: (row.googlePrivateKey as string) || null,
    turnstileSecretKey: (row.turnstileSecretKey as string) || null,
    recaptchaSecretKey: (row.recaptchaSecretKey as string) || null,
    hcaptchaSecretKey: (row.hcaptchaSecretKey as string) || null,
  };
}

const CONFIG_TTL = 300; // 5 minutes

async function fetchServerConfigFromDB(): Promise<Record<string, unknown>> {
  let row: Record<string, unknown> | null = null;
  try {
    row = (await prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: selectFields,
    })) as Record<string, unknown> | null;
  } catch {
    row = (await prisma.siteConfig.findUnique({
      where: { id: "default" },
    })) as Record<string, unknown> | null;
  }

  if (!row) {
    throw new Error(
      "[ServerConfig] 数据库中未找到 SiteConfig 记录（id=default）。" +
        "请检查数据库是否被重置，或 instrumentation 是否正常执行。",
    );
  }
  return row;
}

/**
 * 供 instrumentation 调用：从 DB 读取服务端配置并写入 Redis 缓存。
 */
export async function warmServerConfig(): Promise<void> {
  const row = await fetchServerConfigFromDB();
  const result = buildServerConfig(row);
  lastKnownGood = result;
  await setCache("server:config", result, CONFIG_TTL);
}

/**
 * 服务端配置（Redis 5 分钟缓存 + React cache 请求去重）。
 *
 * 回退策略：Redis → DB → lastKnownGood → defaultConfig
 */
export const getServerConfig = cache(async (): Promise<ServerConfig> => {
  try {
    const result = await getOrSet(
      "server:config",
      async () => {
        const row = await fetchServerConfigFromDB();
        const built = buildServerConfig(row);
        lastKnownGood = built;
        return built;
      },
      CONFIG_TTL,
    );
    return result;
  } catch (err) {
    if (lastKnownGood) {
      console.warn("[ServerConfig] DB/Redis 不可用，使用内存快照（lastKnownGood）。", (err as Error)?.message);
      return lastKnownGood;
    }
    console.error("[ServerConfig] DB/Redis 完全不可用且无内存快照，回退到硬编码默认值！", err);
    return defaultConfig;
  }
});
