"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { messagingTabSchema, pickMessagingValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabMessaging({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: messagingTabSchema,
    pickValues: pickMessagingValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>频道设置</CardTitle>
            <CardDescription>管理聊天频道功能的开关与限制</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="channelEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用频道</FormLabel>
                    <FormDescription>关闭后用户将无法访问和使用聊天频道功能</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="channelMaxPerUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>每人可创建频道数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>单个用户最多可创建的频道数量</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channelMaxMembers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>频道最大成员数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2}
                        max={10000}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 2)}
                      />
                    </FormControl>
                    <FormDescription>单个频道允许加入的最大成员数量</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channelMessageMaxLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>消息最大字符数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>频道中单条消息的最大字符数</FormDescription>
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

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>私信设置</CardTitle>
            <CardDescription>管理用户间私信功能的开关与限制</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="dmEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用私信</FormLabel>
                    <FormDescription>关闭后用户将无法发送和接收私信</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dmMessageMaxLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>消息最大字符数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>单条私信的最大字符数</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dmRateLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>频率限制（条/分钟）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={300}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>用户每分钟最多可发送的私信条数</FormDescription>
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
