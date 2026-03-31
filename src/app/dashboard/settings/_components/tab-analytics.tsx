"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BarChart3, Globe, Loader2, Save, Search, Shield } from "lucide-react";
import { analyticsTabSchema, pickAnalyticsValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabAnalytics({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: analyticsTabSchema,
    pickValues: pickAnalyticsValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              统计分析
            </CardTitle>
            <CardDescription>
              接入各大分析统计平台，追踪网站流量和用户行为。填入对应平台的 ID/Token 即可启用，留空则不加载。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" />
                Google Analytics 4
              </div>
              <FormField
                control={form.control}
                name="analyticsGoogleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Measurement ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="G-XXXXXXXXXX" />
                    </FormControl>
                    <FormDescription>Google Analytics 4 的衡量 ID，可在 GA4 管理面板 &gt; 数据流中找到</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" />
                Google Tag Manager
              </div>
              <FormField
                control={form.control}
                name="analyticsGtmId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="GTM-XXXXXXX" />
                    </FormControl>
                    <FormDescription>
                      Google Tag Manager 的容器 ID，可在 GTM 控制台 &gt; 管理 &gt; 容器设置中找到
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                Cloudflare Web Analytics
              </div>
              <FormField
                control={form.control}
                name="analyticsCfToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beacon Token</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    </FormControl>
                    <FormDescription>
                      Cloudflare Web Analytics 的 beacon token，可在 Cloudflare 控制台 &gt; Web Analytics 中获取
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Search className="h-4 w-4" />
                Microsoft Clarity
              </div>
              <FormField
                control={form.control}
                name="analyticsClarityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="xxxxxxxxxx" />
                    </FormControl>
                    <FormDescription>
                      Microsoft Clarity 的项目 ID，可在 Clarity 控制台 &gt; 设置 &gt; 项目信息中找到
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" />
                Bing Webmaster Tools
              </div>
              <FormField
                control={form.control}
                name="analyticsBingVerification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>验证码</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
                    </FormControl>
                    <FormDescription>Bing Webmaster Tools 验证码，会自动生成 meta 标签用于站点验证</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              保存设置
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
