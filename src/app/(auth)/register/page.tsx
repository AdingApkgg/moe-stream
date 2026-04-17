"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { EmailCodeInput } from "@/components/ui/email-code-input";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { UnifiedCaptcha, type CaptchaType } from "@/components/ui/unified-captcha";
import { useSiteConfig } from "@/contexts/site-config";
import { getFingerprint } from "@/hooks/use-fingerprint";

function getReferralCode(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)ref_code=([^;]*)/);
  return match?.[1] || undefined;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteConfig = useSiteConfig();
  const allowRegistration = siteConfig?.allowRegistration ?? true;
  const [referralCode, setReferralCode] = useState<string | undefined>();

  useEffect(() => {
    const fromUrl = searchParams.get("ref") || undefined;
    const fromCookie = getReferralCode();
    setReferralCode(fromUrl || fromCookie);
  }, [searchParams]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const requireEmailVerify = siteConfig?.requireEmailVerify ?? false;

  const turnstileSiteKey = siteConfig?.turnstileSiteKey;
  const recaptchaSiteKey = siteConfig?.recaptchaSiteKey;
  const hcaptchaSiteKey = siteConfig?.hcaptchaSiteKey;
  const rawCaptchaType = (siteConfig?.captchaRegister as CaptchaType) || "none";
  const captchaType = (() => {
    if (rawCaptchaType === "turnstile" && !turnstileSiteKey) return "math";
    if (rawCaptchaType === "recaptcha" && !recaptchaSiteKey) return "math";
    if (rawCaptchaType === "hcaptcha" && !hcaptchaSiteKey) return "math";
    return rawCaptchaType;
  })();
  const isTokenCaptcha = captchaType === "turnstile" || captchaType === "recaptcha" || captchaType === "hcaptcha";

  const [captchaKey, setCaptchaKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [sliderValue, setSliderValue] = useState<number | null>(null);

  const registerSchema = useMemo(
    () =>
      z
        .object({
          username: z
            .string()
            .min(3, "用户名至少3个字符")
            .max(20, "用户名最多20个字符")
            .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
          email: z.string().email("请输入有效的邮箱地址").or(z.literal("")),
          password: z.string().min(6, "密码至少6个字符"),
          confirmPassword: z.string(),
          emailCode: z.string().optional(),
          captcha: captchaType === "math" ? z.string().min(1, "请输入计算结果") : z.string().optional(),
          inviteCode: z.string().optional(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "两次密码不一致",
          path: ["confirmPassword"],
        })
        .refine(
          (data) => {
            if (requireEmailVerify && !data.email) return false;
            return true;
          },
          { message: "开启邮箱验证时必须填写邮箱", path: ["email"] },
        )
        .refine(
          (data) => {
            if (requireEmailVerify && data.email && data.emailCode?.length !== 6) return false;
            return true;
          },
          { message: "请输入6位验证码", path: ["emailCode"] },
        ),
    [captchaType, requireEmailVerify],
  );

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const registerMutation = trpc.user.register.useMutation({
    onError: (error) => {
      toast.error("注册失败", { description: error.message });
    },
  });

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      emailCode: "",
      captcha: "",
      inviteCode: "",
    },
  });

  useEffect(() => {
    if (referralCode) {
      form.setValue("inviteCode", referralCode);
    }
  }, [referralCode, form]);

  useEffect(() => {
    if (requireEmailVerify) {
      setShowEmail(true);
    }
  }, [requireEmailVerify]);

  const email = form.watch("email");
  const hasEmail = !!email && email.includes("@");

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    try {
      if (captchaType !== "none") {
        let captchaBody: Record<string, unknown>;
        if (isTokenCaptcha) {
          captchaBody = { type: captchaType, turnstileToken };
        } else if (captchaType === "slider") {
          captchaBody = { type: "slider", captcha: String(sliderValue ?? 0) };
        } else {
          captchaBody = { type: "math", captcha: data.captcha };
        }
        const captchaRes = await fetch("/api/captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(captchaBody),
        });
        const captchaResult = await captchaRes.json();

        if (!captchaResult.valid) {
          toast.error(captchaResult.message || "验证失败");
          setCaptchaKey((k) => k + 1);
          setTurnstileToken("");
          setSliderValue(null);
          form.setValue("captcha", "");
          setIsLoading(false);
          return;
        }
      }

      const fp = await getFingerprint().catch(() => "");

      await registerMutation.mutateAsync({
        email: data.email || undefined,
        emailCode: data.emailCode || undefined,
        username: data.username,
        password: data.password,
        referralCode: data.inviteCode || referralCode,
        fingerprint: fp || undefined,
      });

      const signInResult = data.email
        ? await authClient.signIn.email({ email: data.email, password: data.password })
        : await authClient.signIn.username({ username: data.username.toLowerCase(), password: data.password });

      if (signInResult?.error) {
        toast.success("注册成功", { description: "请手动登录您的账户" });
        router.push("/login");
      } else {
        toast.success("注册成功", { description: "已自动登录" });
        if (fp) {
          fetch("/api/auth/session-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: fp }),
          }).catch(() => {});
        }
        router.push("/");
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (!allowRegistration) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-400 ease-out fill-mode-both">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">注册已关闭</CardTitle>
              <CardDescription>当前不允许新用户注册</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/login">
                <Button variant="outline">前往登录</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-400 ease-out fill-mode-both">
        <Card>
          <CardHeader className="text-center">
            <div>
              <CardTitle className="text-2xl">注册</CardTitle>
              <CardDescription>创建一个新账户</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名</FormLabel>
                      <FormControl>
                        <Input placeholder="用户名（用于登录和展示）" autoComplete="username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!showEmail && !requireEmailVerify && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowEmail(true)}
                  >
                    <ChevronDown className="h-4 w-4" />
                    添加邮箱（可选）
                  </button>
                )}

                {showEmail && (
                  <>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>
                              邮箱{!requireEmailVerify && <span className="text-muted-foreground ml-1">（选填）</span>}
                            </FormLabel>
                            {!requireEmailVerify && (
                              <button
                                type="button"
                                className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => {
                                  setShowEmail(false);
                                  form.setValue("email", "");
                                  form.setValue("emailCode", "");
                                }}
                              >
                                <ChevronUp className="h-3 w-3" />
                                收起
                              </button>
                            )}
                          </div>
                          <FormControl>
                            <Input type="email" placeholder="your@email.com" autoComplete="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {hasEmail && (
                      <FormField
                        control={form.control}
                        name="emailCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              邮箱验证码
                              {!requireEmailVerify && (
                                <span className="text-muted-foreground ml-1">（选填，验证后邮箱受保护）</span>
                              )}
                            </FormLabel>
                            <FormControl>
                              <EmailCodeInput
                                email={email || ""}
                                type="REGISTER"
                                value={field.value || ""}
                                onChange={field.onChange}
                                error={form.formState.errors.emailCode?.message}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>确认密码</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inviteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邀请码（选填）</FormLabel>
                      <FormControl>
                        <Input placeholder="输入邀请码" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {captchaType === "math" && (
                  <FormField
                    control={form.control}
                    name="captcha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>验证码</FormLabel>
                        <FormControl>
                          <UnifiedCaptcha
                            type="math"
                            mathValue={field.value || ""}
                            onMathChange={field.onChange}
                            mathError={form.formState.errors.captcha?.message}
                            refreshKey={captchaKey}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                {captchaType === "slider" && (
                  <div className="space-y-2">
                    <UnifiedCaptcha type="slider" onSliderVerify={(p) => setSliderValue(p)} refreshKey={captchaKey} />
                  </div>
                )}
                {isTokenCaptcha && (
                  <div className="space-y-2">
                    <UnifiedCaptcha
                      type={captchaType}
                      turnstileSiteKey={turnstileSiteKey}
                      recaptchaSiteKey={recaptchaSiteKey}
                      hcaptchaSiteKey={hcaptchaSiteKey}
                      onTurnstileVerify={handleTurnstileVerify}
                      onTurnstileExpire={handleTurnstileExpire}
                      refreshKey={captchaKey}
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isLoading ||
                    (isTokenCaptcha && !turnstileToken) ||
                    (captchaType === "slider" && sliderValue === null)
                  }
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  注册
                </Button>
              </form>
            </Form>

            <SocialLoginButtons callbackURL="/" />

            <div className="mt-6 text-center text-sm text-muted-foreground">
              已有账户？{" "}
              <Link href="/login" className="text-primary hover:underline">
                立即登录
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RegisterFallback() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Skeleton className="h-8 w-24 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
