"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, CheckCircle, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const step1Schema = z
  .object({
    email: z.string().email("请输入有效的邮箱地址"),
    username: z
      .string()
      .min(3, "用户名至少3个字符")
      .max(20, "用户名最多20个字符")
      .regex(/^[a-zA-Z0-9_]+$/, "只能包含字母、数字和下划线"),
    password: z.string().min(6, "密码至少6个字符"),
    confirmPassword: z.string(),
    nickname: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

const step2Schema = z.object({
  siteName: z.string().max(100).optional(),
  siteUrl: z.string().url("请输入有效的 URL").optional().or(z.literal("")),
});

type Step1Form = z.infer<typeof step1Schema>;
type Step2Form = z.infer<typeof step2Schema>;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Form | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const { data: status, isLoading: statusLoading } = trpc.setup.checkStatus.useQuery();

  const createOwner = trpc.setup.createOwner.useMutation({
    onSuccess: () => {
      setIsComplete(true);
    },
  });

  const form1 = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      nickname: "",
    },
  });

  const form2 = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      siteName: "",
      siteUrl: "",
    },
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status && !status.needsSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">初始配置已完成</h2>
            <p className="text-muted-foreground mb-4">系统已配置就绪，无需再次设置。</p>
            <Button onClick={() => router.push("/")} className="w-full">
              前往首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">配置完成！</h2>
            <p className="text-muted-foreground mb-4">管理员账户已创建，现在可以开始使用了。</p>
            <Button onClick={() => router.push("/login")} className="w-full">
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onStep1Submit = (data: Step1Form) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: Step2Form) => {
    if (!step1Data) return;
    createOwner.mutate({
      email: step1Data.email,
      username: step1Data.username,
      password: step1Data.password,
      nickname: step1Data.nickname || undefined,
      siteName: data.siteName || undefined,
      siteUrl: data.siteUrl || undefined,
    });
  };

  const handleSkipStep2 = () => {
    if (!step1Data) return;
    createOwner.mutate({
      email: step1Data.email,
      username: step1Data.username,
      password: step1Data.password,
      nickname: step1Data.nickname || undefined,
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">初始配置</h1>
          <p className="text-muted-foreground mt-2">首次使用需要完成初始配置</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>创建管理员账户</CardTitle>
              <CardDescription>创建站长账户，拥有最高管理权限</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
                  <FormField
                    control={form1.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="admin@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form1.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>用户名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="admin" />
                        </FormControl>
                        <FormDescription>3-20 个字符，仅字母、数字和下划线</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form1.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>昵称（可选）</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="显示名称" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form1.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="至少6个字符" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form1.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>确认密码</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="再次输入密码" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full">
                    下一步
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>站点信息</CardTitle>
              <CardDescription>配置基本的站点信息，可以跳过稍后在后台设置</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
                  <FormField
                    control={form2.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>站点名称</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="My Site" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form2.control}
                    name="siteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>站点 URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://www.example.com" />
                        </FormControl>
                        <FormDescription>站点的公开访问地址</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {createOwner.error && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {createOwner.error.message}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      上一步
                    </Button>
                    <Button type="submit" className="flex-1" disabled={createOwner.isPending}>
                      {createOwner.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      完成配置
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={handleSkipStep2}
                    disabled={createOwner.isPending}
                  >
                    跳过此步骤
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
