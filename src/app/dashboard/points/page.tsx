"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTabParam } from "@/hooks/use-tab-param";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast-with-sound";
import {
  Coins,
  TrendingUp,
  CalendarCheck,
  Save,
  Loader2,
  Users,
  Link2,
  Award,
  Settings,
  Ticket,
  Plus,
  Trash2,
  Copy,
  Upload,
} from "lucide-react";

// ========== Schema ==========

const pointsConfigSchema = z.object({
  referralEnabled: z.boolean(),
  referralPointsPerUser: z.number().int().min(1).max(100000),
  referralMaxLinksPerUser: z.number().int().min(1).max(100),

  pointsRules: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      points: z.number().int().min(0).max(10000),
      dailyLimit: z.number().int().min(0).max(1000),
    }),
  ),

  checkinEnabled: z.boolean(),
  checkinPointsMin: z.number().int().min(1).max(100000),
  checkinPointsMax: z.number().int().min(1).max(100000),
});

type PointsConfigValues = z.infer<typeof pointsConfigSchema>;

// ========== Constants ==========

const POINTS_ACTION_LABELS: Record<string, { label: string; group: string }> = {
  DAILY_LOGIN: { label: "每日登录", group: "通用" },
  WATCH_VIDEO: { label: "观看视频", group: "视频" },
  LIKE_VIDEO: { label: "点赞视频", group: "视频" },
  FAVORITE_VIDEO: { label: "收藏视频", group: "视频" },
  COMMENT_VIDEO: { label: "评论视频", group: "视频" },
  VIEW_GAME: { label: "浏览游戏", group: "游戏" },
  LIKE_GAME: { label: "点赞游戏", group: "游戏" },
  FAVORITE_GAME: { label: "收藏游戏", group: "游戏" },
  COMMENT_GAME: { label: "评论游戏", group: "游戏" },
  VIEW_IMAGE: { label: "浏览图片", group: "图片" },
  LIKE_IMAGE: { label: "点赞图片", group: "图片" },
  FAVORITE_IMAGE: { label: "收藏图片", group: "图片" },
  COMMENT_IMAGE: { label: "评论图片", group: "图片" },
};

const DEFAULT_POINTS_RULES: PointsConfigValues["pointsRules"] = {
  DAILY_LOGIN: { enabled: false, points: 10, dailyLimit: 1 },
  WATCH_VIDEO: { enabled: false, points: 1, dailyLimit: 20 },
  LIKE_VIDEO: { enabled: false, points: 1, dailyLimit: 10 },
  FAVORITE_VIDEO: { enabled: false, points: 2, dailyLimit: 10 },
  COMMENT_VIDEO: { enabled: false, points: 3, dailyLimit: 5 },
  VIEW_GAME: { enabled: false, points: 1, dailyLimit: 20 },
  LIKE_GAME: { enabled: false, points: 1, dailyLimit: 10 },
  FAVORITE_GAME: { enabled: false, points: 2, dailyLimit: 10 },
  COMMENT_GAME: { enabled: false, points: 3, dailyLimit: 5 },
  VIEW_IMAGE: { enabled: false, points: 1, dailyLimit: 20 },
  LIKE_IMAGE: { enabled: false, points: 1, dailyLimit: 10 },
  FAVORITE_IMAGE: { enabled: false, points: 2, dailyLimit: 10 },
  COMMENT_IMAGE: { enabled: false, points: 3, dailyLimit: 5 },
};

// ========== Components ==========

function PointsRulesEditor({ control }: { control: Control<PointsConfigValues> }) {
  const groups = ["通用", "视频", "游戏", "图片"] as const;
  const actionsByGroup = Object.entries(POINTS_ACTION_LABELS).reduce<Record<string, string[]>>(
    (acc, [key, { group }]) => {
      (acc[group] ??= []).push(key);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <h5 className="text-sm font-medium text-muted-foreground">{group}</h5>
          <div className="space-y-2">
            {(actionsByGroup[group] || []).map((action) => {
              const meta = POINTS_ACTION_LABELS[action];
              return (
                <div key={action} className="flex items-center gap-3 rounded-lg border p-3">
                  <FormField
                    control={control}
                    name={`pointsRules.${action}.enabled` as `pointsRules.${string}.enabled`}
                    render={({ field }) => (
                      <FormControl>
                        <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    )}
                  />
                  <span className="text-sm font-medium min-w-[5rem]">{meta.label}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <FormField
                      control={control}
                      name={`pointsRules.${action}.points` as `pointsRules.${string}.points`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-1">
                          <FormLabel className="text-xs text-muted-foreground whitespace-nowrap">积分</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={10000}
                              className="w-20 h-8 text-sm"
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`pointsRules.${action}.dailyLimit` as `pointsRules.${string}.dailyLimit`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-1">
                          <FormLabel className="text-xs text-muted-foreground whitespace-nowrap">日限</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={1000}
                              className="w-20 h-8 text-sm"
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminOverview() {
  const { data, isLoading } = trpc.referral.adminGetOverview.useQuery();
  const { data: topReferrers, isLoading: topLoading } = trpc.referral.adminGetTopReferrers.useQuery({ limit: 5 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "总推广人数", value: data?.totalReferrals ?? 0, icon: Users, color: "text-blue-500" },
          { label: "推广链接数", value: data?.totalLinks ?? 0, icon: Link2, color: "text-green-500" },
          { label: "累计奖励积分", value: data?.totalPointsAwarded ?? 0, icon: Coins, color: "text-amber-500" },
          { label: "今日新增", value: data?.todayRegisters ?? 0, icon: TrendingUp, color: "text-purple-500" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                {item.label}
              </div>
              <div className="text-2xl font-bold">{item.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top referrers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">推广排行</CardTitle>
        </CardHeader>
        <CardContent>
          {topLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !topReferrers?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">暂无推广数据</p>
          ) : (
            <div className="space-y-2">
              {topReferrers.map((item, idx) => (
                <div key={item.user.id} className="flex items-center gap-3 py-2">
                  <span className="text-sm font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {(item.user.nickname || item.user.username)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {item.user.nickname || item.user.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {item.referralCount}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      <Coins className="h-3 w-3 mr-0.5" />
                      {item.totalPoints}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PointsSettingsForm() {
  const { data: config, isLoading } = trpc.admin.getSiteConfig.useQuery();
  const utils = trpc.useUtils();

  const configResetRef = useRef<number>(0);

  const form = useForm<PointsConfigValues>({
    resolver: zodResolver(pointsConfigSchema),
    defaultValues: {
      referralEnabled: false,
      referralPointsPerUser: 100,
      referralMaxLinksPerUser: 20,
      pointsRules: { ...DEFAULT_POINTS_RULES },
      checkinEnabled: false,
      checkinPointsMin: 1,
      checkinPointsMax: 10,
    },
  });

  const resetFormFromConfig = useCallback(
    (cfg: Record<string, unknown>) => {
      form.reset({
        referralEnabled: (cfg.referralEnabled as boolean) ?? false,
        referralPointsPerUser: (cfg.referralPointsPerUser as number) ?? 100,
        referralMaxLinksPerUser: (cfg.referralMaxLinksPerUser as number) ?? 20,
        pointsRules: {
          ...DEFAULT_POINTS_RULES,
          ...((cfg.pointsRules as PointsConfigValues["pointsRules"]) || {}),
        },
        checkinEnabled: (cfg.checkinEnabled as boolean) ?? false,
        checkinPointsMin: (cfg.checkinPointsMin as number) ?? 1,
        checkinPointsMax: (cfg.checkinPointsMax as number) ?? 10,
      });
    },
    [form],
  );

  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: (data) => {
      toast.success("积分设置已保存");
      resetFormFromConfig(data as unknown as Record<string, unknown>);
      configResetRef.current = new Date(data.updatedAt).getTime();
      utils.admin.getSiteConfig.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (config) {
      const ts = new Date(config.updatedAt).getTime();
      if (configResetRef.current !== ts) {
        configResetRef.current = ts;
        resetFormFromConfig(config as unknown as Record<string, unknown>);
      }
    }
  }, [config, resetFormFromConfig]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = (values: PointsConfigValues) => {
    const { dirtyFields } = form.formState;
    const dirtyKeys = Object.keys(dirtyFields).filter((k) => dirtyFields[k as keyof typeof dirtyFields]);
    if (dirtyKeys.length === 0) {
      toast.info("没有修改");
      return;
    }
    const dirtyValues = Object.fromEntries(dirtyKeys.map((k) => [k, (values as Record<string, unknown>)[k]]));
    updateConfig.mutate(dirtyValues);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 推广系统 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              推广系统
            </CardTitle>
            <CardDescription>用户可创建推广链接，邀请新用户注册赚取积分</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="referralEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用推广系统</FormLabel>
                    <FormDescription>开启后用户可创建推广链接，邀请新用户注册赚取积分</FormDescription>
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
                name="referralPointsPerUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>每推广一人奖励积分</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 100)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="referralMaxLinksPerUser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>每用户最多推广链接数</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 20)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 签到系统 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              每日签到
            </CardTitle>
            <CardDescription>用户每天可手动签到一次，获得随机积分奖励</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="checkinEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>启用每日签到</FormLabel>
                    <FormDescription>开启后用户每天可手动签到一次，获得随机积分奖励（正态分布）</FormDescription>
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
                name="checkinPointsMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>签到积分下限</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>签到获得积分的最小值</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkinPointsMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>签到积分上限</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 10)}
                      />
                    </FormControl>
                    <FormDescription>签到获得积分的最大值，积分在上下限之间正态分布</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 积分规则 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              积分规则
            </CardTitle>
            <CardDescription>为各类用户行为配置积分奖励。每日限额为 0 时表示不限次数。</CardDescription>
          </CardHeader>
          <CardContent>
            <PointsRulesEditor control={form.control} />
          </CardContent>
        </Card>

        <Button type="submit" disabled={updateConfig.isPending}>
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          保存设置
        </Button>
      </form>
    </Form>
  );
}

// ========== Redeem Codes ==========

function RedeemCodesManager() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{ codes: string[]; batchId: string } | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.redeem.adminList.useQuery({ page, limit: 20, search: search || undefined });

  const deleteMutation = trpc.redeem.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("兑换码已删除");
      setDeleteId(null);
      utils.redeem.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.redeem.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("已更新");
      utils.redeem.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">兑换码管理</CardTitle>
            <CardDescription>创建和管理兑换码，用户可通过兑换码获得积分或权限</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowBatch(true)}>
              <Upload className="h-4 w-4 mr-1" />
              批量生成
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              创建
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="搜索兑换码或描述..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.codes.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>暂无兑换码</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.codes.map((code) => {
                const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
                const isFull = code.maxUses > 0 && code.usedCount >= code.maxUses;
                return (
                  <div
                    key={code.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-sm font-medium">{code.code}</code>
                        {!code.isActive && (
                          <Badge variant="outline" className="text-xs">
                            已停用
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="destructive" className="text-xs">
                            已过期
                          </Badge>
                        )}
                        {isFull && (
                          <Badge variant="secondary" className="text-xs">
                            已用完
                          </Badge>
                        )}
                      </div>
                      {code.description && <div className="text-xs text-muted-foreground">{code.description}</div>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {code.pointsAmount > 0 && (
                          <span className="flex items-center gap-1">
                            <Coins className="h-3 w-3" />
                            {code.pointsAmount} 积分
                          </span>
                        )}
                        {code.grantUpload && (
                          <span className="flex items-center gap-1">
                            <Upload className="h-3 w-3" />
                            投稿权限
                          </span>
                        )}
                        <span>
                          已用 {code.usedCount}/{code.maxUses === 0 ? "∞" : code.maxUses}
                        </span>
                        {code.expiresAt && <span>过期: {new Date(code.expiresAt).toLocaleDateString()}</span>}
                        {code.batchId && (
                          <Badge variant="outline" className="text-[10px] px-1">
                            批次 {code.batchId.slice(0, 6)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={code.isActive}
                        onCheckedChange={(checked) => updateMutation.mutate({ id: code.id, isActive: checked })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(code.code);
                          toast.success("已复制");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(code.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {data.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground flex items-center px-2">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRedeemDialog open={showCreate} onOpenChange={setShowCreate} />
      <BatchCreateRedeemDialog open={showBatch} onOpenChange={setShowBatch} onResult={setBatchResult} />
      <BatchResultDialog result={batchResult} onClose={() => setBatchResult(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后兑换码将无法使用，已有的兑换记录不受影响。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateRedeemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [pointsAmount, setPointsAmount] = useState(100);
  const [grantUpload, setGrantUpload] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.redeem.adminCreate.useMutation({
    onSuccess: () => {
      toast.success("兑换码创建成功");
      onOpenChange(false);
      resetForm();
      utils.redeem.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => {
    setCode("");
    setDescription("");
    setPointsAmount(100);
    setGrantUpload(false);
    setMaxUses(1);
    setExpiresAt("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建兑换码</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">兑换码 *</label>
            <Input placeholder="如 WELCOME2026" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <p className="text-xs text-muted-foreground">只能包含字母、数字、下划线和横杠</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <Input placeholder="内部备注" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">奖励积分</label>
              <Input
                type="number"
                min={0}
                value={pointsAmount}
                onChange={(e) => setPointsAmount(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">最大使用次数</label>
              <Input
                type="number"
                min={0}
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground">0 = 不限次数</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">授予投稿权限</label>
              <p className="text-xs text-muted-foreground">兑换后用户将获得投稿权限</p>
            </div>
            <Switch checked={grantUpload} onCheckedChange={setGrantUpload} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">过期时间（可选）</label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!code || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                code,
                description: description || undefined,
                pointsAmount,
                grantUpload,
                maxUses,
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
              })
            }
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchCreateRedeemDialog({
  open,
  onOpenChange,
  onResult,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResult: (r: { codes: string[]; batchId: string }) => void;
}) {
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState("");
  const [codeLength, setCodeLength] = useState(8);
  const [description, setDescription] = useState("");
  const [pointsAmount, setPointsAmount] = useState(100);
  const [grantUpload, setGrantUpload] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const utils = trpc.useUtils();

  const batchMutation = trpc.redeem.adminBatchCreate.useMutation({
    onSuccess: (data) => {
      toast.success(`成功生成 ${data.count} 个兑换码`);
      onOpenChange(false);
      onResult({ codes: data.codes, batchId: data.batchId });
      utils.redeem.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批量生成兑换码</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">数量 *</label>
              <Input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">前缀</label>
              <Input placeholder="如 VIP" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">随机部分长度</label>
              <Input
                type="number"
                min={6}
                max={20}
                value={codeLength}
                onChange={(e) => setCodeLength(parseInt(e.target.value, 10) || 8)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <Input placeholder="批次备注" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">奖励积分</label>
              <Input
                type="number"
                min={0}
                value={pointsAmount}
                onChange={(e) => setPointsAmount(parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">每码最大使用次数</label>
              <Input
                type="number"
                min={0}
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground">0 = 不限</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">授予投稿权限</label>
              <p className="text-xs text-muted-foreground">兑换后用户将获得投稿权限</p>
            </div>
            <Switch checked={grantUpload} onCheckedChange={setGrantUpload} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">过期时间（可选）</label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={batchMutation.isPending}
            onClick={() =>
              batchMutation.mutate({
                count,
                prefix,
                codeLength,
                description: description || undefined,
                pointsAmount,
                grantUpload,
                maxUses,
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
              })
            }
          >
            {batchMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchResultDialog({
  result,
  onClose,
}: {
  result: { codes: string[]; batchId: string } | null;
  onClose: () => void;
}) {
  if (!result) return null;

  const allCodes = result.codes.join("\n");

  return (
    <Dialog open={!!result} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批量生成完成</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            成功生成 {result.codes.length} 个兑换码（批次: {result.batchId.slice(0, 8)}）
          </p>
          <div className="max-h-60 overflow-auto rounded-md border p-3 bg-muted/30">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">{allCodes}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(allCodes);
              toast.success("已复制全部兑换码");
            }}
          >
            <Copy className="h-4 w-4 mr-1" />
            复制全部
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Page ==========

export default function PointsManagementPage() {
  const [activeTab, setActiveTab] = useTabParam("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="h-6 w-6" />
          积分管理
        </h1>
        <p className="text-muted-foreground mt-1">管理推广系统、签到奖励和积分规则</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            数据概览
          </TabsTrigger>
          <TabsTrigger value="redeem" className="gap-1.5">
            <Ticket className="h-4 w-4" />
            兑换码
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            积分设置
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <AdminOverview />
        </TabsContent>
        <TabsContent value="redeem" className="mt-4">
          <RedeemCodesManager />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <PointsSettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
