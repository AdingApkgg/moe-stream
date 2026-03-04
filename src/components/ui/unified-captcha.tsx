"use client";

import { CaptchaInput } from "@/components/ui/captcha-input";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";

export type CaptchaType = "none" | "math" | "turnstile";

interface UnifiedCaptchaProps {
  type: CaptchaType;
  turnstileSiteKey?: string | null;
  mathValue?: string;
  onMathChange?: (value: string) => void;
  onTurnstileVerify?: (token: string) => void;
  onTurnstileExpire?: () => void;
  mathError?: string;
  refreshKey?: number;
}

export function UnifiedCaptcha({
  type,
  turnstileSiteKey,
  mathValue = "",
  onMathChange,
  onTurnstileVerify,
  onTurnstileExpire,
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

  if (type === "turnstile" && turnstileSiteKey) {
    return (
      <TurnstileWidget
        key={refreshKey}
        siteKey={turnstileSiteKey}
        onVerify={onTurnstileVerify || (() => {})}
        onExpire={onTurnstileExpire}
      />
    );
  }

  return null;
}
