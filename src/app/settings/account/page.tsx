"use client";

import { useSession, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { Loader2, Check, Link2, Unlink } from "lucide-react";
import { PROVIDER_CONFIG, type OAuthProvider } from "@/components/auth/social-login-buttons";
import { useSiteConfig } from "@/contexts/site-config";

const accountSchema = z.object({
  username: z.string().min(3, "用户名至少3个字符").max(20, "用户名最多20个字符").regex(/^[a-zA-Z0-9_]+$/, "只能包含字母、数字和下划线"),
  email: z.string().email("请输入有效的邮箱地址"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(6, "新密码至少6个字符"),
  confirmPassword: z.string().min(1, "请确认新密码"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
});

interface LinkedAccount {
  id: string;
  provider: string;
  accountId?: string;
}

function OAuthAccountSection() {
  const siteConfig = useSiteConfig();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const availableProviders = (siteConfig?.oauthProviders ?? []).filter(
    (p): p is OAuthProvider => p in PROVIDER_CONFIG
  );

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await authClient.listAccounts();
      if (res.data) {
        setLinkedAccounts(res.data as unknown as LinkedAccount[]);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const linkedProviderIds = new Set(
    linkedAccounts.map((a) => a.provider)
  );

  const hasCredentialAccount = linkedAccounts.some(
    (a) => a.provider === "credential"
  );

  async function handleLink(provider: OAuthProvider) {
    setActionLoading(provider);
    try {
      await authClient.linkSocial({
        provider,
        callbackURL: "/settings/account",
      });
    } catch {
      toast.error("绑定失败", { description: "无法连接到登录服务" });
      setActionLoading(null);
    }
  }

  async function handleUnlink(providerId: string) {
    const totalLinked = linkedAccounts.length;
    if (totalLinked <= 1) {
      toast.error("无法解绑", { description: "至少需要保留一种登录方式" });
      return;
    }
    if (!hasCredentialAccount && totalLinked <= 1) {
      toast.error("无法解绑", { description: "请先设置密码登录，再解绑第三方账号" });
      return;
    }

    setActionLoading(providerId);
    try {
      const res = await authClient.unlinkAccount({ providerId });
      if (res.error) {
        toast.error("解绑失败", { description: res.error.message || "请稍后重试" });
      } else {
        toast.success("已解绑");
        await fetchAccounts();
      }
    } catch {
      toast.error("解绑失败", { description: "请稍后重试" });
    } finally {
      setActionLoading(null);
    }
  }

  if (availableProviders.length === 0) return null;

  return (
    <div className="pb-6 border-b">
      <h3 className="font-medium mb-1">第三方账号绑定</h3>
      <p className="text-sm text-muted-foreground mb-4">
        绑定后可使用第三方账号快捷登录
      </p>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full max-w-sm" />
          <Skeleton className="h-12 w-full max-w-sm" />
        </div>
      ) : (
        <div className="space-y-2">
          {availableProviders.map((provider) => {
            const config = PROVIDER_CONFIG[provider];
            const isLinked = linkedProviderIds.has(provider);
            const loading = actionLoading === provider;

            return (
              <div
                key={provider}
                className="flex items-center justify-between rounded-lg border px-4 py-3 max-w-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="shrink-0">{config.icon}</span>
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                {isLinked ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={loading}
                    onClick={() => handleUnlink(provider)}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-1" />
                    )}
                    解绑
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleLink(provider)}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-1" />
                    )}
                    绑定
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAccountLoading, setIsAccountLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const utils = trpc.useUtils();

  const { data: user, isLoading: userLoading } = trpc.user.me.useQuery(
    undefined,
    { enabled: !!session }
  );

  const updateAccountMutation = trpc.user.updateAccount.useMutation({
    onSuccess: () => {
      toast.success("账号信息已更新");
      utils.user.me.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success("密码已修改");
      passwordForm.reset();
    },
    onError: (error) => toast.error(error.message),
  });

  const accountForm = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: "", email: "" },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (user) {
      accountForm.reset({ username: user.username, email: user.email });
    }
  }, [user, accountForm]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/settings/account");
    }
  }, [status, router]);

  async function onAccountSubmit(data: z.infer<typeof accountSchema>) {
    setIsAccountLoading(true);
    try {
      await updateAccountMutation.mutateAsync(data);
    } finally {
      setIsAccountLoading(false);
    }
  }

  async function onPasswordSubmit(data: z.infer<typeof passwordSchema>) {
    setIsPasswordLoading(true);
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    } finally {
      setIsPasswordLoading(false);
    }
  }

  if (status === "loading" || userLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
    );
  }

  if (!session || !user) return null;

  const roleLabel = user.role === "OWNER" ? "站长" : user.role === "ADMIN" ? "管理员" : "普通用户";

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold">账号安全</h2>
        <p className="text-sm text-muted-foreground mt-1">
          管理你的账号信息和密码
        </p>
      </div>

      {/* 账号信息 */}
      <div className="pb-6 border-b">
        <h3 className="font-medium mb-4">账号信息</h3>
        <Form {...accountForm}>
          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
            <FormField
              control={accountForm.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>用户名</FormLabel>
                  <FormControl>
                    <Input {...field} className="max-w-sm" />
                  </FormControl>
                  <FormDescription>
                    用于登录和你的个人主页地址 /user/{field.value || "username"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={accountForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} className="max-w-sm" />
                  </FormControl>
                  <FormDescription>用于登录和接收通知</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-4 pt-2">
              <Button type="submit" disabled={isAccountLoading}>
                {isAccountLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存更改
              </Button>
              <div className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  {roleLabel}
                </span>
                <span className="mx-2">·</span>
                <span>注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          </form>
        </Form>
      </div>

      {/* 第三方账号绑定 */}
      <OAuthAccountSection />

      {/* 修改密码 */}
      <div>
        <h3 className="font-medium mb-4">修改密码</h3>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>当前密码</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} className="max-w-sm" autoComplete="current-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密码</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认新密码</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isPasswordLoading}>
              {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              修改密码
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
