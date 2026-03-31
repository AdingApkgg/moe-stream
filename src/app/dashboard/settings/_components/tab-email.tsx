"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FolderOpen, Loader2, Mail, Save } from "lucide-react";
import { emailTabSchema, pickEmailValues } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";
import { TestEmailButton } from "./test-email-button";

export function TabEmail({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: emailTabSchema,
    pickValues: pickEmailValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              邮件配置
            </CardTitle>
            <CardDescription>支持 SMTP 与 HTTP API 两种发送方式，用于验证码、通知等邮件发送。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="mailSendMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>发送方式</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择邮件发送方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smtp">SMTP</SelectItem>
                        <SelectItem value="http_api">HTTP API</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>选择 SMTP 直连邮箱服务，或通过 HTTP API 网关发送邮件。</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("mailSendMode") === "smtp" ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="smtpHost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP 主机</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="smtp.example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP 端口</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={65535}
                            value={field.value ?? 465}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 465)}
                          />
                        </FormControl>
                        <FormDescription>通常为 465 (SSL) 或 587 (TLS)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="smtpUser"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP 用户名</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="user@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="smtpPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP 密码</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="password" placeholder="••••••••" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="smtpFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>发件人地址</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="noreply@example.com" />
                      </FormControl>
                      <FormDescription>发件人邮箱地址</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="mailApiUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HTTP API 地址</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="https://api.example.com/send-email" />
                      </FormControl>
                      <FormDescription>将以 POST JSON 方式调用该接口发送邮件</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mailApiFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>发件人地址</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="noreply@example.com" />
                        </FormControl>
                        <FormDescription>用于构造 From 字段</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mailApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key（可选）</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="password" placeholder="sk-xxxxxx" />
                        </FormControl>
                        <FormDescription>未配置 Authorization 时将自动使用 Bearer</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="mailApiHeaders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>自定义请求头（JSON，可选）</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          rows={4}
                          placeholder={'{"X-API-KEY":"your-key","Authorization":"Bearer xxx"}'}
                        />
                      </FormControl>
                      <FormDescription>仅支持 JSON 对象，值需为字符串</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                上传设置
              </h4>
              <FormField
                control={form.control}
                name="uploadDir"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>上传目录</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="./uploads" />
                    </FormControl>
                    <FormDescription>本地文件上传的存储路径，相对于项目根目录</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                保存设置
              </Button>
              <TestEmailButton />
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
