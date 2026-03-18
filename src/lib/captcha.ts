import { getServerConfig } from "@/lib/server-config";
import { hmacSha256 } from "@/lib/wasm-hash";
import * as crypto from "crypto";

export type CaptchaType = "none" | "math" | "slider" | "turnstile" | "recaptcha" | "hcaptcha";

export const CAPTCHA_OPTIONS: { value: CaptchaType; label: string; group: "local" | "third-party" }[] = [
  { value: "none", label: "无验证", group: "local" },
  { value: "math", label: "数学验证码", group: "local" },
  { value: "slider", label: "滑块验证", group: "local" },
  { value: "turnstile", label: "Cloudflare Turnstile", group: "third-party" },
  { value: "recaptcha", label: "Google reCAPTCHA v2", group: "third-party" },
  { value: "hcaptcha", label: "hCaptcha", group: "third-party" },
];

const CAPTCHA_SECRET = process.env.BETTER_AUTH_SECRET || "captcha-fallback-secret";
const MATH_CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 min
const SLIDER_TOLERANCE = 6; // ±6% tolerance

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

/**
 * HMAC-sign a math/slider captcha answer (WASM)
 * Format: `hmac:nonce:timestamp`
 */
export async function signMathAnswer(answer: string): Promise<string> {
  const nonce = crypto.randomBytes(8).toString("hex");
  const ts = Date.now().toString();
  const mac = await hmacSha256(CAPTCHA_SECRET, `${answer}:${nonce}:${ts}`);
  return `${mac}:${nonce}:${ts}`;
}

async function verifyMathSigned(userInput: string, signedCookie: string): Promise<boolean> {
  const parts = signedCookie.split(":");
  if (parts.length !== 3) return false;
  const [mac, nonce, ts] = parts;

  const elapsed = Date.now() - parseInt(ts, 10);
  if (isNaN(elapsed) || elapsed > MATH_CAPTCHA_TTL_MS || elapsed < 0) return false;

  const expected = await hmacSha256(CAPTCHA_SECRET, `${userInput.trim()}:${nonce}:${ts}`);

  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function signSliderAnswer(targetPercent: number): Promise<string> {
  return signMathAnswer(String(targetPercent));
}

async function verifySliderSigned(userPercent: number, signedCookie: string): Promise<boolean> {
  const parts = signedCookie.split(":");
  if (parts.length !== 3) return false;
  const [mac, nonce, ts] = parts;

  const elapsed = Date.now() - parseInt(ts, 10);
  if (isNaN(elapsed) || elapsed > MATH_CAPTCHA_TTL_MS || elapsed < 0) return false;

  for (let offset = -SLIDER_TOLERANCE; offset <= SLIDER_TOLERANCE; offset++) {
    const candidate = String(Math.round(userPercent) + offset);
    const expected = await hmacSha256(CAPTCHA_SECRET, `${candidate}:${nonce}:${ts}`);
    try {
      if (crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return true;
    } catch {
      continue;
    }
  }
  return false;
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
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("[Turnstile] Verification failed:", error);
    return false;
  }
}

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const config = await getServerConfig();
  const secretKey = config.recaptchaSecretKey;

  if (!secretKey) {
    console.error("[reCAPTCHA] Secret key not configured");
    return false;
  }

  try {
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("[reCAPTCHA] Verification failed:", error);
    return false;
  }
}

export async function verifyHcaptchaToken(token: string): Promise<boolean> {
  const config = await getServerConfig();
  const secretKey = config.hcaptchaSecretKey;

  if (!secretKey) {
    console.error("[hCaptcha] Secret key not configured");
    return false;
  }

  try {
    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("[hCaptcha] Verification failed:", error);
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
    const isValid = await verifyMathSigned(token, mathCookieValue);
    return {
      valid: isValid,
      message: isValid ? "验证成功" : "验证码错误",
    };
  }

  if (type === "slider") {
    if (!token || !mathCookieValue) {
      return { valid: false, message: "滑块验证已过期，请重试" };
    }
    const userPercent = parseFloat(token);
    if (isNaN(userPercent)) {
      return { valid: false, message: "滑块验证数据无效" };
    }
    const isValid = await verifySliderSigned(userPercent, mathCookieValue);
    return {
      valid: isValid,
      message: isValid ? "验证成功" : "滑块验证失败，请重试",
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

  if (type === "recaptcha") {
    if (!token) {
      return { valid: false, message: "请完成 reCAPTCHA 验证" };
    }
    const isValid = await verifyRecaptchaToken(token);
    return {
      valid: isValid,
      message: isValid ? "验证成功" : "reCAPTCHA 验证失败，请重试",
    };
  }

  if (type === "hcaptcha") {
    if (!token) {
      return { valid: false, message: "请完成 hCaptcha 验证" };
    }
    const isValid = await verifyHcaptchaToken(token);
    return {
      valid: isValid,
      message: isValid ? "验证成功" : "hCaptcha 验证失败，请重试",
    };
  }

  return { valid: false, message: "未知验证类型" };
}
