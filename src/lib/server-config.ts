import { prisma } from "@/lib/prisma";

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

// ---------------------------------------------------------------------------
// globalThis 单例
// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __serverConfig?: ServerConfig };
let _inflight: Promise<ServerConfig> | null = null;

// ---------------------------------------------------------------------------
// DB → ServerConfig
// ---------------------------------------------------------------------------

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

function toServerConfig(c: Record<string, unknown>): ServerConfig {
  const smtpHost = c.smtpHost as string | null;
  const smtpUser = c.smtpUser as string | null;
  const smtpPassword = c.smtpPassword as string | null;
  const smtpFrom = c.smtpFrom as string | null;
  const hasSmtp = !!(smtpHost && smtpUser && smtpPassword && smtpFrom);
  const mailApiUrl = c.mailApiUrl as string | null;
  const mailApiFrom = c.mailApiFrom as string | null;
  const mailApiKey = c.mailApiKey as string | null;
  const hasHttpApi = !!(mailApiUrl && mailApiFrom);

  return {
    siteUrl: (c.siteUrl as string) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    siteName: (c.siteName as string) || process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
    uploadDir: (c.uploadDir as string) || process.env.UPLOAD_DIR || "./uploads",
    mailSendMode: (c.mailSendMode as string) === "http_api" ? "http_api" : "smtp",
    smtp: hasSmtp
      ? {
          host: smtpHost!,
          port: (c.smtpPort as number) ?? 465,
          user: smtpUser!,
          password: smtpPassword!,
          from: smtpFrom!,
        }
      : null,
    httpEmailApi: hasHttpApi
      ? { url: mailApiUrl!, key: mailApiKey || null, from: mailApiFrom!, headers: parseHttpHeaders(c.mailApiHeaders) }
      : null,
    indexNowKey: (c.indexNowKey as string) || null,
    googleServiceAccountEmail: (c.googleServiceAccountEmail as string) || null,
    googlePrivateKey: (c.googlePrivateKey as string) || null,
    turnstileSecretKey: (c.turnstileSecretKey as string) || null,
    recaptchaSecretKey: (c.recaptchaSecretKey as string) || null,
    hcaptchaSecretKey: (c.hcaptchaSecretKey as string) || null,
  };
}

async function loadFromDB(): Promise<ServerConfig> {
  let row = await prisma.siteConfig.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.siteConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
  }
  return toServerConfig(row as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/** 获取服务端配置（含敏感信息）。常驻内存，读取零开销。 */
export async function getServerConfig(): Promise<ServerConfig> {
  if (g.__serverConfig) return g.__serverConfig;
  if (_inflight) return _inflight;

  _inflight = loadFromDB()
    .then((c) => {
      g.__serverConfig = c;
      _inflight = null;
      return c;
    })
    .catch((e) => {
      _inflight = null;
      throw e;
    });

  return _inflight;
}

/** 从 DB 重新加载到内存。 */
export async function reloadServerConfig(): Promise<void> {
  g.__serverConfig = await loadFromDB();
}
