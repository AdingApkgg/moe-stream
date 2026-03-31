"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Shield } from "lucide-react";
import { footerTabSchema, pickFooterValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabFooter({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: footerTabSchema,
    pickValues: pickFooterValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              页脚与备案
            </CardTitle>
            <CardDescription>配置页脚信息和备案号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="githubUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub 链接</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="https://github.com/your-org/your-repo" />
                  </FormControl>
                  <FormDescription>页脚显示的 GitHub 仓库链接，留空则不显示</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="footerText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>页脚文本</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="自定义页脚文本，支持简单 HTML..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icpBeian"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ICP 备案号</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="京ICP备XXXXXXXX号" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publicSecurityBeian"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公安备案号</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="京公网安备XXXXXXXXXXXXXX号" />
                  </FormControl>
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
