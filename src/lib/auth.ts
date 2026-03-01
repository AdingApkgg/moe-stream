import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username, customSession } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "@/lib/bcrypt-wasm";
import { getOrSet, deleteCache } from "@/lib/redis";

interface OAuthConfig {
  googleClientId?: string | null;
  googleClientSecret?: string | null;
  githubClientId?: string | null;
  githubClientSecret?: string | null;
  discordClientId?: string | null;
  discordClientSecret?: string | null;
}

async function getOAuthConfig(): Promise<OAuthConfig> {
  try {
    return await getOrSet(
      "oauth:config",
      async () => {
        const config = await prisma.siteConfig.findUnique({
          where: { id: "default" },
          select: {
            oauthGoogleClientId: true,
            oauthGoogleClientSecret: true,
            oauthGithubClientId: true,
            oauthGithubClientSecret: true,
            oauthDiscordClientId: true,
            oauthDiscordClientSecret: true,
          },
        });
        if (!config) return {};
        return {
          googleClientId: config.oauthGoogleClientId,
          googleClientSecret: config.oauthGoogleClientSecret,
          githubClientId: config.oauthGithubClientId,
          githubClientSecret: config.oauthGithubClientSecret,
          discordClientId: config.oauthDiscordClientId,
          discordClientSecret: config.oauthDiscordClientSecret,
        };
      },
      300
    );
  } catch {
    return {};
  }
}

function buildSocialProviders(cfg: OAuthConfig) {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  if (cfg.googleClientId && cfg.googleClientSecret) {
    providers.google = { clientId: cfg.googleClientId, clientSecret: cfg.googleClientSecret };
  }
  if (cfg.githubClientId && cfg.githubClientSecret) {
    providers.github = { clientId: cfg.githubClientId, clientSecret: cfg.githubClientSecret };
  }
  if (cfg.discordClientId && cfg.discordClientSecret) {
    providers.discord = { clientId: cfg.discordClientId, clientSecret: cfg.discordClientSecret };
  }
  return providers;
}

function createAuthInstance(oauthConfig: OAuthConfig) {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trustedOrigins: [
      process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000",
      process.env.NEXT_PUBLIC_APP_URL ?? "",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.*:3000",
      "http://10.*:3000",
    ].filter(Boolean),
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      password: {
        hash: (password) => hash(password, 10),
        verify: (data) => compare(data.password, data.hash),
      },
    },
    socialProviders: buildSocialProviders(oauthConfig),
    plugins: [
      username({
        minUsernameLength: 1,
        maxUsernameLength: 64,
      }),
      customSession(async ({ user, session }) => {
        if (!user?.id) return { user, session };
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, canUpload: true, adsEnabled: true },
        });
        if (!dbUser) return { user, session };
        const canUpload =
          dbUser.role === "ADMIN" ||
          dbUser.role === "OWNER" ||
          dbUser.canUpload === true;
        return {
          session,
          user: {
            ...user,
            role: dbUser.role,
            canUpload,
            adsEnabled: dbUser.adsEnabled ?? true,
          },
        };
      }),
    ],
    user: {
      modelName: "user",
      fields: {
        name: "nickname",
        image: "avatar",
      },
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "USER",
          input: false,
        },
        canUpload: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        adsEnabled: {
          type: "boolean",
          required: false,
          defaultValue: true,
          input: false,
        },
      },
    },
    session: {
      modelName: "session",
      fields: {
        token: "sessionToken",
        expiresAt: "expires",
      },
      expiresIn: 60 * 60 * 24 * 30, // 30 天
      updateAge: 60 * 60 * 24, // 1 天更新一次
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 分钟
      },
    },
    account: {
      modelName: "account",
      fields: {
        providerId: "provider",
        accountId: "providerAccountId",
        accessToken: "access_token",
        refreshToken: "refresh_token",
      },
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github", "discord"],
      },
    },
    verification: {
      modelName: "verification",
    },
    pages: {
      signIn: "/login",
    },
    advanced: {
      database: {
        generateId: false,
      },
    },
  });
}

// 静态 auth 实例用于不涉及 OAuth 的操作（session 读取等）
export const auth = createAuthInstance({});

// 动态 auth 实例缓存（含 DB 中的 OAuth 配置）
let _cachedAuth: ReturnType<typeof betterAuth> | null = null;
let _cachedConfigHash = "";

/**
 * 获取包含最新 OAuth 配置的 auth 实例。
 * 配置通过 Redis 缓存 5 分钟，admin 保存时主动失效。
 */
export async function getAuthWithOAuth() {
  const oauthConfig = await getOAuthConfig();
  const hash = JSON.stringify(oauthConfig);

  if (_cachedAuth && _cachedConfigHash === hash) {
    return _cachedAuth;
  }

  _cachedAuth = createAuthInstance(oauthConfig);
  _cachedConfigHash = hash;
  return _cachedAuth;
}

/** admin 保存 OAuth 配置后调用，清除缓存强制下次请求重建实例 */
export async function invalidateOAuthConfig() {
  _cachedAuth = null;
  _cachedConfigHash = "";
  await deleteCache("oauth:config");
}

/** 应用内使用的 Session 类型（与 next-auth 兼容的 shape） */
export interface AppSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: "USER" | "ADMIN" | "OWNER";
    canUpload?: boolean;
    /** 是否加载广告；false 表示站长/管理员已关闭该用户的广告 */
    adsEnabled?: boolean;
  };
  /** Better Auth 使用 session.token；兼容旧逻辑用 jti 表示同一值 */
  jti?: string;
  session: { id: string; token: string; expiresAt: Date };
}

/** 服务端获取当前 session（用于 tRPC、API 等） */
export async function getSession(): Promise<AppSession | null> {
  const { headers } = await import("next/headers");
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result?.user) return null;
  const { user, session } = result as { user: { id: string; email: string; name?: string | null; image?: string | null }; session: { id: string; token: string; expiresAt: Date } };
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, canUpload: true, adsEnabled: true, nickname: true, username: true, avatar: true },
  });
  const canUpload =
    dbUser?.role === "ADMIN" ||
    dbUser?.role === "OWNER" ||
    dbUser?.canUpload === true;
  const sessionPayload = session
    ? { id: session.id, token: session.token, expiresAt: session.expiresAt }
    : { id: "", token: "", expiresAt: new Date(0) };
  return {
    jti: session?.token ?? undefined,
    user: {
      id: user.id,
      email: user.email,
      name: (dbUser?.nickname || dbUser?.username) ?? user.name ?? null,
      image: dbUser?.avatar ?? user.image ?? null,
      role: (dbUser?.role as "USER" | "ADMIN" | "OWNER") ?? "USER",
      canUpload,
      adsEnabled: dbUser?.adsEnabled ?? true,
    },
    session: sessionPayload,
  };
}
