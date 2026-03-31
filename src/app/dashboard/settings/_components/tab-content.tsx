"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { contentTabSchema, pickContentValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabContent({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: contentTabSchema,
    pickValues: pickContentValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle>内容设置</CardTitle>
            <CardDescription>配置内容相关的参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="videoSelectorMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>播放页选集器模式</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full md:w-64">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="series">合集</SelectItem>
                      <SelectItem value="author">原作者</SelectItem>
                      <SelectItem value="uploader">上传者</SelectItem>
                      <SelectItem value="disabled">关闭</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    控制播放页右侧选集器按什么维度聚合视频：合集（Series 剧集）、原作者（extraInfo 中的 author
                    字段）、上传者（UP 主）、或关闭
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="videosPerPage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>每页视频数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 20)}
                      />
                    </FormControl>
                    <FormDescription>首页每页显示的视频数量</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commentsPerPage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>每页评论数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={5}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 20)}
                      />
                    </FormControl>
                    <FormDescription>每页显示的评论数量</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="maxUploadSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最大上传大小 (MB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={10}
                        max={10000}
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 500)}
                      />
                    </FormControl>
                    <FormDescription>单个文件最大上传大小</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allowedVideoFormats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>允许的视频格式</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="mp4,webm,m3u8" />
                    </FormControl>
                    <FormDescription>逗号分隔</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminBatchLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>后台批量操作上限</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 10000)}
                      />
                    </FormControl>
                    <FormDescription>批量转移、删除等操作的最大数量</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
