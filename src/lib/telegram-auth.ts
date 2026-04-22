/**
 * Telegram 登录验签工具
 *
 * 支持两种载荷：
 * - TMA `initData`（Mini App 内部）：HMAC-SHA256 with key = HMAC-SHA256("WebAppData", botToken)
 * - Login Widget `auth_data`（Web 端）：HMAC-SHA256 with key = SHA256(botToken)
 *
 * 参考：
 * - https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * - https://core.telegram.org/widgets/login#checking-authorization
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramAuthUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
  isPremium?: boolean;
}

/** 验签成功的结果 */
export interface VerifiedTelegramAuth {
  user: TelegramAuthUser;
  authDate: number;
  /** 载荷来源，用于日志/审计 */
  source: "tma" | "widget";
}

/** TMA initData 的最大生效时长（秒）：默认 24 小时 */
const TMA_MAX_AGE_SECONDS = 24 * 60 * 60;
/** Widget auth_data 的最大生效时长（秒）：默认 10 分钟（Telegram 官方示例值） */
const WIDGET_MAX_AGE_SECONDS = 10 * 60;

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * 校验 TMA 的 `initData` 字符串（形如 URLSearchParams）。
 *
 * 流程（官方）：
 * 1. 将所有 key=value 对按 key 字典序排序（排除 `hash`）
 * 2. 以 \n 连接得到 `data_check_string`
 * 3. `secret_key = HMAC-SHA256("WebAppData", botToken)`
 * 4. `calc_hash = HMAC-SHA256(secret_key, data_check_string)`
 * 5. 与载荷中的 `hash` 比对
 */
export function verifyTmaInitData(initData: string, botToken: string): VerifiedTelegramAuth | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const entries: Array<[string, string]> = [];
  params.forEach((value, key) => {
    if (key !== "hash") entries.push([key, value]);
  });
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calcHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!constantTimeEqual(calcHash, hash)) return null;

  const authDateStr = params.get("auth_date");
  const authDate = authDateStr ? Number(authDateStr) : NaN;
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > TMA_MAX_AGE_SECONDS) return null;

  const userJson = params.get("user");
  if (!userJson) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(userJson);
  } catch {
    return null;
  }
  const user = normalizeUser(raw);
  if (!user) return null;

  return { user, authDate, source: "tma" };
}

/**
 * 校验 Telegram Login Widget 的 `auth_data`。
 *
 * Widget 将用户字段作为 URL query 传给回调页：
 *   id, first_name, last_name?, username?, photo_url?, auth_date, hash
 *
 * 流程（官方）：
 * 1. 除 `hash` 外按 key 字典序排序，以 \n 连接得到 `data_check_string`
 * 2. `secret_key = SHA256(botToken)`
 * 3. `calc_hash = HMAC-SHA256(secret_key, data_check_string)`
 * 4. 与 `hash` 比对
 */
export function verifyTelegramWidgetAuth(
  authData: Record<string, string | undefined>,
  botToken: string,
): VerifiedTelegramAuth | null {
  if (!authData || !botToken) return null;
  const { hash, ...rest } = authData;
  if (!hash) return null;

  const entries = Object.entries(rest).filter(([, v]) => typeof v === "string") as Array<[string, string]>;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const calcHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!constantTimeEqual(calcHash, hash)) return null;

  const authDate = Number(rest.auth_date);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > WIDGET_MAX_AGE_SECONDS) return null;

  const id = Number(rest.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const user: TelegramAuthUser = {
    id,
    firstName: rest.first_name || "",
    lastName: rest.last_name || undefined,
    username: rest.username || undefined,
    photoUrl: rest.photo_url || undefined,
  };
  if (!user.firstName) return null;

  return { user, authDate, source: "widget" };
}

function normalizeUser(raw: Record<string, unknown>): TelegramAuthUser | null {
  const id = typeof raw.id === "number" ? raw.id : Number(raw.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const firstName = typeof raw.first_name === "string" ? raw.first_name : "";
  if (!firstName) return null;
  return {
    id,
    firstName,
    lastName: typeof raw.last_name === "string" ? raw.last_name : undefined,
    username: typeof raw.username === "string" ? raw.username : undefined,
    photoUrl: typeof raw.photo_url === "string" ? raw.photo_url : undefined,
    languageCode: typeof raw.language_code === "string" ? raw.language_code : undefined,
    isPremium: typeof raw.is_premium === "boolean" ? raw.is_premium : undefined,
  };
}

/** 生成 TG 用户的展示名：`first_name [last_name]` */
export function buildTelegramDisplayName(user: TelegramAuthUser): string {
  return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;
}
