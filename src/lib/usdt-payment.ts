import { redis } from "@/lib/redis";
import { randomBytes } from "crypto";

const AMOUNT_KEY_PREFIX = "usdt:amt:";

/**
 * Generate a unique USDT amount by appending a random fractional offset.
 * Uses Redis to ensure no two pending orders share the same amount.
 */
export async function generateUniqueAmount(baseAmount: number, timeoutSec: number): Promise<number> {
  const maxRetries = 100;

  for (let i = 0; i < maxRetries; i++) {
    const offset =
      i === 0
        ? Math.floor(Math.random() * 99) + 1 // 1–99
        : (i % 99) + 1;

    const candidate = Math.round((baseAmount + offset / 100) * 100) / 100;
    const key = `${AMOUNT_KEY_PREFIX}${candidate.toFixed(2)}`;

    const set = await redis.set(key, "1", "EX", timeoutSec + 60, "NX");
    if (set === "OK") {
      return candidate;
    }
  }

  throw new Error("无法生成唯一支付金额，请稍后再试");
}

export async function releaseAmount(amount: number): Promise<void> {
  const key = `${AMOUNT_KEY_PREFIX}${amount.toFixed(2)}`;
  try {
    await redis.del(key);
  } catch {
    // Redis down — acceptable, key will expire naturally
  }
}

export function generateOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `U${ts}${rand}`;
}
