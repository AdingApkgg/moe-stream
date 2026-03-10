import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username, customSession, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "@/lib/bcrypt-wasm";
import { getOrSet, deleteCache } from "@/lib/redis";
import { send2faOtpEmail } from "@/lib/email";

interface OAuthProviderCredentials {
  clientId?: string | null;
  clientSecret?: string | null;
}

type OAuthConfig = Partial<Record<string, OAuthProviderCredentials>>;

const OAUTH_PROVIDER_KEYS = [
  "Google", "Github", "Discord", "Apple", "Twitter", "Facebook",
  "Microsoft", "Twitch", "Spotify", "Linkedin", "Gitlab", "Reddit",
] as const;

interface OAuthAndSiteConfig {
  oauth: OAuthConfig;
  siteUrl: string | null;
}

async function getOAuthAndSiteConfig(): Promise<OAuthAndSiteConfig> {
  try {
    return await getOrSet(
      "oauth:config",
      async () => {
        const select: Record<string, true> = { siteUrl: true };
        for (const k of OAUTH_PROVIDER_KEYS) {
          select[`oauth${k}ClientId`] = true;
          select[`oauth${k}ClientSecret`] = true;
        }
        const config = await prisma.siteConfig.findUnique({
          where: { id: "default" },
          select,
        }) as Record<string, string | null> | null;
        if (!config) return { oauth: {}, siteUrl: null };
        const oauth: OAuthConfig = {};
        for (const key of OAUTH_PROVIDER_KEYS) {
          const id = config[`oauth${key}ClientId`];
          const secret = config[`oauth${key}ClientSecret`];
          if (id && secret) {
            oauth[key.toLowerCase()] = { clientId: id, clientSecret: secret };
          }
        }
        const enabledProviders = Object.keys(oauth);
        if (enabledProviders.length > 0) {
          console.log(`[auth] OAuth providers loaded: ${enabledProviders.join(", ")}`);
        }
        return { oauth, siteUrl: config.siteUrl || null };
      },
      300
    );
  } catch (err) {
    console.error("[auth] Failed to load OAuth config:", err);
    return { oauth: {}, siteUrl: null };
  }
}

function buildSocialProviders(cfg: OAuthConfig) {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  for (const [name, creds] of Object.entries(cfg)) {
    if (creds?.clientId && creds?.clientSecret) {
      providers[name] = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    }
  }
  return providers;
}

const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

function createAuthInstance(oauthConfig: OAuthConfig, siteUrl?: string) {
  const baseURL = siteUrl || process.env.BETTER_AUTH_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const socialProviderConfig = buildSocialProviders(oauthConfig);
  console.log(`[auth] Creating auth instance: baseURL=${baseURL}, providers=${Object.keys(socialProviderConfig).join(",") || "none"}`);

  const staticOrigins = new Set(
    [baseURL, process.env.NEXT_PUBLIC_APP_URL].filter((v): v is string => !!v)
  );

  return betterAuth({
    baseURL,
    trustedOrigins: (request?: Request) => {
      const origins = [...staticOrigins];
      const origin = request?.headers?.get("origin");
      if (origin && LOCAL_ORIGIN_RE.test(origin)) {
        origins.push(origin);
      }
      return origins;
    },
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      password: {
        hash: (password) => hash(password, 10),
        verify: (data) => compare(data.password, data.hash),
      },
    },
    socialProviders: socialProviderConfig as Parameters<typeof betterAuth>[0]["socialProviders"],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!user.username) {
              const prefix = (user.email?.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 14);
              const suffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
              return { data: { ...user, username: `${prefix}_${suffix}` } };
            }
            return { data: user };
          },
        },
      },
    },
    plugins: [
      username({
        minUsernameLength: 1,
        maxUsernameLength: 64,
      }),
      twoFactor({
        issuer: process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
        otpOptions: {
          async sendOTP({ user, otp }) {
            await send2faOtpEmail(user.email, otp);
          },
        },
      }),
      passkey({
        rpID: new URL(baseURL).hostname,
        rpName: process.env.NEXT_PUBLIC_APP_NAME || "ACGN Site",
        origin: baseURL,
      }),
      customSession(async ({ user, session }) => {
        if (!user?.id) return { user, session };
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            canUpload: true,
            adsEnabled: true,
            nickname: true,
            username: true,
            avatar: true,
            twoFactorEnabled: true,
          },
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
            name: dbUser.nickname || dbUser.username || user.name,
            image: dbUser.avatar || user.image,
            role: dbUser.role,
            canUpload,
            adsEnabled: dbUser.adsEnabled ?? true,
            twoFactorEnabled: dbUser.twoFactorEnabled,
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
        twoFactorEnabled: {
          type: "boolean",
          required: false,
          defaultValue: false,
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
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    account: {
      modelName: "account",
      fields: {
        providerId: "provider",
        accountId: "providerAccountId",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
      },
      accountLinking: {
        enabled: true,
        trustedProviders: [
          "google", "github", "discord", "apple", "twitter", "facebook",
          "microsoft", "twitch", "spotify", "linkedin", "gitlab", "reddit",
        ],
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

let _cachedAuth: ReturnType<typeof createAuthInstance> | null = null;
let _cachedConfigHash = "";
let _pendingInit: Promise<ReturnType<typeof createAuthInstance>> | null = null;

/**
 * 获取包含最新 OAuth 配置的 auth 实例。
 * 使用 Promise 锁防止并发初始化创建多个实例。
 */
export async function getAuthWithOAuth() {
  const { oauth, siteUrl } = await getOAuthAndSiteConfig();
  const configHash = JSON.stringify({ oauth, siteUrl });

  if (_cachedAuth && _cachedConfigHash === configHash) {
    return _cachedAuth;
  }

  if (!_pendingInit) {
    _pendingInit = Promise.resolve().then(() => {
      const instance = createAuthInstance(oauth, siteUrl || undefined);
      _cachedAuth = instance;
      _cachedConfigHash = configHash;
      _pendingInit = null;
      return instance;
    });
  }

  return _pendingInit;
}

export async function invalidateOAuthConfig() {
  _cachedAuth = null;
  _cachedConfigHash = "";
  _pendingInit = null;
  await deleteCache("oauth:config");
}

export interface AppSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: "USER" | "ADMIN" | "OWNER";
    canUpload?: boolean;
    adsEnabled?: boolean;
    twoFactorEnabled?: boolean;
  };
  jti?: string;
  session: { id: string; token: string; expiresAt: Date };
}

/**
 * 服务端获取当前 session（用于 tRPC、API 等）。
 * customSession 插件已在 session 读取时注入 role/canUpload/adsEnabled/nickname/avatar，
 * 此处直接使用插件返回的数据，避免二次查库。
 */
export async function getSession(req?: Request): Promise<AppSession | null> {
  let reqHeaders: Headers;
  if (req) {
    reqHeaders = req.headers;
  } else {
    const { headers } = await import("next/headers");
    reqHeaders = await headers();
  }
  const authInstance = await getAuthWithOAuth();
  const result = await authInstance.api.getSession({ headers: reqHeaders });
  if (!result?.user) return null;

  const { user, session } = result as {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role?: string;
      canUpload?: boolean;
      adsEnabled?: boolean;
      twoFactorEnabled?: boolean;
    };
    session: { id: string; token: string; expiresAt: Date };
  };

  const role = (user.role as "USER" | "ADMIN" | "OWNER") ?? "USER";
  const canUpload = role === "ADMIN" || role === "OWNER" || user.canUpload === true;

  return {
    jti: session?.token ?? undefined,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      role,
      canUpload,
      adsEnabled: user.adsEnabled ?? true,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    },
    session: session
      ? { id: session.id, token: session.token, expiresAt: session.expiresAt }
      : { id: "", token: "", expiresAt: new Date(0) },
  };
}
