"use client";

import { CaptchaInput } from "@/components/ui/captcha-input";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import { RecaptchaWidget } from "@/components/ui/recaptcha-widget";
import { HcaptchaWidget } from "@/components/ui/hcaptcha-widget";
import { SliderCaptcha } from "@/components/ui/slider-captcha";

export type CaptchaType = "none" | "math" | "slider" | "turnstile" | "recaptcha" | "hcaptcha";

interface UnifiedCaptchaProps {
  type: CaptchaType;
  turnstileSiteKey?: string | null;
  recaptchaSiteKey?: string | null;
  hcaptchaSiteKey?: string | null;
  mathValue?: string;
  onMathChange?: (value: string) => void;
  /** Callback for third-party tokens (Turnstile / reCAPTCHA / hCaptcha) */
  onTurnstileVerify?: (token: string) => void;
  onTurnstileExpire?: () => void;
  /** Callback for slider captcha (passes percent value as string) */
  onSliderVerify?: (percent: number) => void;
  mathError?: string;
  refreshKey?: number;
}

export function UnifiedCaptcha({
  type,
  turnstileSiteKey,
  recaptchaSiteKey,
  hcaptchaSiteKey,
  mathValue = "",
  onMathChange,
  onTurnstileVerify,
  onTurnstileExpire,
  onSliderVerify,
  mathError,
  refreshKey,
}: UnifiedCaptchaProps) {
  if (type === "none") {
    return null;
  }

  if (type === "math") {
    return (
      <CaptchaInput
        key={refreshKey}
        value={mathValue}
        onChange={onMathChange || (() => {})}
        error={mathError}
      />
    );
  }

  if (type === "slider") {
    return (
      <SliderCaptcha
        key={refreshKey}
        onVerify={onSliderVerify || (() => {})}
        error={mathError}
      />
    );
  }

  if (type === "turnstile") {
    if (!turnstileSiteKey) {
      return (
        <p className="text-xs text-destructive">
          Turnstile 未配置 Site Key，验证码已跳过
        </p>
      );
    }
    return (
      <TurnstileWidget
        key={refreshKey}
        siteKey={turnstileSiteKey}
        onVerify={onTurnstileVerify || (() => {})}
        onExpire={onTurnstileExpire}
      />
    );
  }

  if (type === "recaptcha") {
    if (!recaptchaSiteKey) {
      return (
        <p className="text-xs text-destructive">
          reCAPTCHA 未配置 Site Key，验证码已跳过
        </p>
      );
    }
    return (
      <RecaptchaWidget
        key={refreshKey}
        siteKey={recaptchaSiteKey}
        onVerify={onTurnstileVerify || (() => {})}
        onExpire={onTurnstileExpire}
      />
    );
  }

  if (type === "hcaptcha") {
    if (!hcaptchaSiteKey) {
      return (
        <p className="text-xs text-destructive">
          hCaptcha 未配置 Site Key，验证码已跳过
        </p>
      );
    }
    return (
      <HcaptchaWidget
        key={refreshKey}
        siteKey={hcaptchaSiteKey}
        onVerify={onTurnstileVerify || (() => {})}
        onExpire={onTurnstileExpire}
      />
    );
  }

  return null;
}
