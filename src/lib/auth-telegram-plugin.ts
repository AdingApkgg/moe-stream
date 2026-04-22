/**
 * Better Auth Telegram 登录插件
 *
 * 暴露 `POST /api/auth/sign-in/telegram`，接受以下任一载荷：
 * - `{ initData: string }` — 来自 Telegram Mini App（`window.Telegram.WebApp.initData`）
 * - `{ widget: Record<string, string> }` — 来自 Telegram Login Widget 的回调参数
 *
 * 流程：
 *   验签 → 查 Account(provider="telegram", accountId=tgId) → 找不到则创建 User + Account →
 *   createSession + setSessionCookie → 返回 { token, user }
 *
 * 注意：TG 用户可能无 email，本插件统一生成合成邮箱 `tg-${id}@telegram.local`
 * 以满足 Better Auth `BaseUser.email: z.string()` 的要求，并借助 email 唯一约束防止重复建号。
 */

import { APIError } from "@better-auth/core/error";
import { createAuthEndpoint } from "@better-auth/core/api";
import type { GenericEndpointContext } from "@better-auth/core";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";
import {
  verifyTmaInitData,
  verifyTelegramWidgetAuth,
  buildTelegramDisplayName,
  type TelegramAuthUser,
  type VerifiedTelegramAuth,
} from "@/lib/telegram-auth";

export interface TelegramPluginOptions {
  /** Bot Token，用于 HMAC 验签。建议在运行时从数据库读取后再实例化插件。 */
  botToken: string;
}

const bodySchema = z.object({
  initData: z.string().optional(),
  widget: z.record(z.string(), z.string()).optional(),
  callbackURL: z.string().optional(),
});

const PROVIDER_ID = "telegram";

const ERROR_CODES = {
  BOT_TOKEN_NOT_CONFIGURED: "Telegram Bot Token 未配置",
  INVALID_PAYLOAD: "缺少 initData 或 widget 字段",
  VERIFY_FAILED: "Telegram 验签失败或已过期",
  CREATE_SESSION_FAILED: "创建会话失败",
} as const;

function buildSyntheticEmail(tgId: number): string {
  return `tg-${tgId}@telegram.local`;
}

/**
 * 根据 verified 用户数据，找到已绑定的本地用户或创建新用户。
 * 返回 Better Auth 内部 User 对象。
 */
async function resolveOrCreateUser(ctx: GenericEndpointContext, tgUser: TelegramAuthUser) {
  const internal = ctx.context.internalAdapter;
  const providerAccountId = String(tgUser.id);

  const existingAccount = await internal.findAccountByProviderId(providerAccountId, PROVIDER_ID);
  if (existingAccount) {
    const user = await internal.findUserById(existingAccount.userId);
    if (user) return user;
    // 账号存在但用户已被删——兜底清理并重新建
    await internal.deleteAccount(existingAccount.id);
  }

  const displayName = buildTelegramDisplayName(tgUser);
  const email = buildSyntheticEmail(tgUser.id);

  // 合成邮箱理论上唯一；极小概率残留旧记录时走 linkAccount 绑定
  const byEmail = await internal.findUserByEmail(email);
  if (byEmail?.user) {
    await internal.linkAccount({
      userId: byEmail.user.id,
      providerId: PROVIDER_ID,
      accountId: providerAccountId,
    });
    return byEmail.user;
  }

  const { user } = await internal.createOAuthUser(
    {
      email,
      emailVerified: false,
      name: displayName,
      image: tgUser.photoUrl ?? null,
    },
    {
      providerId: PROVIDER_ID,
      accountId: providerAccountId,
    },
  );
  return user;
}

/**
 * 创建 Telegram 登录插件。若未配置 botToken，插件仍会注册端点但返回 503。
 */
export function telegramAuth(options: TelegramPluginOptions) {
  return {
    id: "telegram-auth",
    endpoints: {
      signInTelegram: createAuthEndpoint(
        "/sign-in/telegram",
        {
          method: "POST",
          body: bodySchema,
        },
        async (ctx) => {
          if (!options.botToken) {
            throw new APIError("SERVICE_UNAVAILABLE", { message: ERROR_CODES.BOT_TOKEN_NOT_CONFIGURED });
          }

          const { initData, widget } = ctx.body;
          if (!initData && !widget) {
            throw new APIError("BAD_REQUEST", { message: ERROR_CODES.INVALID_PAYLOAD });
          }

          let verified: VerifiedTelegramAuth | null = null;
          if (initData) {
            verified = verifyTmaInitData(initData, options.botToken);
          } else if (widget) {
            verified = verifyTelegramWidgetAuth(widget, options.botToken);
          }

          if (!verified) {
            throw new APIError("UNAUTHORIZED", { message: ERROR_CODES.VERIFY_FAILED });
          }

          const user = await resolveOrCreateUser(ctx, verified.user);

          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", { message: ERROR_CODES.CREATE_SESSION_FAILED });
          }

          await setSessionCookie(ctx, { session, user });

          return ctx.json({
            token: session.token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            },
            source: verified.source,
          });
        },
      ),
    },
  } as const;
}
