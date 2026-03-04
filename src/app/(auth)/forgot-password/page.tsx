"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/lib/toast-with-sound";
import { Loader2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmailCodeInput } from "@/components/ui/email-code-input";
import { UnifiedCaptcha, type CaptchaType } from "@/components/ui/unified-captcha";
import { useSiteConfig } from "@/contexts/site-config";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const siteConfig = useSiteConfig();
  const [isLoading, setIsLoading] = useState(false);

  const turnstileSiteKey = siteConfig?.turnstileSiteKey;
  const rawCaptchaType = (siteConfig?.captchaForgotPassword as CaptchaType) || "none";
  const captchaType = rawCaptchaType === "turnstile" && !turnstileSiteKey ? "none" : rawCaptchaType;

  const [captchaKey, setCaptchaKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");

  const resetPasswordSchema = z.object({
    email: z.string().email("请输入有效的邮箱地址"),
    emailCode: z.string().length(6, "请输入6位验证码"),
    newPassword: z.string().min(6, "密码至少6个字符"),
    confirmPassword: z.string(),
    captcha: captchaType === "math" ? z.string().min(1, "请输入计算结果") : z.string().optional(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

  const resetPasswordMutation = trpc.user.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密码重置成功", { description: "请使用新密码登录" });
      router.push("/login");
    },
    onError: (error) => {
      toast.error("重置失败", { description: error.message });
    },
  });

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
      emailCode: "",
      newPassword: "",
      confirmPassword: "",
      captcha: "",
    },
  });

  const email = form.watch("email");

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  async function onSubmit(data: ResetPasswordFormValues) {
    setIsLoading(true);
    try {
      // 验证验证码
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

      // 验证邮箱验证码
      const verifyRes = await fetch("/api/email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: data.email, 
          code: data.emailCode,
          type: "RESET_PASSWORD",
        }),
      });
      const verifyResult = await verifyRes.json();

      if (!verifyResult.valid) {
        toast.error(verifyResult.message || "验证码错误");
        setIsLoading(false);
        return;
      }

      await resetPasswordMutation.mutateAsync({
        email: data.email,
        newPassword: data.newPassword,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-200px)] py-8">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div>
              <CardTitle className="text-2xl">重置密码</CardTitle>
              <CardDescription>通过邮箱验证码重置您的密码</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="your@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emailCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱验证码</FormLabel>
                    <FormControl>
                      <EmailCodeInput
                        email={email}
                        type="RESET_PASSWORD"
                        value={field.value}
                        onChange={field.onChange}
                        error={form.formState.errors.emailCode?.message}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} />
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
                    <FormLabel>确认新密码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} />
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
                重置密码
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <Link 
              href="/login" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回登录
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
