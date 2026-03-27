import { vi } from "vitest";
import type { Context } from "../trpc";
import type { AppSession } from "@/lib/auth";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 创建 mock Prisma 客户端，所有方法返回 chainable proxy
 */
function createMockPrisma() {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      return new Proxy(
        {},
        {
          get() {
            return vi.fn().mockResolvedValue(null);
          },
        },
      );
    },
  };
  return new Proxy({}, handler) as unknown as Context["prisma"];
}

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  } as unknown as Context["redis"];
}

export function createMockSession(overrides?: DeepPartial<AppSession>): AppSession {
  return {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
      role: "USER",
      canUpload: false,
      adsEnabled: true,
      twoFactorEnabled: false,
      ...overrides?.user,
    },
    session: {
      id: "test-session-id",
      token: "test-token",
      expiresAt: new Date(Date.now() + 86400000),
      ...(overrides?.session as Record<string, unknown>),
    },
  };
}

export function createMockContext(overrides?: Partial<Context>): Context {
  return {
    prisma: createMockPrisma(),
    redis: createMockRedis(),
    session: null,
    ipv4Address: null,
    ipv6Address: null,
    userAgent: null,
    ...overrides,
  };
}

export function createAuthedContext(
  sessionOverrides?: DeepPartial<AppSession>,
  contextOverrides?: Partial<Omit<Context, "session">>,
): Context {
  return createMockContext({
    session: createMockSession(sessionOverrides),
    ...contextOverrides,
  });
}

export function createAdminContext(contextOverrides?: Partial<Omit<Context, "session">>): Context {
  return createAuthedContext({ user: { role: "ADMIN" } }, contextOverrides);
}

export function createOwnerContext(contextOverrides?: Partial<Omit<Context, "session">>): Context {
  return createAuthedContext({ user: { role: "OWNER" } }, contextOverrides);
}
