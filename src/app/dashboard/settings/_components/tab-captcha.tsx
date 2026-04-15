"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { z } from "zod";
import { Copy, Loader2, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { captchaTabSchema, captchaType, pickCaptchaValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

type CaptchaType = z.infer<typeof captchaType>;

export function TabCaptcha({ config }: { config: SiteConfig | undefined }) {
  const redirectOpts = useRedirectOptions();
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: captchaTabSchema,
    pickValues: pickCaptchaValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              验证码 / 人机验证
            </CardTitle>
            <CardDescription>
              为不同场景配置验证码方式。支持本地验证（数学、滑块）和第三方平台（Turnstile、reCAPTCHA、hCaptcha）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="whitespace-nowrap text-sm text-muted-foreground">统一设置所有场景</span>
              <Select
                onValueChange={(v) => {
                  const val = v as CaptchaType;
                  form.setValue("captchaLogin", val, { shouldDirty: true });
                  form.setValue("captchaRegister", val, { shouldDirty: true });
                  form.setValue("captchaComment", val, { shouldDirty: true });
                  form.setValue("captchaForgotPassword", val, { shouldDirty: true });
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="选择类型..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">全部关闭</SelectItem>
                  <SelectItem value="math">全部数学验证码</SelectItem>
                  <SelectItem value="slider">全部滑块验证</SelectItem>
                  <SelectItem value="turnstile">全部 Turnstile</SelectItem>
                  <SelectItem value="recaptcha">全部 reCAPTCHA</SelectItem>
                  <SelectItem value="hcaptcha">全部 hCaptcha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const vals = [
                form.watch("captchaLogin"),
                form.watch("captchaRegister"),
                form.watch("captchaComment"),
                form.watch("captchaForgotPassword"),
              ];
              const warnings: string[] = [];
              if (
                vals.includes("turnstile") &&
                (!form.watch("turnstileSiteKey")?.trim() || !form.watch("turnstileSecretKey")?.trim())
              ) {
                warnings.push("Turnstile 密钥未配置");
              }
              if (
                vals.includes("recaptcha") &&
                (!form.watch("recaptchaSiteKey")?.trim() || !form.watch("recaptchaSecretKey")?.trim())
              ) {
                warnings.push("reCAPTCHA 密钥未配置");
              }
              if (
                vals.includes("hcaptcha") &&
                (!form.watch("hcaptchaSiteKey")?.trim() || !form.watch("hcaptchaSecretKey")?.trim())
              ) {
                warnings.push("hCaptcha 密钥未配置");
              }
              if (warnings.length === 0) return null;
              return (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warnings.join("、")}。未配置密钥时前端将自动跳过验证，请在下方填写对应平台密钥。</span>
                </div>
              );
            })()}

            <div className="space-y-4">
              {(
                [
                  { name: "captchaLogin" as const, label: "登录", desc: "用户登录时需要完成的验证" },
                  {
                    name: "captchaRegister" as const,
                    label: "注册",
                    desc: "用户注册时需要完成的验证（邮箱验证码独立于此设置）",
                  },
                  { name: "captchaComment" as const, label: "评论", desc: "用户发表评论时需要完成的验证" },
                  {
                    name: "captchaForgotPassword" as const,
                    label: "忘记密码",
                    desc: "用户重置密码时需要完成的验证",
                  },
                ] as const
              ).map(({ name, label, desc }) => {
                const captchaLabels: Record<string, string> = {
                  none: "关闭",
                  math: "数学",
                  slider: "滑块",
                  turnstile: "Turnstile",
                  recaptcha: "reCAPTCHA",
                  hcaptcha: "hCaptcha",
                };
                return (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          {label}
                          <Badge
                            variant={field.value === "none" ? "outline" : "default"}
                            className="px-1.5 py-0 text-[10px] font-normal"
                          >
                            {captchaLabels[field.value] ?? field.value}
                          </Badge>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择验证码类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">无验证</SelectItem>
                            <SelectItem value="math">数学验证码</SelectItem>
                            <SelectItem value="slider">滑块验证</SelectItem>
                            <SelectItem value="turnstile">Cloudflare Turnstile</SelectItem>
                            <SelectItem value="recaptcha">Google reCAPTCHA v2</SelectItem>
                            <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>{desc}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>

            <div className="space-y-4 border-t pt-6">
              <h4 className="font-medium">Cloudflare Turnstile 配置</h4>
              <FormDescription className="mt-0">
                在{" "}
                <a
                  href={getRedirectUrl("https://dash.cloudflare.com/?to=/:account/turnstile", redirectOpts)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Cloudflare Dashboard
                </a>{" "}
                创建 Turnstile 站点后获取密钥。
              </FormDescription>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="turnstileSiteKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Key</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="0x..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="turnstileSecretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secret Key</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="password" placeholder="0x..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h4 className="font-medium">Google reCAPTCHA v2 配置</h4>
              <FormDescription className="mt-0">
                在{" "}
                <a
                  href={getRedirectUrl("https://www.google.com/recaptcha/admin", redirectOpts)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google reCAPTCHA 管理后台
                </a>{" "}
                创建 v2 (Checkbox) 类型站点后获取密钥。
              </FormDescription>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="recaptchaSiteKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Key</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="6Le..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recaptchaSecretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secret Key</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="password" placeholder="6Le..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              <h4 className="font-medium">hCaptcha 配置</h4>
              <FormDescription className="mt-0">
                在{" "}
                <a
                  href={getRedirectUrl("https://dashboard.hcaptcha.com/", redirectOpts)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  hCaptcha Dashboard
                </a>{" "}
                创建站点后获取密钥。hCaptcha 注重隐私保护，是 reCAPTCHA 的替代方案。
              </FormDescription>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="hcaptchaSiteKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Key</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="站点密钥" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hcaptchaSecretKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secret Key</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="password" placeholder="密钥" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
              <p className="mb-1 font-medium">验证码类型说明</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                <li>
                  <strong>无验证</strong>：不需要任何额外验证
                </li>
                <li>
                  <strong>数学验证码</strong>：本地生成，答案通过 HMAC 签名验证，无需外部服务
                </li>
                <li>
                  <strong>滑块验证</strong>：本地拖拽交互验证，无需外部服务，体验友好
                </li>
                <li>
                  <strong>Cloudflare Turnstile</strong>：无感人机验证，需配置 Cloudflare 密钥
                </li>
                <li>
                  <strong>Google reCAPTCHA v2</strong>：复选框人机验证，需配置 Google 密钥
                </li>
                <li>
                  <strong>hCaptcha</strong>：注重隐私的人机验证，需配置 hCaptcha 密钥
                </li>
              </ul>
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存设置
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
