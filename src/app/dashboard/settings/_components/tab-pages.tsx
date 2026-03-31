"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, Save } from "lucide-react";
import { pagesTabSchema, pickPagesValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabPages({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: pagesTabSchema,
    pickValues: pickPagesValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              页面内容管理
            </CardTitle>
            <CardDescription>
              编辑隐私政策、服务条款、关于我们等页面内容，支持 MDX 格式（Markdown +
              JSX）。配置后将自动在页脚显示对应链接。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="privacyPolicy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>隐私政策</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder={
                        "# 隐私政策\n\n本网站非常重视用户的隐私保护...\n\n## 信息收集\n\n支持 MDX 格式（Markdown + JSX）"
                      }
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription>留空则不显示隐私政策页面。访问路径：/privacy</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="termsOfService"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>服务条款</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder={
                        "# 服务条款\n\n欢迎使用本网站提供的服务...\n\n## 使用规则\n\n支持 MDX 格式（Markdown + JSX）"
                      }
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription>留空则不显示服务条款页面。访问路径：/terms</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aboutPage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>关于我们</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder={
                        "# 关于我们\n\n本站是一个 ACGN 内容分享平台...\n\n## 联系方式\n\n支持 MDX 格式（Markdown + JSX）"
                      }
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription>留空则不显示关于页面。访问路径：/about</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
