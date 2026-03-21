import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getOrSet } from "@/lib/redis";

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

function parseHttpHeaders(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([k, v]) => typeof k === "string" && typeof v === "string")
        .map(([k, v]) => [k.trim(), v.trim()])
        .filter(([k, v]) => k.length > 0 && v.length > 0)
    );
  } catch {
    return {};
  }
}

/**
 * Server-side config from SiteConfig DB (Redis cached 5min + React cache per-request).
 * Falls back to process.env / defaults when DB is unavailable.
 */
export const getServerConfig = cache(async (): Promise<ServerConfig> => {
  try {
    return await getOrSet(
      "server:config",
      async () => {
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

        if (!row) throw new Error("SiteConfig not available");

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
          siteUrl:
            (row.siteUrl as string) ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000",
          siteName:
            (row.siteName as string) ||
            process.env.NEXT_PUBLIC_APP_NAME ||
            "ACGN Site",
          uploadDir:
            (row.uploadDir as string) ||
            process.env.UPLOAD_DIR ||
            "./uploads",
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
          googleServiceAccountEmail:
            (row.googleServiceAccountEmail as string) || null,
          googlePrivateKey: (row.googlePrivateKey as string) || null,
          turnstileSecretKey: (row.turnstileSecretKey as string) || null,
          recaptchaSecretKey: (row.recaptchaSecretKey as string) || null,
          hcaptchaSecretKey: (row.hcaptchaSecretKey as string) || null,
        };
      },
      300
    );
  } catch {
    return defaultConfig;
  }
});
