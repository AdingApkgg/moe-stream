"use client";

import { useSession, authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import {
  Loader2,
  Check,
  Link2,
  Unlink,
  Fingerprint,
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { PROVIDER_CONFIG, type OAuthProvider } from "@/components/auth/social-login-buttons";
import { useSiteConfig } from "@/contexts/site-config";
import QRCode from "react-qr-code";

const accountSchema = z.object({
  username: z
    .string()
    .min(3, "用户名至少3个字符")
    .max(20, "用户名最多20个字符")
    .regex(/^[a-zA-Z0-9_]+$/, "只能包含字母、数字和下划线"),
  email: z.string().email("请输入有效的邮箱地址"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    newPassword: z.string().min(6, "新密码至少6个字符"),
    confirmPassword: z.string().min(1, "请确认新密码"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

function normalizeAccounts(raw: unknown[]): LinkedAccount[] {
  return raw.map((item) => {
    const a = item as Record<string, unknown>;
    return {
      id: String(a.id ?? ""),
      providerId: String(a.providerId ?? a.provider ?? ""),
      accountId: String(a.accountId ?? a.providerAccountId ?? ""),
    };
  });
}

const LINK_ERROR_MESSAGES: Record<string, string> = {
  "email_doesn't_match": "第三方账号邮箱与当前账号邮箱不一致",
  account_already_linked_to_different_user: "该第三方账号已被其他用户绑定",
  unable_to_link_account: "无法绑定该第三方账号",
  state_mismatch: "登录状态已过期，请重试",
  please_restart_the_process: "操作超时，请重试",
};

function OAuthAccountSection() {
  const siteConfig = useSiteConfig();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const linkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (linkTimeoutRef.current) clearTimeout(linkTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const linkError = searchParams.get("link_error");
    const errorCode = searchParams.get("error");
    if (linkError && errorCode) {
      const msg = LINK_ERROR_MESSAGES[errorCode] || `绑定失败 (${errorCode})`;
      toast.error("第三方账号绑定失败", { description: msg });
      router.replace("/settings/account");
    }
  }, [searchParams, router]);

  const availableProviders = (siteConfig?.oauthProviders ?? []).filter((p): p is OAuthProvider => p in PROVIDER_CONFIG);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await authClient.listAccounts();
      if (res.data) {
        setLinkedAccounts(normalizeAccounts(res.data as unknown as unknown[]));
      }
    } catch (err) {
      console.error("[settings] Failed to load linked accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const linkedProviderIds = new Set(linkedAccounts.map((a) => a.providerId));

  const hasCredentialAccount = linkedAccounts.some((a) => a.providerId === "credential");

  function resetLinkLoading() {
    setActionLoading(null);
    if (linkTimeoutRef.current) {
      clearTimeout(linkTimeoutRef.current);
      linkTimeoutRef.current = null;
    }
  }

  async function handleLink(provider: OAuthProvider) {
    setActionLoading(provider);

    linkTimeoutRef.current = setTimeout(() => {
      setActionLoading(null);
    }, 15_000);

    try {
      const base = `${window.location.origin}/settings/account`;
      const result = await authClient.linkSocial({
        provider,
        callbackURL: base,
        errorCallbackURL: `${base}?link_error=1`,
      });
      if (result?.error) {
        console.error("[settings] linkSocial error:", result.error);
        toast.error("绑定失败", {
          description: result.error.message || `无法通过 ${PROVIDER_CONFIG[provider].label} 绑定`,
        });
        resetLinkLoading();
      }
    } catch (err) {
      console.error("[settings] linkSocial exception:", err);
      toast.error("绑定失败", { description: "无法连接到登录服务" });
      resetLinkLoading();
    }
  }

  async function handleUnlink(providerId: string) {
    const totalLinked = linkedAccounts.length;
    if (totalLinked <= 1) {
      toast.error("无法解绑", { description: "至少需要保留一种登录方式" });
      return;
    }
    if (!hasCredentialAccount && totalLinked <= 2) {
      const oauthCount = linkedAccounts.filter((a) => a.providerId !== "credential").length;
      if (oauthCount <= 1) {
        toast.error("无法解绑", { description: "请先设置密码登录，再解绑最后一个第三方账号" });
        return;
      }
    }

    setActionLoading(providerId);
    try {
      const res = await authClient.unlinkAccount({ providerId });
      if (res.error) {
        console.error("[settings] unlinkAccount error:", res.error);
        toast.error("解绑失败", { description: res.error.message || "请稍后重试" });
      } else {
        toast.success("已解绑");
        await fetchAccounts();
      }
    } catch (err) {
      console.error("[settings] unlinkAccount exception:", err);
      toast.error("解绑失败", { description: "请稍后重试" });
    } finally {
      setActionLoading(null);
    }
  }

  if (availableProviders.length === 0) return null;

  return (
    <div className="pb-6 border-b">
      <h3 className="font-medium mb-1">第三方账号绑定</h3>
      <p className="text-sm text-muted-foreground mb-4">绑定后可使用第三方账号快捷登录</p>
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
              <div key={provider} className="flex items-center justify-between rounded-lg border px-4 py-3 max-w-sm">
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
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4 mr-1" />}
                    解绑
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled={loading} onClick={() => handleLink(provider)}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
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

interface PasskeyItem {
  id: string;
  name?: string | null;
  createdAt?: string;
}

function PasskeySection() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await authClient.passkey.listUserPasskeys();
      if (res.data) {
        setPasskeys(res.data as unknown as PasskeyItem[]);
      }
    } catch (err) {
      console.error("[settings] Failed to load passkeys:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  async function handleAdd() {
    setAddLoading(true);
    try {
      const res = await authClient.passkey.addPasskey({
        name: `通行密钥 ${passkeys.length + 1}`,
      });
      if (res?.error) {
        toast.error("添加失败", { description: (res.error as { message?: string }).message || "无法注册通行密钥" });
      } else {
        toast.success("通行密钥已添加");
        await fetchPasskeys();
      }
    } catch {
      toast.error("添加失败", { description: "请确认您的设备支持通行密钥" });
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      const res = await authClient.passkey.deletePasskey({ id });
      if (res?.error) {
        toast.error("删除失败");
      } else {
        toast.success("通行密钥已删除");
        await fetchPasskeys();
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setActionLoading(id);
    try {
      const res = await authClient.passkey.updatePasskey({ id, name: editName.trim() });
      if (res?.error) {
        toast.error("重命名失败");
      } else {
        toast.success("已重命名");
        setEditingId(null);
        await fetchPasskeys();
      }
    } catch {
      toast.error("重命名失败");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="pb-6 border-b">
      <div className="flex items-center gap-2 mb-1">
        <Fingerprint className="h-4 w-4" />
        <h3 className="font-medium">通行密钥</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">使用指纹、面容或安全密钥快速登录，无需输入密码</p>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full max-w-sm" />
        </div>
      ) : (
        <>
          {passkeys.length > 0 && (
            <div className="space-y-2 mb-4">
              {passkeys.map((pk) => (
                <div key={pk.id} className="flex items-center justify-between rounded-lg border px-4 py-3 max-w-sm">
                  <div className="flex-1 min-w-0">
                    {editingId === pk.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(pk.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={actionLoading === pk.id}
                          onClick={() => handleRename(pk.id)}
                        >
                          {actionLoading === pk.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium truncate">{pk.name || "通行密钥"}</div>
                        {pk.createdAt && (
                          <div className="text-xs text-muted-foreground">
                            添加于 {new Date(pk.createdAt).toLocaleDateString("zh-CN")}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {editingId !== pk.id && (
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditingId(pk.id);
                          setEditName(pk.name || "");
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        disabled={actionLoading === pk.id}
                        onClick={() => handleDelete(pk.id)}
                      >
                        {actionLoading === pk.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={addLoading}>
            {addLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            添加通行密钥
          </Button>
        </>
      )}
    </div>
  );
}

type TwoFactorStep = "idle" | "enabling" | "verify" | "enabled" | "backup";

function TwoFactorSection() {
  const { data: session, update: refreshSession } = useSession();
  const is2faEnabled = session?.user?.twoFactorEnabled ?? false;

  const [step, setStep] = useState<TwoFactorStep>("idle");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  async function handleEnable() {
    if (!password) {
      toast.error("请输入密码");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authClient.twoFactor.enable({ password });
      if (res.error) {
        toast.error("启用失败", { description: res.error.message });
      } else if (res.data) {
        setTotpUri(res.data.totpURI);
        setBackupCodes(res.data.backupCodes);
        setStep("verify");
      }
    } catch {
      toast.error("启用失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify() {
    if (!verifyCode) return;
    setIsLoading(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code: verifyCode });
      if (res.error) {
        toast.error("验证失败", { description: res.error.message || "验证码错误" });
        setVerifyCode("");
      } else {
        toast.success("两步验证已启用");
        setStep("backup");
        await refreshSession();
      }
    } catch {
      toast.error("验证失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisable() {
    if (!password) {
      toast.error("请输入密码");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authClient.twoFactor.disable({ password });
      if (res.error) {
        toast.error("关闭失败", { description: res.error.message });
      } else {
        toast.success("两步验证已关闭");
        setStep("idle");
        setPassword("");
        await refreshSession();
      }
    } catch {
      toast.error("关闭失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateBackupCodes() {
    if (!password) {
      toast.error("请输入密码");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authClient.twoFactor.generateBackupCodes({ password });
      if (res.error) {
        toast.error("生成失败", { description: res.error.message });
      } else if (res.data) {
        setBackupCodes(res.data.backupCodes);
        setShowBackupCodes(true);
        toast.success("备用恢复码已重新生成");
      }
    } catch {
      toast.error("生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  function copyBackupCodes() {
    navigator.clipboard
      .writeText(backupCodes.join("\n"))
      .then(() => {
        toast.success("已复制到剪贴板");
      })
      .catch(() => {
        toast.error("复制失败");
      });
  }

  return (
    <div className="pb-6 border-b">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-4 w-4" />
        <h3 className="font-medium">两步验证 (2FA)</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {is2faEnabled ? "两步验证已启用，登录时需要额外验证" : "启用后，登录时需输入验证器应用生成的验证码，提升安全性"}
      </p>

      {step === "idle" && !is2faEnabled && (
        <div className="space-y-3 max-w-sm">
          <Input
            type="password"
            placeholder="输入当前密码以启用"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button onClick={handleEnable} disabled={isLoading || !password}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            启用两步验证
          </Button>
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4 max-w-sm">
          <p className="text-sm">使用 Google Authenticator、Microsoft Authenticator 等验证器应用扫描下方二维码：</p>
          <div className="bg-white p-4 rounded-lg w-fit">
            <QRCode value={totpUri} size={180} />
          </div>
          <p className="text-sm text-muted-foreground">扫描后，输入验证器应用显示的 6 位验证码确认：</p>
          <Input
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-lg tracking-widest"
          />
          <div className="flex gap-2">
            <Button onClick={handleVerify} disabled={isLoading || !verifyCode}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认启用
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep("idle");
                setVerifyCode("");
                setTotpUri("");
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {(step === "backup" || (step === "idle" && is2faEnabled && backupCodes.length > 0)) && (
        <div className="space-y-4 max-w-sm">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">备用恢复码</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowBackupCodes(!showBackupCodes)}
                >
                  {showBackupCodes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={copyBackupCodes}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              请妥善保存这些恢复码。如果丢失验证器设备，可使用恢复码登录。每个恢复码只能使用一次。
            </p>
            {showBackupCodes ? (
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-xs bg-background px-2 py-1 rounded font-mono">
                    {code}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">点击眼睛图标查看恢复码</p>
            )}
          </div>
          {step === "backup" && (
            <Button
              onClick={() => {
                setStep("idle");
                setPassword("");
                setVerifyCode("");
              }}
            >
              完成
            </Button>
          )}
        </div>
      )}

      {step === "idle" && is2faEnabled && (
        <div className="space-y-3 max-w-sm">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            <span>两步验证已启用</span>
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateBackupCodes} disabled={isLoading || !password}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                重新生成恢复码
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDisable} disabled={isLoading || !password}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                关闭两步验证
              </Button>
            </div>
          </div>
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

  const { data: user, isLoading: userLoading } = trpc.user.me.useQuery(undefined, { enabled: !!session });

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
      accountForm.reset({ username: user.username, email: user.email ?? "" });
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
        <p className="text-sm text-muted-foreground mt-1">管理你的账号信息和密码</p>
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
                  <FormDescription>用于登录和你的个人主页地址 /user/{field.value || "username"}</FormDescription>
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

      {/* 通行密钥 */}
      <PasskeySection />

      {/* 两步验证 */}
      <TwoFactorSection />

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
