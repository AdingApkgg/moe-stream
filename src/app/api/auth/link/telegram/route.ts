import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTelegramWidgetAuth, verifyTmaInitData, type VerifiedTelegramAuth } from "@/lib/telegram-auth";

/**
 * 为已登录用户绑定 Telegram 账号。
 *
 * Better Auth 内置的 `linkSocial` 仅识别标准 OAuth provider（`socialProviders` 或 `genericOAuth` 注册的），
 * 不认自定义的 `telegramAuth` 插件。这里用独立端点承接 settings 页的绑定动作。
 *
 * 入参与 `/api/auth/sign-in/telegram` 相同：`{ initData }` 或 `{ widget }`。
 * 错误码与 `LINK_ERROR_MESSAGES`（settings/account）对齐，便于回调页跳回后展示。
 */

const bodySchema = z.object({
  initData: z.string().optional(),
  widget: z.record(z.string(), z.string()).optional(),
});

const PROVIDER_ID = "telegram";

async function getBotToken(): Promise<string | null> {
  const row = await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select: { oauthTelegramBotToken: true },
  });
  return row?.oauthTelegramBotToken || null;
}

export async function POST(req: Request) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "请先登录" }, { status: 401 });
  }

  const botToken = await getBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "bot_not_configured", message: "Telegram Bot Token 未配置" }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "请求体格式错误" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: "参数错误" }, { status: 400 });
  }

  const { initData, widget } = parsed.data;
  if (!initData && !widget) {
    return NextResponse.json({ error: "invalid_payload", message: "缺少 initData 或 widget 字段" }, { status: 400 });
  }

  let verified: VerifiedTelegramAuth | null = null;
  if (initData) {
    verified = verifyTmaInitData(initData, botToken);
  } else if (widget) {
    verified = verifyTelegramWidgetAuth(widget, botToken);
  }
  if (!verified) {
    return NextResponse.json({ error: "verify_failed", message: "Telegram 验签失败或已过期" }, { status: 401 });
  }

  const providerAccountId = String(verified.user.id);
  const userId = session.user.id;

  const existing = await prisma.account.findFirst({
    where: { provider: PROVIDER_ID, providerAccountId },
    select: { id: true, userId: true },
  });

  if (existing) {
    if (existing.userId === userId) {
      return NextResponse.json({ ok: true, alreadyLinked: true });
    }
    return NextResponse.json(
      {
        error: "account_already_linked_to_different_user",
        message: "该 Telegram 账号已被其他用户绑定",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.account.create({
      data: {
        userId,
        type: "oauth",
        provider: PROVIDER_ID,
        providerAccountId,
      },
    });
  } catch (err) {
    console.error("[auth] link telegram failed:", err);
    return NextResponse.json({ error: "unable_to_link_account", message: "绑定失败，请稍后重试" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
