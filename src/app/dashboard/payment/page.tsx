"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-with-sound";
import {
  Wallet,
  TrendingUp,
  Package,
  ListOrdered,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle,
  Ban,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ========== Schemas ==========

const packageFormSchema = z.object({
  name: z.string().min(1, "名称必填").max(50),
  amount: z.number().min(0.01, "金额须大于 0"),
  pointsAmount: z.number().int().min(0),
  grantUpload: z.boolean(),
  description: z.string().optional(),
  sortOrder: z.number().int(),
});
type PackageFormValues = z.infer<typeof packageFormSchema>;

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "待支付", variant: "secondary" },
  PAID: { label: "已支付", variant: "default" },
  EXPIRED: { label: "已过期", variant: "outline" },
  CANCELLED: { label: "已取消", variant: "destructive" },
};

// ========== Stats Cards ==========

function StatsCards() {
  const { data, isLoading } = trpc.payment.adminGetStats.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "总收入 (USDT)", value: data.totalRevenue.toFixed(2), icon: DollarSign },
    { label: "今日收入", value: data.todayRevenue.toFixed(2), icon: TrendingUp },
    { label: "成功订单", value: data.paidOrders, icon: CheckCircle },
    { label: "转化率", value: `${data.conversionRate}%`, icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <c.icon className="h-4 w-4" />
              {c.label}
            </div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ========== Orders Tab ==========

function OrdersTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; orderNo: string } | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.payment.adminListOrders.useQuery({
    page,
    limit: 20,
    status: status as "ALL" | "PENDING" | "PAID" | "EXPIRED" | "CANCELLED",
    search: search || undefined,
  });
  const confirmMutation = trpc.payment.adminManualConfirm.useMutation({
    onSuccess: () => {
      toast.success("订单已确认");
      setConfirmDialog(null);
      setTxHashInput("");
      utils.payment.adminListOrders.invalidate();
      utils.payment.adminGetStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const cancelMutation = trpc.payment.adminCancelOrder.useMutation({
    onSuccess: () => {
      toast.success("订单已取消");
      setCancelDialog(null);
      utils.payment.adminListOrders.invalidate();
      utils.payment.adminGetStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="PENDING">待支付</SelectItem>
            <SelectItem value="PAID">已支付</SelectItem>
            <SelectItem value="EXPIRED">已过期</SelectItem>
            <SelectItem value="CANCELLED">已取消</SelectItem>
          </SelectContent>
        </Select>

        <form
          className="flex gap-2 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
        >
          <Input
            placeholder="搜索订单号/用户名/邮箱/txHash"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data?.orders.length ? (
        <div className="text-center text-muted-foreground py-12">暂无订单</div>
      ) : (
        <div className="space-y-2">
          {data.orders.map((order) => {
            const s = statusMap[order.status] || statusMap.PENDING;
            return (
              <div
                key={order.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{order.orderNo}</span>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>
                      {order.user.username} ({order.user.email})
                    </span>
                    <span>
                      {order.amount} USDT → {order.pointsAmount} 积分
                    </span>
                    {order.grantUpload && <span className="text-green-500">+上传权限</span>}
                    {order.package && <span>套餐: {order.package.name}</span>}
                    <span>{new Date(order.createdAt).toLocaleString("zh-CN")}</span>
                    {order.txHash && (
                      <span className="truncate max-w-[200px]" title={order.txHash}>
                        TX: {order.txHash}
                      </span>
                    )}
                  </div>
                </div>
                {order.status === "PENDING" && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDialog({ id: order.id, orderNo: order.orderNo })}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      确认
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelDialog(order.id)}>
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      取消
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 手动确认 Dialog */}
      <Dialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动确认订单 {confirmDialog?.orderNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">请输入链上交易哈希以确认该订单已收到付款：</p>
            <Input
              placeholder="交易哈希 (txHash)"
              value={txHashInput}
              onChange={(e) => setTxHashInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              取消
            </Button>
            <Button
              disabled={txHashInput.length < 10 || confirmMutation.isPending}
              onClick={() =>
                confirmDialog && confirmMutation.mutate({ orderId: confirmDialog.id, txHash: txHashInput })
              }
            >
              {confirmMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              确认收款
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取消确认 */}
      <AlertDialog
        open={!!cancelDialog}
        onOpenChange={(open) => {
          if (!open) setCancelDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消订单</AlertDialogTitle>
            <AlertDialogDescription>确定要取消该订单吗？此操作不可逆。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={() => cancelDialog && cancelMutation.mutate({ orderId: cancelDialog })}
            >
              确定取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== Packages Tab ==========

function PackagesTab() {
  const [editPkg, setEditPkg] = useState<{ id?: string } | null>(null);
  const [deletePkg, setDeletePkg] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: packages, isLoading } = trpc.payment.adminListPackages.useQuery();
  const createMutation = trpc.payment.adminCreatePackage.useMutation({
    onSuccess: () => {
      toast.success("套餐已创建");
      setEditPkg(null);
      utils.payment.adminListPackages.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.payment.adminUpdatePackage.useMutation({
    onSuccess: () => {
      toast.success("套餐已更新");
      setEditPkg(null);
      utils.payment.adminListPackages.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.payment.adminDeletePackage.useMutation({
    onSuccess: (result) => {
      toast.success(result.deactivated ? "套餐已停用（存在关联订单）" : "套餐已删除");
      setDeletePkg(null);
      utils.payment.adminListPackages.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: { name: "", amount: 5, pointsAmount: 50000, grantUpload: false, description: "", sortOrder: 0 },
  });

  const openEdit = (pkg?: {
    id: string;
    name: string;
    amount: number;
    pointsAmount: number;
    grantUpload: boolean;
    description: string | null;
    sortOrder: number;
  }) => {
    if (pkg) {
      form.reset({
        name: pkg.name,
        amount: pkg.amount,
        pointsAmount: pkg.pointsAmount,
        grantUpload: pkg.grantUpload,
        description: pkg.description ?? "",
        sortOrder: pkg.sortOrder,
      });
      setEditPkg({ id: pkg.id });
    } else {
      form.reset({ name: "", amount: 5, pointsAmount: 50000, grantUpload: false, description: "", sortOrder: 0 });
      setEditPkg({});
    }
  };

  const onSubmit = (values: PackageFormValues) => {
    if (editPkg?.id) {
      updateMutation.mutate({ id: editPkg.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">充值套餐</h3>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus className="h-4 w-4 mr-1" />
          新增套餐
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !packages?.length ? (
        <div className="text-center text-muted-foreground py-12">暂无套餐，点击上方按钮创建</div>
      ) : (
        <div className="space-y-2">
          {packages.map((pkg) => (
            <div key={pkg.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{pkg.name}</span>
                  {!pkg.isActive && <Badge variant="outline">已停用</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span>{pkg.amount} USDT</span>
                  <span>{pkg.pointsAmount} 积分</span>
                  {pkg.grantUpload && <span className="text-green-500">+上传权限</span>}
                  <span>订单数: {pkg._count.orders}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(pkg)}>
                  编辑
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeletePkg(pkg.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/创建 Dialog */}
      <Dialog
        open={!!editPkg}
        onOpenChange={(open) => {
          if (!open) setEditPkg(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPkg?.id ? "编辑套餐" : "新增套餐"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如: 基础套餐" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>金额 (USDT)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={0.01}
                          min={0.01}
                          value={field.value}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pointsAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>积分</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="grantUpload"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>授予上传权限</FormLabel>
                      <FormDescription>购买后用户获得投稿权限</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（可选）</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="套餐说明" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>数字越小越靠前</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditPkg(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  <Save className="h-4 w-4 mr-1" />
                  {editPkg?.id ? "保存" : "创建"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deletePkg}
        onOpenChange={(open) => {
          if (!open) setDeletePkg(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除套餐</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除该套餐吗？如果有关联订单，套餐将被标记为停用而非删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deletePkg && deleteMutation.mutate({ id: deletePkg })}
            >
              确定删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========== Main Page ==========

export default function PaymentAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          支付管理
        </h1>
        <p className="text-muted-foreground mt-1">管理 USDT 充值订单和套餐</p>
      </div>

      <StatsCards />

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5">
            <ListOrdered className="h-4 w-4" />
            <span className="hidden sm:inline">订单管理</span>
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">充值套餐</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>订单列表</CardTitle>
              <CardDescription>查看和管理所有 USDT 充值订单</CardDescription>
            </CardHeader>
            <CardContent>
              <OrdersTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages">
          <Card>
            <CardHeader>
              <CardTitle>充值套餐</CardTitle>
              <CardDescription>管理充值套餐（预定义的积分/权限组合）</CardDescription>
            </CardHeader>
            <CardContent>
              <PackagesTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
