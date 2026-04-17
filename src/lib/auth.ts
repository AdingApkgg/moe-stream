import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username, customSession, twoFactor, genericOAuth } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "@/lib/bcrypt-wasm";

import { send2faOtpEmail } from "@/lib/email";
import { isPrivileged } from "@/lib/permissions";
import { resolvePermissions, resolveRole, type GroupPermissions } from "@/lib/group-permissions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuthProviderCredentials {
  clientId: string;
  clientSecret: string;
}

type OAuthConfig = Record<string, OAuthProviderCredentials>;

const OAUTH_PROVIDER_KEYS = [
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
  "Wechat",
] as const;

type OAuthProviderKey = (typeof OAUTH_PROVIDER_KEYS)[number];

interface QqOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

interface OAuthAndSiteConfig {
  oauth: OAuthConfig;
  qq: QqOAuthCredentials | null;
  siteUrl: string | null;
}

// ---------------------------------------------------------------------------
// OAuth config — DB + globalThis 内存缓存
// ---------------------------------------------------------------------------

const gOAuth = globalThis as unknown as { __oauthConfig?: OAuthAndSiteConfig };

async function loadOAuthFromDB(): Promise<OAuthAndSiteConfig> {
  const select: Record<string, true> = { siteUrl: true, oauthQqClientId: true, oauthQqClientSecret: true };
  for (const k of OAUTH_PROVIDER_KEYS) {
    select[`oauth${k}ClientId`] = true;
    select[`oauth${k}ClientSecret`] = true;
  }

  const config = (await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select,
  })) as Record<string, string | null> | null;

  if (!config) return { oauth: {}, qq: null, siteUrl: null };

  const oauth: OAuthConfig = {};
  for (const key of OAUTH_PROVIDER_KEYS) {
    const id = config[`oauth${key}ClientId`];
    const secret = config[`oauth${key}ClientSecret`];
    if (id && secret) {
      oauth[key.toLowerCase()] = { clientId: id, clientSecret: secret };
    }
  }

  const qqId = config.oauthQqClientId;
  const qqSecret = config.oauthQqClientSecret;
  const qq = qqId && qqSecret ? { clientId: qqId, clientSecret: qqSecret } : null;

  return { oauth, qq, siteUrl: config.siteUrl || null };
}

async function getOAuthAndSiteConfig(): Promise<OAuthAndSiteConfig> {
  if (gOAuth.__oauthConfig) return gOAuth.__oauthConfig;
  const result = await loadOAuthFromDB();
  gOAuth.__oauthConfig = result;
  return result;
}

// ---------------------------------------------------------------------------
// Trusted‑origins helper
// ---------------------------------------------------------------------------

const LOCAL_ORIGIN_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

function buildTrustedOrigins(baseURL: string) {
  const staticOrigins = new Set([baseURL, process.env.NEXT_PUBLIC_APP_URL].filter((v): v is string => !!v));

  return (request?: Request) => {
    const origins = [...staticOrigins];
    const origin = request?.headers?.get("origin");
    if (origin && LOCAL_ORIGIN_RE.test(origin)) {
      origins.push(origin);
    }
    return origins;
  };
}

// ---------------------------------------------------------------------------
// Auth instance factory
// ---------------------------------------------------------------------------

function resolveBaseURL(siteUrl?: string): string {
  return siteUrl || process.env.BETTER_AUTH_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function createAuthInstance(oauthConfig: OAuthConfig, qqConfig: QqOAuthCredentials | null, siteUrl?: string) {
  const baseURL = resolveBaseURL(siteUrl);

  const providerNames = [...Object.keys(oauthConfig), ...(qqConfig ? ["qq"] : [])];
  console.log(`[auth] Creating auth instance: baseURL=${baseURL}, providers=${providerNames.join(",") || "none"}`);

  return betterAuth({
    baseURL,
    trustedOrigins: buildTrustedOrigins(baseURL),
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      password: {
        hash: (password) => hash(password, 10),
        verify: (data) => compare(data.password, data.hash),
      },
    },

    socialProviders: oauthConfig as Parameters<typeof betterAuth>[0]["socialProviders"],

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!user.username) {
              const emailPrefix = user.email ? user.email.split("@")[0] : null;
              const prefix = (emailPrefix || "user").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 14);
              const suffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
              return { data: { ...user, username: `${prefix}_${suffix}` } };
            }
            return { data: user };
          },
        },
      },
    },

    plugins: [
      username({ minUsernameLength: 1, maxUsernameLength: 64 }),
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
      }),
      ...(qqConfig
        ? [
            genericOAuth({
              config: [
                {
                  providerId: "qq",
                  clientId: qqConfig.clientId,
                  clientSecret: qqConfig.clientSecret,
                  authorizationUrl: "https://graph.qq.com/oauth2.0/authorize",
                  tokenUrl: "https://graph.qq.com/oauth2.0/token",
                  scopes: ["get_user_info"],
                  async getUserInfo(token) {
                    const meRes = await fetch(
                      `https://graph.qq.com/oauth2.0/me?access_token=${token.accessToken}&fmt=json`,
                    );
                    const meData = (await meRes.json()) as { openid?: string; client_id?: string };
                    const openid = meData.openid;
                    if (!openid) throw new Error("QQ OAuth: 无法获取 openid");

                    const infoRes = await fetch(
                      `https://graph.qq.com/user/get_user_info?access_token=${token.accessToken}&oauth_consumer_key=${qqConfig.clientId}&openid=${openid}`,
                    );
                    const info = (await infoRes.json()) as {
                      ret?: number;
                      nickname?: string;
                      figureurl_qq_2?: string;
                      figureurl_qq_1?: string;
                    };
                    if (info.ret !== 0) throw new Error("QQ OAuth: 获取用户信息失败");

                    return {
                      id: openid,
                      name: info.nickname || "QQ用户",
                      image: info.figureurl_qq_2 || info.figureurl_qq_1 || "",
                      emailVerified: false,
                    };
                  },
                },
              ],
            }),
          ]
        : []),
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
            groupId: true,
            group: {
              select: { id: true, name: true, role: true, permissions: true },
            },
          },
        });
        if (!dbUser) return { user, session };

        const effectiveRole = resolveRole(dbUser.role, dbUser.group?.role);
        const perms = resolvePermissions(effectiveRole, dbUser.group?.permissions as Partial<GroupPermissions> | null);
        const canUpload = isPrivileged(effectiveRole) || perms.canUpload || dbUser.canUpload === true;

        return {
          session,
          user: {
            ...user,
            name: dbUser.nickname || dbUser.username || user.name,
            image: dbUser.avatar || user.image,
            role: effectiveRole,
            canUpload,
            adsEnabled: perms.adsEnabled,
            twoFactorEnabled: dbUser.twoFactorEnabled,
            groupId: dbUser.groupId,
            groupName: dbUser.group?.name,
          },
        };
      }),
    ],

    user: {
      modelName: "user",
      fields: { name: "nickname", image: "avatar" },
      additionalFields: {
        emailVerified: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
          fieldName: "emailVerified",
          transform: {
            input: (value) => {
              if (typeof value === "boolean") return value ? new Date() : null;
              return value;
            },
            output: (value) => {
              return value instanceof Date || !!value;
            },
          },
        },
        role: { type: "string", required: false, defaultValue: "USER", input: false },
        canUpload: { type: "boolean", required: false, defaultValue: false, input: false },
        adsEnabled: { type: "boolean", required: false, defaultValue: true, input: false },
        twoFactorEnabled: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },

    session: {
      modelName: "session",
      fields: { token: "sessionToken", expiresAt: "expires" },
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
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
        allowDifferentEmails: true,
        trustedProviders: [...OAUTH_PROVIDER_KEYS.map((k) => k.toLowerCase()), "qq"] as Array<
          Lowercase<OAuthProviderKey> | "qq"
        >,
      },
    },

    verification: { modelName: "verification" },
    pages: { signIn: "/login" },
    onAPIError: {
      errorURL: "/login",
    },
    advanced: { database: { generateId: false } },
  });
}

// ---------------------------------------------------------------------------
// Singleton with proper concurrency & error recovery
// ---------------------------------------------------------------------------

type AuthInstance = ReturnType<typeof createAuthInstance>;

let _cached: { auth: AuthInstance; hash: string } | null = null;
let _pending: Promise<AuthInstance> | null = null;

export async function getAuthWithOAuth(): Promise<AuthInstance> {
  const { oauth, qq, siteUrl } = await getOAuthAndSiteConfig();
  const configHash = JSON.stringify({ oauth, qq, siteUrl });

  if (_cached?.hash === configHash) {
    return _cached.auth;
  }

  if (_pending) return _pending;

  _pending = (async () => {
    try {
      const instance = createAuthInstance(oauth, qq, siteUrl || undefined);
      _cached = { auth: instance, hash: configHash };
      return instance;
    } finally {
      _pending = null;
    }
  })();

  return _pending;
}

export async function invalidateOAuthConfig() {
  _cached = null;
  _pending = null;
  gOAuth.__oauthConfig = undefined;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export interface AppSession {
  user: {
    id: string;
    email: string | null;
    name?: string | null;
    image?: string | null;
    role?: "USER" | "ADMIN" | "OWNER";
    canUpload?: boolean;
    adsEnabled?: boolean;
    twoFactorEnabled?: boolean;
    groupId?: string | null;
    groupName?: string | null;
  };
  jti?: string;
  session: { id: string; token: string; expiresAt: Date };
}

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
      email: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
      canUpload?: boolean;
      adsEnabled?: boolean;
      twoFactorEnabled?: boolean;
      groupId?: string | null;
      groupName?: string | null;
    };
    session: { id: string; token: string; expiresAt: Date };
  };

  const role = (user.role as "USER" | "ADMIN" | "OWNER") ?? "USER";
  const canUpload = isPrivileged(role) || user.canUpload === true;

  return {
    jti: session?.token ?? undefined,
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      image: user.image ?? null,
      role,
      canUpload,
      adsEnabled: user.adsEnabled ?? true,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      groupId: user.groupId ?? null,
      groupName: user.groupName ?? null,
    },
    session: session
      ? { id: session.id, token: session.token, expiresAt: session.expiresAt }
      : { id: "", token: "", expiresAt: new Date(0) },
  };
}
