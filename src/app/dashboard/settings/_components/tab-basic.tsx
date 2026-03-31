"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { basicTabSchema, pickBasicValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabBasic({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: basicTabSchema,
    pickValues: pickBasicValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>设置网站的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="siteName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>网站名称</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Your Site Name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>站点 URL</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="https://www.example.com" />
                  </FormControl>
                  <FormDescription>
                    站点的访问地址，用于生成 SEO、Sitemap、RSS 等。留空则使用 .env 中的 NEXT_PUBLIC_APP_URL
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>网站描述</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} placeholder="一句话介绍你的网站..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="siteLogo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="https://..." />
                    </FormControl>
                    <FormDescription>留空使用默认 Logo</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteFavicon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Favicon URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="https://..." />
                    </FormControl>
                    <FormDescription>留空使用默认图标</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="siteKeywords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEO 关键词</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="关键词1,关键词2,关键词3" />
                  </FormControl>
                  <FormDescription>多个关键词用逗号分隔</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>联系邮箱</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="email" placeholder="admin@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">公告设置</h4>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="announcementEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>启用公告</FormLabel>
                        <FormDescription>在首页顶部显示公告横幅</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="announcement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>公告内容</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} placeholder="支持 Markdown 格式..." rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
