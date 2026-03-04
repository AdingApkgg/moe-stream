import { getServerConfig } from "@/lib/server-config";
import * as crypto from "crypto";

export type CaptchaType = "none" | "math" | "turnstile";

const CAPTCHA_SECRET = process.env.BETTER_AUTH_SECRET || "captcha-fallback-secret";
const MATH_CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 min

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * HMAC-sign a math captcha answer so the cookie never leaks the plaintext.
 * Format: `hmac:nonce:timestamp`
 */
export function signMathAnswer(answer: string): string {
  const nonce = crypto.randomBytes(8).toString("hex");
  const ts = Date.now().toString();
  const mac = crypto
    .createHmac("sha256", CAPTCHA_SECRET)
    .update(`${answer}:${nonce}:${ts}`)
    .digest("hex");
  return `${mac}:${nonce}:${ts}`;
}

function verifyMathSigned(userInput: string, signedCookie: string): boolean {
  const parts = signedCookie.split(":");
  if (parts.length !== 3) return false;
  const [mac, nonce, ts] = parts;

  const elapsed = Date.now() - parseInt(ts, 10);
  if (isNaN(elapsed) || elapsed > MATH_CAPTCHA_TTL_MS || elapsed < 0) return false;

  const expected = crypto
    .createHmac("sha256", CAPTCHA_SECRET)
    .update(`${userInput.trim()}:${nonce}:${ts}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const config = await getServerConfig();
  const secretKey = config.turnstileSecretKey;

  if (!secretKey) {
    console.error("[Turnstile] Secret key not configured");
    return false;
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("[Turnstile] Verification failed:", error);
    return false;
  }
}

export async function verifyCaptcha(
  type: CaptchaType,
  token: string | undefined,
  mathCookieValue: string | undefined
): Promise<{ valid: boolean; message: string }> {
  if (type === "none") {
    return { valid: true, message: "" };
  }

  if (type === "math") {
    if (!token || !mathCookieValue) {
      return { valid: false, message: "验证码已过期" };
    }
    const isValid = verifyMathSigned(token, mathCookieValue);
    return {
      valid: isValid,
      message: isValid ? "验证成功" : "验证码错误",
    };
  }

  if (type === "turnstile") {
    if (!token) {
      return { valid: false, message: "请完成人机验证" };
    }
    const isValid = await verifyTurnstileToken(token);
    return {
      valid: isValid,
      message: isValid ? "验证成功" : "人机验证失败，请重试",
    };
  }

  return { valid: false, message: "未知验证类型" };
}
