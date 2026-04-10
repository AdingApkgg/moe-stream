"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "@/lib/toast-with-sound";
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Ban,
  CheckCircle,
  Video,
  MessageSquare,
  Heart,
  Globe,
  Calendar,
  Mail,
  ExternalLink,
  CheckSquare,
  Square,
  UserX,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "USER" | "ADMIN" | "OWNER";

interface UserItem {
  id: string;
  email: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: UserRole;
  isBanned: boolean;
  banReason: string | null;
  lastIpLocation: string | null;
  createdAt: Date;
  groupId: string | null;
  group: { id: string; name: string; color: string | null } | null;
  _count: { videos: number; comments: number; likes: number };
}

export default function AdminUsersClient({ page: initialPage }: { page: number }) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [bannedFilter, setBannedFilter] = useState<"ALL" | "BANNED" | "ACTIVE">("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [banningUser, setBanningUser] = useState<UserItem | null>(null);
  const [banReason, setBanReason] = useState("");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };
  const handleRoleFilterChange = (value: typeof roleFilter) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };
  const handleBannedFilterChange = (value: typeof bannedFilter) => {
    setBannedFilter(value);
    setCurrentPage(1);
  };
  const handleGroupFilterChange = (value: string) => {
    setGroupFilter(value);
    setCurrentPage(1);
  };

  const utils = trpc.useUtils();

  const { data: permissions } = trpc.admin.getMyPermissions.useQuery();
  const { data: stats } = trpc.admin.getUserStats.useQuery(undefined, {
    enabled: permissions?.scopes.includes("user:view"),
  });

  const { data: groups } = trpc.admin.listGroups.useQuery(undefined, {
    enabled: !!permissions?.scopes.includes("user:manage"),
  });

  const { data, isLoading } = trpc.admin.listUsers.useQuery(
    {
      limit: 20,
      page: currentPage,
      search: search || undefined,
      role: roleFilter,
      banned: bannedFilter,
      groupId: groupFilter !== "ALL" ? groupFilter : undefined,
    },
    { enabled: permissions?.scopes.includes("user:view") },
  );

  const assignGroupMutation = trpc.admin.assignUsersToGroup.useMutation({
    onSuccess: (result) => {
      toast.success(`已将 ${result.count} 个用户分配到用户组`);
      utils.admin.listUsers.invalidate();
      utils.admin.listGroups.invalidate();
      setSelectedIds(new Set());
      setEditingUser(null);
    },
    onError: (error) => toast.error(error.message || "分配失败"),
  });

  const banUserMutation = trpc.admin.banUser.useMutation({
    onSuccess: () => {
      toast.success("用户已封禁");
      utils.admin.listUsers.invalidate();
      utils.admin.getUserStats.invalidate();
      setBanningUser(null);
      setBanReason("");
    },
    onError: (error) => toast.error(error.message || "封禁失败"),
  });

  const unbanUserMutation = trpc.admin.unbanUser.useMutation({
    onSuccess: () => {
      toast.success("用户已解封");
      utils.admin.listUsers.invalidate();
      utils.admin.getUserStats.invalidate();
    },
    onError: (error) => toast.error(error.message || "解封失败"),
  });

  const batchBanMutation = trpc.admin.batchBanUsers.useMutation({
    onSuccess: (result) => {
      toast.success(`已封禁 ${result.count} 个用户`);
      utils.admin.listUsers.invalidate();
      utils.admin.getUserStats.invalidate();
      setSelectedIds(new Set());
    },
    onError: (error) => toast.error(error.message || "批量封禁失败"),
  });

  const batchUnbanMutation = trpc.admin.batchUnbanUsers.useMutation({
    onSuccess: (result) => {
      toast.success(`已解封 ${result.count} 个用户`);
      utils.admin.listUsers.invalidate();
      utils.admin.getUserStats.invalidate();
      setSelectedIds(new Set());
    },
    onError: (error) => toast.error(error.message || "批量解封失败"),
  });

  const users = useMemo(() => data?.users || [], [data?.users]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectableUsers = users.filter((u) => u.role !== "OWNER");
  const allPageSelected = selectableUsers.length > 0 && selectableUsers.every((u) => selectedIds.has(u.id));

  const toggleSelectAll = useCallback(() => {
    if (allPageSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableUsers.map((u) => u.id)));
  }, [selectableUsers, allPageSelected]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "OWNER":
        return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">站长</Badge>;
      case "ADMIN":
        return <Badge variant="secondary">管理员</Badge>;
      default:
        return <Badge variant="outline">用户</Badge>;
    }
  };

  if (!permissions?.scopes.includes("user:view")) {
    return <div className="flex items-center justify-center h-[400px] text-muted-foreground">您没有用户管理权限</div>;
  }

  return (
    <div className="space-y-6">
      {/* 标题和统计 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h1 className="text-xl font-semibold">用户管理</h1>
        </div>

        {stats && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">总计</span>
              <Badge variant="outline">{stats.total}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">普通用户</span>
              <Badge variant="secondary">{stats.users}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">管理员</span>
              <Badge variant="secondary">{stats.admins}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">已封禁</span>
              <Badge variant="destructive">{stats.banned}</Badge>
            </div>
          </div>
        )}
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户名、昵称或邮箱..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => handleRoleFilterChange(v as typeof roleFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部角色</SelectItem>
            <SelectItem value="USER">普通用户</SelectItem>
            <SelectItem value="ADMIN">管理员</SelectItem>
            <SelectItem value="OWNER">站长</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bannedFilter} onValueChange={(v) => handleBannedFilterChange(v as typeof bannedFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部状态</SelectItem>
            <SelectItem value="ACTIVE">正常</SelectItem>
            <SelectItem value="BANNED">已封禁</SelectItem>
          </SelectContent>
        </Select>
        {groups && groups.length > 0 && (
          <Select value={groupFilter} onValueChange={handleGroupFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="用户组" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部用户组</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="flex items-center gap-1.5">
                    {g.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />}
                    {g.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 批量操作栏 */}
      {users.length > 0 && permissions?.scopes.includes("user:manage") && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="gap-1">
            {allPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {allPageSelected ? "取消全选" : "全选"}
          </Button>

          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 个</span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batchBanMutation.mutate({ userIds: Array.from(selectedIds) })}
                  disabled={batchBanMutation.isPending}
                >
                  <UserX className="h-4 w-4 mr-1" />
                  批量封禁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batchUnbanMutation.mutate({ userIds: Array.from(selectedIds) })}
                  disabled={batchUnbanMutation.isPending}
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  批量解封
                </Button>
                {permissions?.isOwner && groups && groups.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(groupId) => {
                      assignGroupMutation.mutate({ userIds: Array.from(selectedIds), groupId });
                    }}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <div className="flex items-center gap-1">
                        <UsersRound className="h-3.5 w-3.5" />
                        <span className="text-sm">分配用户组</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="flex items-center gap-1.5">
                            {g.color && (
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                            )}
                            {g.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 用户列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">没有找到用户</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const isSelected = selectedIds.has(user.id);
            const isExpanded = expandedIds.has(user.id);
            const canSelect = user.role !== "OWNER";

            return (
              <Card
                key={user.id}
                className={cn("transition-colors", isSelected && "ring-2 ring-primary", user.isBanned && "opacity-60")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {canSelect && permissions?.scopes.includes("user:manage") && (
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(user.id)} className="mt-2" />
                    )}

                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback>{(user.nickname || user.username).charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/user/${user.id}`} className="font-medium hover:underline">
                          {user.nickname || user.username}
                        </Link>
                        {getRoleBadge(user.role)}
                        {user.group && (
                          <Badge variant="outline" className="text-[11px] gap-1">
                            {user.group.color && (
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: user.group.color }}
                              />
                            )}
                            {user.group.name}
                          </Badge>
                        )}
                        {user.isBanned && (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            已封禁
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>@{user.username}</span>
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          {user._count.videos}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {user._count.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {user._count.likes}
                        </span>
                      </div>

                      {user.lastIpLocation && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                            <Globe className="h-3 w-3 text-blue-500" />
                            {user.lastIpLocation}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 shrink-0">
                      {permissions?.scopes.includes("user:manage") && user.role !== "OWNER" && (
                        <>
                          {user.isBanned ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => unbanUserMutation.mutate({ userId: user.id })}
                              title="解封"
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setBanningUser(user)}
                              title="封禁"
                            >
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </>
                      )}

                      {permissions?.isOwner && user.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingUser(user)}
                          title="分配用户组"
                        >
                          <UsersRound className="h-4 w-4" />
                        </Button>
                      )}

                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/user/${user.id}`} target="_blank" title="查看主页">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleExpand(user.id)}
                        title="详情"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* 展开的详细信息 */}
                  <Collapsible open={isExpanded}>
                    <CollapsibleContent>
                      <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <div className="font-medium text-foreground mb-1">用户 ID</div>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">{user.id}</code>
                          </div>
                          <div>
                            <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              邮箱
                            </div>
                            {user.email}
                          </div>
                          <div>
                            <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              注册时间
                            </div>
                            {new Date(user.createdAt).toLocaleString("zh-CN")}
                          </div>
                          <div>
                            <div className="font-medium text-foreground mb-1">角色</div>
                            {user.role === "OWNER" ? "站长" : user.role === "ADMIN" ? "管理员" : "普通用户"}
                          </div>
                          <div>
                            <div className="font-medium text-foreground mb-1 flex items-center gap-1">
                              <UsersRound className="h-3 w-3" />
                              用户组
                            </div>
                            {user.group ? (
                              <span className="inline-flex items-center gap-1">
                                {user.group.color && (
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: user.group.color }}
                                  />
                                )}
                                {user.group.name}
                              </span>
                            ) : (
                              "未分配"
                            )}
                          </div>
                        </div>

                        {user.isBanned && user.banReason && (
                          <div className="p-2 bg-destructive/10 rounded text-destructive">
                            <div className="font-medium mb-1">封禁原因</div>
                            {user.banReason}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}

          <Pagination
            currentPage={currentPage}
            totalPages={data?.totalPages ?? 1}
            basePath="/dashboard/users"
            onPageChange={setCurrentPage}
            className="mt-6"
          />
        </div>
      )}

      {/* 分配用户组对话框 */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" />
              分配用户组
            </DialogTitle>
            <DialogDescription>修改 {editingUser?.nickname || editingUser?.username} 的所属用户组</DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={editingUser.avatar || undefined} />
                  <AvatarFallback>
                    {(editingUser.nickname || editingUser.username).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{editingUser.nickname || editingUser.username}</div>
                  <div className="text-sm text-muted-foreground">@{editingUser.username}</div>
                </div>
                {editingUser.group && (
                  <Badge variant="outline" className="ml-auto text-xs gap-1">
                    {editingUser.group.color && (
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: editingUser.group.color }} />
                    )}
                    {editingUser.group.name}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">所属用户组</label>
                {groups && groups.length > 0 ? (
                  <Select
                    value={editingUser.groupId ?? ""}
                    onValueChange={(groupId) => {
                      assignGroupMutation.mutate({ userIds: [editingUser.id], groupId });
                    }}
                    disabled={assignGroupMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择用户组" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          <span className="flex items-center gap-1.5">
                            {g.color && (
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                            )}
                            {g.name}
                            <span className="text-muted-foreground ml-1">({g._count.users} 人)</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无用户组</p>
                )}
                <p className="text-xs text-muted-foreground">
                  用户组决定角色级别（用户/管理员/站长）、功能权限和管理权限模板
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 封禁用户对话框 */}
      <AlertDialog open={!!banningUser} onOpenChange={() => setBanningUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>封禁用户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要封禁 {banningUser?.nickname || banningUser?.username} 吗？封禁后该用户将无法登录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">封禁原因（可选）</label>
            <Input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="请输入封禁原因..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBanReason("")}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (banningUser) {
                  banUserMutation.mutate({ userId: banningUser.id, reason: banReason || undefined });
                }
              }}
            >
              确认封禁
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
