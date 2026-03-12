"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/lib/toast-with-sound";
import { Loader2, Fingerprint } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { UnifiedCaptcha, type CaptchaType } from "@/components/ui/unified-captcha";
import { useSiteConfig } from "@/contexts/site-config";
import { getFingerprint } from "@/hooks/use-fingerprint";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteConfig = useSiteConfig();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const prefillAccount = searchParams.get("account") || "";
  const isNewAccount = searchParams.get("new") === "1";
  const [isLoading, setIsLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const turnstileSiteKey = siteConfig?.turnstileSiteKey;
  const rawCaptchaType = (siteConfig?.captchaLogin as CaptchaType) || "math";
  const captchaType = rawCaptchaType === "turnstile" && !turnstileSiteKey ? "none" : rawCaptchaType;

  const [captchaKey, setCaptchaKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");

  const loginSchema = z.object({
    identifier: z.string().min(1, "请输入邮箱或用户名"),
    password: z.string().min(6, "密码至少6个字符"),
    captcha: captchaType === "math" ? z.string().min(1, "请输入计算结果") : z.string().optional(),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: prefillAccount,
      password: "",
      captcha: "",
    },
  });

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError === "OAuthCallbackError") {
      toast.error("第三方登录失败", { description: "OAuth 回调过程中发生异常，请重试" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!PublicKeyCredential?.isConditionalMediationAvailable) return;
    Promise.resolve(PublicKeyCredential.isConditionalMediationAvailable()).then((available) => {
      if (!available) return;
      authClient.signIn.passkey({ autoFill: true }).then((res) => {
        if (res?.data && !("twoFactorRedirect" in res.data)) {
          toast.success("登录成功");
          router.push(callbackUrl);
          router.refresh();
        }
      }).catch(() => {});
    }).catch(() => {});
  }, [callbackUrl, router]);

  const handlePasskeySignIn = useCallback(async () => {
    setPasskeyLoading(true);
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        toast.error("通行密钥登录失败", { description: result.error.message });
      } else if (result?.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        router.push(`/2fa?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      } else if (result?.data) {
        toast.success("登录成功");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("通行密钥登录失败");
    } finally {
      setPasskeyLoading(false);
    }
  }, [callbackUrl, router]);

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      if (captchaType !== "none") {
        const captchaRes = await fetch("/api/captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            captchaType === "turnstile"
              ? { type: "turnstile", turnstileToken }
              : { captcha: data.captcha, type: "math" }
          ),
        });
        const captchaResult = await captchaRes.json();

        if (!captchaResult.valid) {
          toast.error(captchaResult.message || "验证失败");
          setCaptchaKey((k) => k + 1);
          setTurnstileToken("");
          form.setValue("captcha", "");
          setIsLoading(false);
          return;
        }
      }

      const isEmail = data.identifier.includes("@");
      const result = isEmail
        ? await authClient.signIn.email({ email: data.identifier, password: data.password })
        : await authClient.signIn.username({ username: data.identifier, password: data.password });

      if (result?.error) {
        toast.error("登录失败", { description: result.error.message ?? "账号或密码错误" });
        setCaptchaKey((k) => k + 1);
        setTurnstileToken("");
        form.setValue("captcha", "");
      } else if (result?.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        router.push(`/2fa?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      } else {
        toast.success("登录成功");
        getFingerprint().then((fp) => {
          fetch("/api/auth/session-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: fp }),
          }).catch(() => {});
        }).catch(() => {});
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("登录失败", { description: "发生未知错误" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-400 ease-out fill-mode-both">
        <Card>
          <CardHeader className="text-center">
            <div>
              <CardTitle className="text-2xl">
                {isNewAccount ? "添加账号" : prefillAccount ? "切换账号" : "登录"}
              </CardTitle>
              <CardDescription>
                {isNewAccount 
                  ? "登录其他账号以添加到账号列表" 
                  : prefillAccount 
                  ? "请输入密码以切换账号" 
                  : "登录您的账户继续"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱或用户名</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="邮箱或用户名"
                        autoComplete="username webauthn"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" autoComplete="current-password webauthn" {...field} />
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
              {captchaType === "turnstile" && (
                <div className="space-y-2">
                  <UnifiedCaptcha
                    type="turnstile"
                    turnstileSiteKey={turnstileSiteKey}
                    onTurnstileVerify={handleTurnstileVerify}
                    onTurnstileExpire={handleTurnstileExpire}
                    refreshKey={captchaKey}
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || (captchaType === "turnstile" && !turnstileToken)}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                登录
              </Button>
            </form>
          </Form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">或</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={passkeyLoading}
            onClick={handlePasskeySignIn}
          >
            {passkeyLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="mr-2 h-4 w-4" />
            )}
            使用通行密钥登录
          </Button>

          <SocialLoginButtons callbackURL={callbackUrl} />

          <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
            <div>
              <Link href="/forgot-password" className="text-primary hover:underline">
                忘记密码？
              </Link>
            </div>
            <div>
              还没有账户？{" "}
              <Link href="/register" className="text-primary hover:underline">
                立即注册
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function LoginFallback() {
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
