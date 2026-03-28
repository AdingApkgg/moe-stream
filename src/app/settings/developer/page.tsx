"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Copy, Check, Trash2, KeyRound, AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import dayjs from "dayjs";
import { API_SCOPE_GROUPS, API_SCOPE_TEMPLATES, ALL_SCOPE_IDS, summarizeScopes } from "@/lib/api-scopes";

function ScopeRouterEntry({
  scope,
  label,
  read,
  write,
  routers,
}: {
  scope: string;
  label: string;
  read: string;
  write?: string;
  routers: string;
}) {
  return (
    <div className="rounded border px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[11px] font-mono">
          {scope}
        </Badge>
        <span className="font-medium text-foreground text-xs">{label}</span>
      </div>
      <div className="space-y-0.5 text-[11px]">
        <p>
          <span className="text-green-600 dark:text-green-400 font-medium">读取：</span>
          {read}
        </p>
        {write && (
          <p>
            <span className="text-amber-600 dark:text-amber-400 font-medium">写入：</span>
            {write}
          </p>
        )}
        <p className="text-muted-foreground/70">
          路由：<code className="text-[10px]">{routers}</code>
        </p>
      </div>
    </div>
  );
}

function ScopesBadges({ scopes }: { scopes: string[] }) {
  const summary = summarizeScopes(scopes);
  if (summary.length === 0) return null;

  const isAll = scopes.length === ALL_SCOPE_IDS.length;
  if (isAll) {
    return (
      <Badge variant="secondary" className="text-[11px]">
        全部权限
      </Badge>
    );
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {summary.map((s) => (
        <Badge key={s} variant="secondary" className="text-[11px]">
          {s}
        </Badge>
      ))}
    </div>
  );
}

function CreatedKeyDisplay({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API Key 已复制");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>API Key 已创建</DialogTitle>
        <DialogDescription>请立即复制并妥善保管，关闭后将无法再次查看完整 Key。</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
        <code className="flex-1 text-xs break-all select-all font-mono">{apiKey}</code>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">此 Key 仅显示一次。如果丢失，请删除后重新创建。</p>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>我已保存</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ScopeMatrix({ scopes, onChange }: { scopes: string[]; onChange: (scopes: string[]) => void }) {
  const handleWriteToggle = (groupId: string) => {
    const writeId = `${groupId}:write`;
    const readId = `${groupId}:read`;
    if (scopes.includes(writeId)) {
      onChange(scopes.filter((s) => s !== writeId));
    } else {
      const next = scopes.includes(readId) ? [...scopes, writeId] : [...scopes, readId, writeId];
      onChange([...new Set(next)]);
    }
  };

  const handleReadToggle = (groupId: string) => {
    const readId = `${groupId}:read`;
    const writeId = `${groupId}:write`;
    if (scopes.includes(readId)) {
      onChange(scopes.filter((s) => s !== readId && s !== writeId));
    } else {
      onChange([...new Set([...scopes, readId])]);
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="grid grid-cols-[1fr_64px_64px] items-center gap-0 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        <span>资源</span>
        <span className="text-center">读取</span>
        <span className="text-center">写入</span>
      </div>
      {API_SCOPE_GROUPS.map((group, i) => {
        const readId = `${group.id}:read`;
        const writeId = `${group.id}:write`;
        const hasRead = scopes.includes(readId);
        const hasWrite = scopes.includes(writeId);
        const hasWriteScope = group.scopes.some((s) => s.id === writeId);

        return (
          <div
            key={group.id}
            className={`grid grid-cols-[1fr_64px_64px] items-center gap-0 px-3 py-2.5 ${i < API_SCOPE_GROUPS.length - 1 ? "border-b" : ""}`}
          >
            <div>
              <div className="text-sm font-medium">{group.label}</div>
              <div className="text-xs text-muted-foreground">{group.description}</div>
            </div>
            <div className="flex justify-center">
              <Checkbox checked={hasRead || hasWrite} onCheckedChange={() => handleReadToggle(group.id)} />
            </div>
            <div className="flex justify-center">
              {hasWriteScope ? (
                <Checkbox checked={hasWrite} onCheckedChange={() => handleWriteToggle(group.id)} />
              ) : (
                <span className="text-[10px] text-muted-foreground/50">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...ALL_SCOPE_IDS]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.key);
      utils.apiKey.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("请输入 Key 名称");
      return;
    }
    if (scopes.length === 0) {
      toast.error("请至少选择一个权限范围");
      return;
    }
    createMutation.mutate({ name: name.trim(), scopes });
  };

  const handleClose = () => {
    setOpen(false);
    setName("");
    setScopes([...ALL_SCOPE_IDS]);
    setCreatedKey(null);
  };

  const applyTemplate = (templateId: string) => {
    const tpl = API_SCOPE_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) setScopes([...tpl.scopes]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          创建 API Key
        </Button>
      </DialogTrigger>
      {createdKey ? (
        <CreatedKeyDisplay apiKey={createdKey} onClose={handleClose} />
      ) : (
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建 API Key</DialogTitle>
            <DialogDescription>API Key 用于通过 HTTP 接口以编程方式访问平台 API。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">名称</Label>
              <Input
                id="key-name"
                placeholder="如：爬虫脚本、自动化工具、数据分析"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>权限范围</Label>
                <div className="flex gap-1.5">
                  {API_SCOPE_TEMPLATES.map((tpl) => (
                    <Button
                      key={tpl.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => applyTemplate(tpl.id)}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {tpl.label}
                    </Button>
                  ))}
                </div>
              </div>
              <ScopeMatrix scopes={scopes} onChange={setScopes} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中…" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ApiKeyList() {
  const { data: keys, isLoading } = trpc.apiKey.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.apiKey.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.apiKey.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!keys?.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">还没有 API Key</p>
        <p className="text-xs text-muted-foreground mt-1">创建一个 API Key 来通过接口访问平台 API</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div key={key.id} className="flex items-center gap-4 rounded-lg border p-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{key.name}</span>
              <ScopesBadges scopes={key.scopes} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <code className="font-mono">{key.keyPrefix}</code>
              <span>·</span>
              <span>创建于 {dayjs(key.createdAt).format("YYYY-MM-DD")}</span>
              {key.lastUsedAt && (
                <>
                  <span>·</span>
                  <span>最后使用 {formatRelativeTime(key.lastUsedAt)}</span>
                </>
              )}
              {key.expiresAt && (
                <>
                  <span>·</span>
                  <span className={new Date(key.expiresAt) < new Date() ? "text-destructive" : ""}>
                    {new Date(key.expiresAt) < new Date()
                      ? "已过期"
                      : `${dayjs(key.expiresAt).format("YYYY-MM-DD")} 过期`}
                  </span>
                </>
              )}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除 API Key</AlertDialogTitle>
                <AlertDialogDescription>
                  确定删除「{key.name}」（{key.keyPrefix}）？使用此 Key 的所有脚本和集成将立即失效。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate({ id: key.id })}
                  disabled={deleteMutation.isPending}
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}

export default function DeveloperSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">开发者设置</h2>
        <p className="text-sm text-muted-foreground mt-1">管理 API Key，通过 HTTP 接口以编程方式访问平台 API。</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">API Key</h3>
          <CreateKeyDialog />
        </div>
        <ApiKeyList />
      </div>

      <Separator />

      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-medium">使用方式</h4>
        <p className="text-xs text-muted-foreground">在 HTTP 请求中通过 Authorization 头携带 API Key：</p>
        <code className="block text-xs font-mono bg-muted rounded p-2.5">Authorization: Bearer sk-your-api-key</code>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>
            所有 tRPC 端点均可通过 API Key 访问，权限由创建 Key 时选择的范围控制。Query 操作需对应的读取权限，Mutation
            操作需写入权限。
          </p>
          <p>
            请求格式为 tRPC over HTTP：
            <code className="px-1 py-0.5 bg-muted rounded text-[11px] ml-1">GET /api/trpc/video.getById?input=...</code>
          </p>
          <p>
            API Key 请求受到速率限制（120 次/分钟）。详细接口文档请前往{" "}
            <a href="/api-docs" className="text-primary underline underline-offset-2">
              API 文档
            </a>{" "}
            查看。
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-medium">权限范围与可访问路由</h4>
        <div className="space-y-3 text-xs text-muted-foreground">
          <ScopeRouterEntry
            scope="content"
            label="内容"
            read="查询视频 / 游戏 / 图帖 / 标签 / 合集列表与详情"
            write="创建、编辑、删除内容；导入；管理标签和合集"
            routers="video, game, image, tag, series, sticker, import"
          />
          <ScopeRouterEntry
            scope="comment"
            label="评论"
            read="查询各类评论列表"
            write="发表、编辑、删除评论"
            routers="comment, gameComment, imagePostComment"
          />
          <ScopeRouterEntry
            scope="social"
            label="社交"
            read="查看关注、私信、频道、留言板"
            write="关注/取关、发消息、管理频道"
            routers="follow, message, channel, guestbook"
          />
          <ScopeRouterEntry scope="file" label="文件" read="查询文件列表和用量" write="上传、删除文件" routers="file" />
          <ScopeRouterEntry
            scope="user"
            label="用户"
            read="查看个人资料、API Key 列表、导出收藏/历史"
            write="修改资料、管理 API Key"
            routers="user, apiKey, openApi.exportMy*"
          />
          <ScopeRouterEntry
            scope="referral"
            label="推广中心"
            read="推广统计、链接列表、积分历史、签到状态"
            write="创建/管理推广链接、签到、领取奖励"
            routers="referral, openApi.referral*"
          />
          <ScopeRouterEntry
            scope="payment"
            label="支付与兑换"
            read="查询套餐列表、订单状态"
            write="创建/取消订单、使用兑换码"
            routers="payment, redeem, openApi.paymentPackages"
          />
          <ScopeRouterEntry
            scope="notification"
            label="通知"
            read="查询通知列表和未读数"
            write="标记已读、删除通知"
            routers="notification"
          />
          <ScopeRouterEntry
            scope="stats"
            label="数据统计"
            read="站点总览、增长趋势、排行榜、内容分布、用户统计"
            routers="openApi.overview, openApi.growth, openApi.leaderboard ..."
          />
          <ScopeRouterEntry
            scope="system"
            label="系统信息"
            read="热门标签、合集列表、存储用量、搜索热词、标签分类"
            routers="openApi.popularTags, openApi.storageUsage, site ..."
          />
          <ScopeRouterEntry
            scope="admin"
            label="管理后台"
            read="后台统计、用户 / 内容 / 评论审核列表"
            write="审核操作、封禁用户、修改站点配置"
            routers="admin.*（需管理员角色）"
          />
        </div>
      </div>
    </div>
  );
}
