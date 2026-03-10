"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/lib/toast-with-sound";
import { Loader2, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type VerifyMode = "totp" | "otp" | "backup";

function TwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<VerifyMode>("totp");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const handleVerifyTotp = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      });
      if (error) {
        toast.error("验证失败", { description: error.message || "验证码错误" });
        setCode("");
      } else if (data) {
        toast.success("验证成功");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("验证失败");
    } finally {
      setIsLoading(false);
    }
  }, [code, trustDevice, callbackUrl, router]);

  const handleSendOtp = useCallback(async () => {
    setOtpSending(true);
    try {
      const { error } = await authClient.twoFactor.sendOtp();
      if (error) {
        toast.error("发送失败", { description: error.message });
      } else {
        setOtpSent(true);
        toast.success("验证码已发送到您的邮箱");
      }
    } catch {
      toast.error("发送失败");
    } finally {
      setOtpSending(false);
    }
  }, []);

  const handleVerifyOtp = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await authClient.twoFactor.verifyOtp({
        code,
        trustDevice,
      });
      if (error) {
        toast.error("验证失败", { description: error.message || "验证码错误" });
        setCode("");
      } else if (data) {
        toast.success("验证成功");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("验证失败");
    } finally {
      setIsLoading(false);
    }
  }, [code, trustDevice, callbackUrl, router]);

  const handleVerifyBackup = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await authClient.twoFactor.verifyBackupCode({
        code,
        trustDevice,
      });
      if (error) {
        toast.error("验证失败", {
          description: error.message || "恢复码无效",
        });
        setCode("");
      } else if (data) {
        toast.success("验证成功");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("验证失败");
    } finally {
      setIsLoading(false);
    }
  }, [code, trustDevice, callbackUrl, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    if (mode === "totp") handleVerifyTotp();
    else if (mode === "otp") handleVerifyOtp();
    else handleVerifyBackup();
  }

  const modeConfig = {
    totp: {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: "两步验证",
      description: "请输入验证器应用中的 6 位验证码",
      placeholder: "000000",
      maxLength: 6,
      inputMode: "numeric" as const,
    },
    otp: {
      icon: <Mail className="h-6 w-6" />,
      title: "邮件验证",
      description: "请输入发送到您邮箱的 6 位验证码",
      placeholder: "000000",
      maxLength: 6,
      inputMode: "numeric" as const,
    },
    backup: {
      icon: <KeyRound className="h-6 w-6" />,
      title: "备用恢复码",
      description: "请输入您保存的备用恢复码",
      placeholder: "恢复码",
      maxLength: 20,
      inputMode: "text" as const,
    },
  };

  const current = modeConfig[mode];

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-400 ease-out fill-mode-both">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {current.icon}
            </div>
            <CardTitle className="text-2xl">{current.title}</CardTitle>
            <CardDescription>{current.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "otp" && !otpSent ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleSendOtp}
                  disabled={otpSending}
                >
                  {otpSending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  发送验证码到邮箱
                </Button>
              ) : (
                <>
                  <Input
                    ref={inputRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={current.placeholder}
                    maxLength={current.maxLength}
                    inputMode={current.inputMode}
                    autoComplete="one-time-code"
                    className="text-center text-lg tracking-widest"
                  />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      className="rounded border-muted-foreground/30"
                    />
                    信任此设备 30 天
                  </label>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !code.trim()}
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    验证
                  </Button>
                </>
              )}
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              {mode !== "totp" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("totp");
                    setCode("");
                  }}
                  className="text-primary hover:underline block mx-auto"
                >
                  使用验证器应用
                </button>
              )}
              {mode !== "otp" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("otp");
                    setCode("");
                    setOtpSent(false);
                  }}
                  className="text-primary hover:underline block mx-auto"
                >
                  发送邮件验证码
                </button>
              )}
              {mode !== "backup" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("backup");
                    setCode("");
                  }}
                  className="text-muted-foreground hover:underline block mx-auto"
                >
                  使用备用恢复码
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TwoFactorFallback() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-2" />
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={<TwoFactorFallback />}>
      <TwoFactorForm />
    </Suspense>
  );
}
