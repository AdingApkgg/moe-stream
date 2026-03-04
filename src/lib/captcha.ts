import { getServerConfig } from "@/lib/server-config";

export type CaptchaType = "none" | "math" | "turnstile";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
    const isValid = token.toString().trim() === mathCookieValue;
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
