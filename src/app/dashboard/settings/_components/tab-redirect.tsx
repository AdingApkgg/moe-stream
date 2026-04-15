"use client";

import { useState } from "react";
import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X, Plus } from "lucide-react";
import { redirectTabSchema, pickRedirectValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabRedirect({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: redirectTabSchema,
    pickValues: pickRedirectValues,
    config,
  });

  const [domainInput, setDomainInput] = useState("");
  const whitelist = form.watch("redirectWhitelist") ?? [];
  const redirectEnabled = form.watch("redirectEnabled");

  const addDomain = () => {
    const raw = domainInput.trim().toLowerCase();
    if (!raw) return;
    const domains = raw
      .split(/[\n,;]+/)
      .map((d) =>
        d
          .trim()
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, ""),
      )
      .filter((d) => d && !whitelist.includes(d));

    if (domains.length > 0) {
      form.setValue("redirectWhitelist", [...whitelist, ...domains], { shouldDirty: true });
    }
    setDomainInput("");
  };

  const removeDomain = (domain: string) => {
    form.setValue(
      "redirectWhitelist",
      whitelist.filter((d: string) => d !== domain),
      { shouldDirty: true },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>外链中转</CardTitle>
            <CardDescription>用户点击外部链接时，先跳转到中转页提示确认，防止恶意链接</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="redirectEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用外链中转</FormLabel>
                    <FormDescription>关闭后所有外部链接将直接跳转，不显示中转确认页</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {redirectEnabled && (
              <>
                <FormField
                  control={form.control}
                  name="redirectCountdown"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>倒计时秒数</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>中转页自动跳转的倒计时时间（1-30 秒）</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>域名白名单</FormLabel>
                  <FormDescription>白名单中的域名（含子域名）不显示中转页，直接跳转</FormDescription>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入域名，如 bilibili.com（支持逗号分隔批量添加）"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDomain();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addDomain}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {whitelist.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {whitelist.map((domain: string) => (
                        <Badge key={domain} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1">
                          {domain}
                          <button
                            type="button"
                            onClick={() => removeDomain(domain)}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {redirectEnabled && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>自定义文案</CardTitle>
              <CardDescription>自定义中转页显示的文案，留空使用默认文案</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="redirectTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>页面标题</FormLabel>
                    <FormControl>
                      <Input placeholder="即将离开本站" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="redirectDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述文字</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="你即将访问一个外部网站，请确认该链接的安全性。"
                        rows={2}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="redirectDisclaimer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>免责声明</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="本站对外部链接的内容不承担任何责任"
                        rows={2}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            保存设置
          </Button>
        </div>
      </form>
    </Form>
  );
}
