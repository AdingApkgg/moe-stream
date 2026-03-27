import { describe, it, expect } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "../trpc";
import { isPrivileged } from "@/lib/permissions";
import { ADMIN_SCOPES, type AdminScope } from "@/lib/constants";
import { createMockContext, createAuthedContext, createAdminContext, createOwnerContext } from "./helpers";

const t = initTRPC.context<Context>().create({ transformer: superjson });

const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});

const enforceUserIsAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const role = ctx.session.user.role ?? "USER";
  if (!isPrivileged(role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  const scopes = role === "OWNER" ? Object.keys(ADMIN_SCOPES) : ([] as string[]);
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      adminRole: role as "ADMIN" | "OWNER",
      adminScopes: scopes,
    },
  });
});

function requireScope(scope: AdminScope) {
  return t.middleware(async ({ ctx, next }) => {
    const scopes = (ctx as Record<string, unknown>).adminScopes as string[] | undefined;
    if (!scopes?.includes(scope)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `缺少权限: ${ADMIN_SCOPES[scope]}`,
      });
    }
    return next();
  });
}

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
const adminProcedure = t.procedure.use(enforceUserIsAdmin);

const testRouter = t.router({
  publicGreet: publicProcedure.query(() => "hello"),
  protectedGreet: protectedProcedure.query(({ ctx }) => {
    return `hello ${ctx.session.user.name}`;
  }),
  adminGreet: adminProcedure.query(({ ctx }) => {
    return `admin ${(ctx as { adminRole: string }).adminRole}`;
  }),
  adminWithScope: adminProcedure.use(requireScope("video:manage")).query(() => "scoped"),
});

const caller = t.createCallerFactory(testRouter);

describe("公开路由", () => {
  it("未登录也可访问", async () => {
    const ctx = createMockContext();
    const result = await caller(ctx).publicGreet();
    expect(result).toBe("hello");
  });

  it("已登录也可访问", async () => {
    const ctx = createAuthedContext();
    const result = await caller(ctx).publicGreet();
    expect(result).toBe("hello");
  });
});

describe("受保护路由 (protectedProcedure)", () => {
  it("未登录应抛出 UNAUTHORIZED", async () => {
    const ctx = createMockContext();
    await expect(caller(ctx).protectedGreet()).rejects.toThrow(TRPCError);
    await expect(caller(ctx).protectedGreet()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("已登录应正常返回", async () => {
    const ctx = createAuthedContext({ user: { name: "Alice" } });
    const result = await caller(ctx).protectedGreet();
    expect(result).toBe("hello Alice");
  });
});

describe("管理员路由 (adminProcedure)", () => {
  it("未登录应抛出 UNAUTHORIZED", async () => {
    const ctx = createMockContext();
    await expect(caller(ctx).adminGreet()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("普通用户应抛出 FORBIDDEN", async () => {
    const ctx = createAuthedContext({ user: { role: "USER" } });
    await expect(caller(ctx).adminGreet()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("ADMIN 应正常返回", async () => {
    const ctx = createAdminContext();
    const result = await caller(ctx).adminGreet();
    expect(result).toBe("admin ADMIN");
  });

  it("OWNER 应正常返回", async () => {
    const ctx = createOwnerContext();
    const result = await caller(ctx).adminGreet();
    expect(result).toBe("admin OWNER");
  });
});

describe("权限范围检查 (requireScope)", () => {
  it("OWNER 自动拥有所有 scope", async () => {
    const ctx = createOwnerContext();
    const result = await caller(ctx).adminWithScope();
    expect(result).toBe("scoped");
  });

  it("ADMIN 无对应 scope 应被拒绝", async () => {
    const ctx = createAdminContext();
    await expect(caller(ctx).adminWithScope()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
