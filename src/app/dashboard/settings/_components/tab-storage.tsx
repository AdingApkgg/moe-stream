"use client";

import type { SiteConfig } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardDrive, Loader2, Save } from "lucide-react";
import { pickStorageValues, storageTabSchema } from "../_lib/schema";
import { useTabForm } from "../_lib/use-tab-form";

export function TabStorage({ config }: { config: SiteConfig | undefined }) {
  const { form, onSubmit, onFormError, isPending } = useTabForm({
    schema: storageTabSchema,
    pickValues: pickStorageValues,
    config,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onFormError)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              对象存储
            </CardTitle>
            <CardDescription>
              配置 S3
              兼容的对象存储服务，用于存放图片、视频封面等静态资源。切换为对象存储后，新上传的文件将保存至远程存储桶。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              对象存储功能尚在开发中，当前仅支持配置保存，实际上传仍使用本地存储。
            </div>

            <FormField
              control={form.control}
              name="storageProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>存储提供商</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择存储提供商" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">本地存储</SelectItem>
                      <SelectItem value="s3">Amazon S3</SelectItem>
                      <SelectItem value="r2">Cloudflare R2</SelectItem>
                      <SelectItem value="minio">MinIO</SelectItem>
                      <SelectItem value="oss">阿里云 OSS</SelectItem>
                      <SelectItem value="cos">腾讯云 COS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>选择「本地存储」时下方配置无需填写</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("storageProvider") !== "local" && (
              <div className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="storageEndpoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endpoint</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="https://s3.amazonaws.com" />
                      </FormControl>
                      <FormDescription>S3 兼容的端点地址，如 https://s3.us-east-1.amazonaws.com</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="storageBucket"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>存储桶名称</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="my-bucket" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storageRegion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>区域</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="us-east-1" />
                        </FormControl>
                        <FormDescription>部分服务商可留空</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="storageAccessKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Key</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="AKIA..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storageSecretKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secret Key</FormLabel>
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
                  name="storageCustomDomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>自定义域名</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="https://cdn.example.com" />
                      </FormControl>
                      <FormDescription>用于替换默认的存储桶域名，设置后文件公开链接将使用此域名</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storagePathPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>路径前缀</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="uploads/" />
                      </FormControl>
                      <FormDescription>文件在存储桶中的路径前缀，如 uploads/</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

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
