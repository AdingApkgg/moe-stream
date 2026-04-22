"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2, Save } from "lucide-react";
import { type OAuthTabValues, oauthTabSchema, pickOAuthValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabOauth({ config }: { config: SiteConfig | undefined }) {
  const redirectOpts = useRedirectOptions();
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: oauthTabSchema,
    pickValues: pickOAuthValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              社交登录（OAuth）
            </CardTitle>
            <CardDescription>
              配置第三方 OAuth 提供商，允许用户使用社交账号登录。填入 Client ID 和 Client Secret 即可启用，清空则禁用。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Telegram：与其他 OAuth 不同，用 Bot Token + Bot Username 而非 Client ID/Secret */}
            {(() => {
              const tgToken = form.watch("oauthTelegramBotToken");
              const tgEnabled = Boolean(tgToken?.trim());
              return (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-2 font-medium">
                    Telegram
                    {tgEnabled && (
                      <Badge variant="default" className="text-xs">
                        已启用
                      </Badge>
                    )}
                  </h4>
                  <FormDescription>
                    在{" "}
                    <a
                      href={getRedirectUrl("https://t.me/BotFather", redirectOpts)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      BotFather
                    </a>{" "}
                    创建 Bot 并获取 Token；通过 <code className="rounded bg-muted px-1 py-0.5 text-xs">/setdomain</code>{" "}
                    绑定站点域名，再用 <code className="rounded bg-muted px-1 py-0.5 text-xs">/setuserpic</code>{" "}
                    等命令完善资料。登录回调：{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">/login/telegram/callback</code>。TMA
                    内部自动使用 initData 登录，无需额外配置。
                  </FormDescription>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="oauthTelegramBotToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bot Token</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={(field.value as string) || ""}
                              type="password"
                              placeholder="123456789:ABC-..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="oauthTelegramBotUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bot Username（可选，不带 @）</FormLabel>
                          <FormControl>
                            <Input {...field} value={(field.value as string) || ""} placeholder="my_login_bot" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              );
            })()}

            <div className="border-t" />

            {(
              [
                {
                  key: "Google",
                  label: "Google",
                  callbackId: "google",
                  url: "https://console.cloud.google.com/apis/credentials",
                  urlLabel: "Google Cloud Console",
                },
                {
                  key: "Github",
                  label: "GitHub",
                  callbackId: "github",
                  url: "https://github.com/settings/developers",
                  urlLabel: "GitHub Developer Settings",
                },
                {
                  key: "Discord",
                  label: "Discord",
                  callbackId: "discord",
                  url: "https://discord.com/developers/applications",
                  urlLabel: "Discord Developer Portal",
                },
                {
                  key: "Apple",
                  label: "Apple",
                  callbackId: "apple",
                  url: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
                  urlLabel: "Apple Developer",
                },
                {
                  key: "Twitter",
                  label: "X (Twitter)",
                  callbackId: "twitter",
                  url: "https://developer.x.com/en/portal/dashboard",
                  urlLabel: "X Developer Portal",
                },
                {
                  key: "Facebook",
                  label: "Facebook",
                  callbackId: "facebook",
                  url: "https://developers.facebook.com/apps",
                  urlLabel: "Meta for Developers",
                },
                {
                  key: "Microsoft",
                  label: "Microsoft",
                  callbackId: "microsoft",
                  url: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
                  urlLabel: "Azure Portal",
                },
                {
                  key: "Twitch",
                  label: "Twitch",
                  callbackId: "twitch",
                  url: "https://dev.twitch.tv/console/apps",
                  urlLabel: "Twitch Developer Console",
                },
                {
                  key: "Spotify",
                  label: "Spotify",
                  callbackId: "spotify",
                  url: "https://developer.spotify.com/dashboard",
                  urlLabel: "Spotify Developer Dashboard",
                },
                {
                  key: "Linkedin",
                  label: "LinkedIn",
                  callbackId: "linkedin",
                  url: "https://www.linkedin.com/developers/apps",
                  urlLabel: "LinkedIn Developer Portal",
                },
                {
                  key: "Gitlab",
                  label: "GitLab",
                  callbackId: "gitlab",
                  url: "https://gitlab.com/-/user_settings/applications",
                  urlLabel: "GitLab Applications",
                },
                {
                  key: "Reddit",
                  label: "Reddit",
                  callbackId: "reddit",
                  url: "https://www.reddit.com/prefs/apps",
                  urlLabel: "Reddit App Preferences",
                },
                {
                  key: "Qq",
                  label: "QQ",
                  callbackId: "qq",
                  url: "https://connect.qq.com/manage.html",
                  urlLabel: "QQ 互联管理中心",
                },
                {
                  key: "Wechat",
                  label: "微信",
                  callbackId: "wechat",
                  url: "https://open.weixin.qq.com/",
                  urlLabel: "微信开放平台",
                },
              ] as const
            ).map(({ key, label, callbackId, url, urlLabel }, idx) => {
              const idField = `oauth${key}ClientId` as keyof OAuthTabValues;
              const secretField = `oauth${key}ClientSecret` as keyof OAuthTabValues;
              const hasId = form.watch(idField);
              const hasSecret = form.watch(secretField);
              return (
                <div key={key}>
                  {idx > 0 && <div className="mb-4 border-t" />}
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 font-medium">
                      {label}
                      {Boolean(hasId?.trim()) && Boolean(hasSecret?.trim()) && (
                        <Badge variant="default" className="text-xs">
                          已启用
                        </Badge>
                      )}
                    </h4>
                    <FormDescription>
                      在{" "}
                      <a
                        href={getRedirectUrl(url, redirectOpts)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {urlLabel}
                      </a>{" "}
                      创建应用。回调 URL：
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{站点URL}/api/auth/callback/${callbackId}`}</code>
                    </FormDescription>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={idField}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client ID</FormLabel>
                            <FormControl>
                              <Input {...field} value={(field.value as string) || ""} placeholder="Client ID" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={secretField}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Secret</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={(field.value as string) || ""}
                                type="password"
                                placeholder="••••••••"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
              <p className="mb-1 font-medium">账号关联说明</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                <li>已启用的提供商将在登录和注册页面显示对应按钮</li>
                <li>如果 OAuth 登录的邮箱与已有账号一致，将自动关联</li>
                <li>首次使用 OAuth 登录且邮箱无匹配时将自动创建新账号</li>
                <li>保存后立即生效，无需重启服务</li>
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
