import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username, customSession, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import { hash, compare } from "@/lib/bcrypt-wasm";
import { getOrSet, deleteCache } from "@/lib/redis";
import { send2faOtpEmail } from "@/lib/email";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuthProviderCredentials {
  clientId: string;
  clientSecret: string;
}

type OAuthConfig = Record<string, OAuthProviderCredentials>;

const OAUTH_PROVIDER_KEYS = [
  "Google", "Github", "Discord", "Apple", "Twitter", "Facebook",
  "Microsoft", "Twitch", "Spotify", "Linkedin", "Gitlab", "Reddit",
] as const;

type OAuthProviderKey = (typeof OAUTH_PROVIDER_KEYS)[number];

interface OAuthAndSiteConfig {
  oauth: OAuthConfig;
  siteUrl: string | null;
}

// ---------------------------------------------------------------------------
// OAuth config from DB (cached in Redis)
// ---------------------------------------------------------------------------

async function getOAuthAndSiteConfig(): Promise<OAuthAndSiteConfig> {
  try {
    return await getOrSet<OAuthAndSiteConfig>(
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

        const names = Object.keys(oauth);
        if (names.length > 0) {
          console.log(`[auth] OAuth providers loaded: ${names.join(", ")}`);
        }

        return { oauth, siteUrl: config.siteUrl || null };
      },
      300,
    );
  } catch (err) {
    console.error("[auth] Failed to load OAuth config:", err);
    return { oauth: {}, siteUrl: null };
  }
}

// ---------------------------------------------------------------------------
// Trusted‑origins helper
// ---------------------------------------------------------------------------

const LOCAL_ORIGIN_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

function buildTrustedOrigins(baseURL: string) {
  const staticOrigins = new Set(
    [baseURL, process.env.NEXT_PUBLIC_APP_URL].filter((v): v is string => !!v),
  );

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
  return (
    siteUrl ||
    process.env.BETTER_AUTH_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

function createAuthInstance(oauthConfig: OAuthConfig, siteUrl?: string) {
  const baseURL = resolveBaseURL(siteUrl);

  console.log(
    `[auth] Creating auth instance: baseURL=${baseURL}, providers=${Object.keys(oauthConfig).join(",") || "none"}`,
  );

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
              const prefix = (user.email?.split("@")[0] || "user")
                .replace(/[^a-zA-Z0-9_]/g, "_")
                .slice(0, 14);
              const suffix =
                Date.now().toString(36).slice(-4) +
                Math.random().toString(36).slice(2, 6);
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
      fields: { name: "nickname", image: "avatar" },
      additionalFields: {
        emailVerified: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
          fieldName: "emailVerified",
          transform: {
            input: (value: unknown) => {
              if (typeof value === "boolean") return value ? new Date() : null;
              return value;
            },
            output: (value: unknown) => {
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
        trustedProviders: OAUTH_PROVIDER_KEYS.map(
          (k) => k.toLowerCase(),
        ) as Array<Lowercase<OAuthProviderKey>>,
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
  const { oauth, siteUrl } = await getOAuthAndSiteConfig();
  const configHash = JSON.stringify({ oauth, siteUrl });

  if (_cached?.hash === configHash) {
    return _cached.auth;
  }

  if (_pending) return _pending;

  _pending = (async () => {
    try {
      const instance = createAuthInstance(oauth, siteUrl || undefined);
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
  await deleteCache("oauth:config");
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

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
