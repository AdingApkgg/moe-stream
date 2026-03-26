"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Copy, Check, Trash2, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import dayjs from "dayjs";

const SCOPE_OPTIONS = [
  { value: "video", label: "视频" },
  { value: "game", label: "游戏" },
  { value: "image", label: "图片" },
] as const;

function ScopesBadges({ scopes }: { scopes: string[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {scopes.map((s) => (
        <Badge key={s} variant="secondary" className="text-[11px]">
          {SCOPE_OPTIONS.find((o) => o.value === s)?.label ?? s}
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

function CreateKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["video", "game", "image"]);
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
    setScopes(["video", "game", "image"]);
    setCreatedKey(null);
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 API Key</DialogTitle>
            <DialogDescription>API Key 用于通过 HTTP 接口以编程方式发布内容。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">名称</Label>
              <Input
                id="key-name"
                placeholder="如：爬虫脚本、自动化工具"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label>权限范围</Label>
              <div className="flex gap-4">
                {SCOPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={scopes.includes(opt.value)} onCheckedChange={() => toggleScope(opt.value)} />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
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
        <p className="text-xs text-muted-foreground mt-1">创建一个 API Key 来通过接口发布内容</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div key={key.id} className="flex items-center gap-4 rounded-lg border p-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{key.name}</span>
              <ScopesBadges scopes={key.scopes} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                  确定删除「{key.name}」（{key.keyPrefix}）？使用此 Key 的所有脚本将立即失效。
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
        <p className="text-sm text-muted-foreground mt-1">管理 API Key，通过 HTTP 接口以编程方式发布内容。</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">API Key</h3>
          <CreateKeyDialog />
        </div>
        <ApiKeyList />
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <h4 className="text-sm font-medium">使用方式</h4>
        <p className="text-xs text-muted-foreground">在 HTTP 请求中通过 Authorization 头携带 API Key：</p>
        <code className="block text-xs font-mono bg-muted rounded p-2.5">Authorization: Bearer sk-your-api-key</code>
        <p className="text-xs text-muted-foreground">
          详细接口文档请前往{" "}
          <a href="/upload" className="text-primary underline underline-offset-2">
            发布页 → API 发布
          </a>{" "}
          查看。
        </p>
      </div>
    </div>
  );
}
