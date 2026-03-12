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

export interface ServerConfig {
  siteUrl: string;
  siteName: string;
  uploadDir: string;
  smtp: SmtpConfig | null;
  indexNowKey: string | null;
  googleServiceAccountEmail: string | null;
  googlePrivateKey: string | null;
  turnstileSecretKey: string | null;
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
  indexNowKey: true,
  googleServiceAccountEmail: true,
  googlePrivateKey: true,
  turnstileSecretKey: true,
} as const;

const defaultConfig: ServerConfig = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  siteName: process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  smtp: null,
  indexNowKey: null,
  googleServiceAccountEmail: null,
  googlePrivateKey: null,
  turnstileSecretKey: null,
};

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
          smtp: hasSmtp
            ? {
                host: smtpHost!,
                port: (row.smtpPort as number) ?? 465,
                user: smtpUser!,
                password: smtpPassword!,
                from: smtpFrom!,
              }
            : null,
          indexNowKey: (row.indexNowKey as string) || null,
          googleServiceAccountEmail:
            (row.googleServiceAccountEmail as string) || null,
          googlePrivateKey: (row.googlePrivateKey as string) || null,
          turnstileSecretKey: (row.turnstileSecretKey as string) || null,
        };
      },
      300
    );
  } catch {
    return defaultConfig;
  }
});
