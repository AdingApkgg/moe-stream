"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Trash2,
  EyeOff,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Globe,
  Globe2,
  Smartphone,
  Monitor,
  Tablet,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  CheckSquare,
  Square,
  XCircle,
  Video,
  Gamepad2,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StatusFilter = "ALL" | "VISIBLE" | "HIDDEN" | "DELETED";

function DeviceIcon({ deviceType, className }: { deviceType?: string | null; className?: string }) {
  switch (deviceType?.toLowerCase()) {
    case "mobile":
      return <Smartphone className={className} />;
    case "tablet":
      return <Tablet className={className} />;
    default:
      return <Monitor className={className} />;
  }
}

interface DeviceInfoType {
  deviceType?: string | null;
  os?: string | null;
  osVersion?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  brand?: string | null;
  model?: string | null;
  platform?: string | null;
  language?: string | null;
  timezone?: string | null;
  screen?: string | null;
  pixelRatio?: number | null;
}

interface CommentCardProps {
  comment: {
    id: string;
    content: string;
    userId: string | null;
    user: { id: string; username: string; nickname: string | null; avatar: string | null } | null;
    likes: number;
    dislikes: number;
    isDeleted: boolean;
    isHidden: boolean;
    isPinned: boolean;
    createdAt: Date;
    ipv4Address: string | null;
    ipv4Location: string | null;
    ipv6Address: string | null;
    ipv6Location: string | null;
    deviceInfo: unknown;
    userAgent: string | null;
    guestName?: string | null;
  };
  contentLink: { href: string; title: string };
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
}

function CommentCard({
  comment,
  contentLink,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onToggleHidden,
  onDelete,
  onRestore,
  onHardDelete,
}: CommentCardProps) {
  const deviceInfo = comment.deviceInfo as DeviceInfoType | null;
  const isGuest = !comment.user;
  const displayName = isGuest
    ? (comment.guestName || "访客")
    : (comment.user!.nickname || comment.user!.username);

  return (
    <Card
      className={cn(
        "transition-colors",
        isSelected && "ring-2 ring-primary",
        comment.isDeleted && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />

          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={isGuest ? undefined : (comment.user!.avatar || undefined)} />
            <AvatarFallback>
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isGuest ? (
                <span className="font-medium text-muted-foreground">
                  {displayName}
                  <span className="ml-1 text-xs">(访客)</span>
                </span>
              ) : (
                <Link
                  href={`/user/${comment.user!.id}`}
                  className="font-medium hover:underline"
                >
                  {displayName}
                </Link>
              )}
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(comment.createdAt)}
              </span>
              {comment.isDeleted && (
                <Badge variant="destructive" className="text-xs">已删除</Badge>
              )}
              {comment.isHidden && !comment.isDeleted && (
                <Badge variant="secondary" className="text-xs">已隐藏</Badge>
              )}
              {comment.isPinned && (
                <Badge className="text-xs">已置顶</Badge>
              )}
            </div>

            <p className="mt-1 text-sm whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <Link
                href={contentLink.href}
                className="hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                {contentLink.title}
              </Link>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {comment.likes}
              </span>
              <span className="flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" />
                {comment.dislikes}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {comment.ipv4Location && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  <Globe className="h-3 w-3 text-blue-500" />
                  {comment.ipv4Location}
                </span>
              )}
              {comment.ipv6Location && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  <Globe2 className="h-3 w-3 text-purple-500" />
                  {comment.ipv6Location}
                </span>
              )}
              {deviceInfo && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                  <DeviceIcon deviceType={deviceInfo?.deviceType} className="h-3 w-3" />
                  {[deviceInfo.os, deviceInfo.osVersion].filter(Boolean).join(" ")}
                  {deviceInfo.browser && ` · ${deviceInfo.browser}`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleHidden}
              title={comment.isHidden ? "显示" : "隐藏"}
            >
              {comment.isHidden ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>

            {comment.isDeleted ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onRestore}
                  title="恢复"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      title="彻底删除"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确定彻底删除吗？</AlertDialogTitle>
                      <AlertDialogDescription className="text-destructive">
                        将永久删除此评论及其所有回复，此操作不可恢复！
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onHardDelete}
                      >
                        永久删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确定删除这条评论吗？</AlertDialogTitle>
                    <AlertDialogDescription>
                      删除后可通过「已删除」筛选找到并恢复。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>
                      删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleExpand}
              title="详情"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="font-medium text-foreground mb-1">评论 ID</div>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{comment.id}</code>
                </div>
                <div>
                  <div className="font-medium text-foreground mb-1">IPv4 地址</div>
                  {comment.ipv4Address || "-"}
                </div>
                <div>
                  <div className="font-medium text-foreground mb-1">IPv6 地址</div>
                  <span className="break-all">{comment.ipv6Address || "-"}</span>
                </div>
                <div>
                  <div className="font-medium text-foreground mb-1">创建时间</div>
                  {new Date(comment.createdAt).toLocaleString("zh-CN")}
                </div>
              </div>

              {deviceInfo && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                  <div>
                    <div className="font-medium text-foreground mb-1">设备类型</div>
                    {deviceInfo.deviceType || "-"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">操作系统</div>
                    {[deviceInfo.os, deviceInfo.osVersion].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">浏览器</div>
                    {[deviceInfo.browser, deviceInfo.browserVersion].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">设备</div>
                    {[deviceInfo.brand, deviceInfo.model].filter(Boolean).join(" ") || "-"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">屏幕</div>
                    {deviceInfo.screen || "-"} {deviceInfo.pixelRatio && `@${deviceInfo.pixelRatio}x`}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">语言</div>
                    {deviceInfo.language || "-"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">时区</div>
                    {deviceInfo.timezone || "-"}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">平台</div>
                    {deviceInfo.platform || "-"}
                  </div>
                </div>
              )}

              {comment.userAgent && (
                <div className="mt-3">
                  <div className="font-medium text-foreground mb-1">User-Agent</div>
                  <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                    {comment.userAgent}
                  </code>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function VideoCommentList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.admin.listComments.useInfiniteQuery(
    { limit: 20, search: search || undefined, status },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const { data: stats } = trpc.admin.getCommentStats.useQuery();

  const comments = useMemo(
    () => data?.pages.flatMap((page) => page.comments) ?? [],
    [data?.pages]
  );

  const toggleHiddenMutation = trpc.admin.toggleCommentHidden.useMutation({
    onSuccess: () => {
      utils.admin.listComments.invalidate();
      utils.admin.getCommentStats.invalidate();
      toast.success("操作成功");
    },
    onError: (error) => toast.error(error.message || "操作失败"),
  });

  const deleteMutation = trpc.admin.deleteComment.useMutation({
    onSuccess: () => {
      utils.admin.listComments.invalidate();
      utils.admin.getCommentStats.invalidate();
      setSelectedIds(new Set());
      toast.success("评论已删除");
    },
    onError: (error) => toast.error(error.message || "删除失败"),
  });

  const restoreMutation = trpc.admin.restoreComment.useMutation({
    onSuccess: () => {
      utils.admin.listComments.invalidate();
      utils.admin.getCommentStats.invalidate();
      toast.success("评论已恢复");
    },
    onError: (error) => toast.error(error.message || "恢复失败"),
  });

  const batchMutation = trpc.admin.batchCommentAction.useMutation({
    onSuccess: (result) => {
      utils.admin.listComments.invalidate();
      utils.admin.getCommentStats.invalidate();
      setSelectedIds(new Set());
      toast.success(`已处理 ${result.count} 条评论`);
    },
    onError: (error) => toast.error(error.message || "批量操作失败"),
  });

  const hardDeleteMutation = trpc.admin.hardDeleteComment.useMutation({
    onSuccess: () => {
      utils.admin.listComments.invalidate();
      utils.admin.getCommentStats.invalidate();
      toast.success("评论已彻底删除");
    },
    onError: (error) => toast.error(error.message || "删除失败"),
  });

  const batchHardDeleteMutation = trpc.admin.batchHardDeleteComments.useMutation({
    onSuccess: (result) => {
      utils.admin.listComments.invalidate();
      utils.admin.getCommentStats.invalidate();
      setSelectedIds(new Set());
      toast.success(`已彻底删除 ${result.count} 条评论`);
    },
    onError: (error) => toast.error(error.message || "批量删除失败"),
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === comments.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(comments.map((c) => c.id)));
  }, [comments, selectedIds.size]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchAction = useCallback(
    (action: "hide" | "show" | "delete" | "restore") => {
      if (selectedIds.size === 0) return;
      batchMutation.mutate({ commentIds: Array.from(selectedIds), action });
    },
    [selectedIds, batchMutation]
  );

  return (
    <div className="space-y-6">
      {stats && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">总计</span>
            <Badge variant="outline">{stats.total}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">可见</span>
            <Badge variant="secondary">{stats.visible}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">隐藏</span>
            <Badge variant="outline">{stats.hidden}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">删除</span>
            <Badge variant="destructive">{stats.deleted}</Badge>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="搜索评论内容 / 用户 / 视频标题"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-md"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="VISIBLE">可见</SelectItem>
            <SelectItem value="HIDDEN">已隐藏</SelectItem>
            <SelectItem value="DELETED">已删除</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <BatchActions
        selectedIds={selectedIds}
        comments={comments}
        toggleSelectAll={toggleSelectAll}
        handleBatchAction={handleBatchAction}
        batchMutation={batchMutation}
        batchHardDeleteMutation={batchHardDeleteMutation}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无评论
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment as CommentCardProps["comment"]}
              contentLink={{
                href: `/video/${comment.video.id}`,
                title: comment.video.title,
              }}
              isSelected={selectedIds.has(comment.id)}
              isExpanded={expandedIds.has(comment.id)}
              onToggleSelect={() => toggleSelect(comment.id)}
              onToggleExpand={() => toggleExpand(comment.id)}
              onToggleHidden={() =>
                toggleHiddenMutation.mutate({
                  commentId: comment.id,
                  isHidden: !comment.isHidden,
                })
              }
              onDelete={() => deleteMutation.mutate({ commentId: comment.id })}
              onRestore={() => restoreMutation.mutate({ commentId: comment.id })}
              onHardDelete={() => hardDeleteMutation.mutate({ commentId: comment.id })}
            />
          ))}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GameCommentList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.admin.listGameComments.useInfiniteQuery(
    { limit: 20, search: search || undefined, status },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const { data: stats } = trpc.admin.getGameCommentStats.useQuery();

  const comments = useMemo(
    () => data?.pages.flatMap((page) => page.comments) ?? [],
    [data?.pages]
  );

  const toggleHiddenMutation = trpc.admin.toggleGameCommentHidden.useMutation({
    onSuccess: () => {
      utils.admin.listGameComments.invalidate();
      utils.admin.getGameCommentStats.invalidate();
      toast.success("操作成功");
    },
    onError: (error) => toast.error(error.message || "操作失败"),
  });

  const deleteMutation = trpc.admin.deleteGameComment.useMutation({
    onSuccess: () => {
      utils.admin.listGameComments.invalidate();
      utils.admin.getGameCommentStats.invalidate();
      setSelectedIds(new Set());
      toast.success("评论已删除");
    },
    onError: (error) => toast.error(error.message || "删除失败"),
  });

  const restoreMutation = trpc.admin.restoreGameComment.useMutation({
    onSuccess: () => {
      utils.admin.listGameComments.invalidate();
      utils.admin.getGameCommentStats.invalidate();
      toast.success("评论已恢复");
    },
    onError: (error) => toast.error(error.message || "恢复失败"),
  });

  const batchMutation = trpc.admin.batchGameCommentAction.useMutation({
    onSuccess: (result) => {
      utils.admin.listGameComments.invalidate();
      utils.admin.getGameCommentStats.invalidate();
      setSelectedIds(new Set());
      toast.success(`已处理 ${result.count} 条评论`);
    },
    onError: (error) => toast.error(error.message || "批量操作失败"),
  });

  const hardDeleteMutation = trpc.admin.hardDeleteGameComment.useMutation({
    onSuccess: () => {
      utils.admin.listGameComments.invalidate();
      utils.admin.getGameCommentStats.invalidate();
      toast.success("评论已彻底删除");
    },
    onError: (error) => toast.error(error.message || "删除失败"),
  });

  const batchHardDeleteMutation = trpc.admin.batchHardDeleteGameComments.useMutation({
    onSuccess: (result) => {
      utils.admin.listGameComments.invalidate();
      utils.admin.getGameCommentStats.invalidate();
      setSelectedIds(new Set());
      toast.success(`已彻底删除 ${result.count} 条评论`);
    },
    onError: (error) => toast.error(error.message || "批量删除失败"),
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === comments.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(comments.map((c) => c.id)));
  }, [comments, selectedIds.size]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchAction = useCallback(
    (action: "hide" | "show" | "delete" | "restore") => {
      if (selectedIds.size === 0) return;
      batchMutation.mutate({ commentIds: Array.from(selectedIds), action });
    },
    [selectedIds, batchMutation]
  );

  return (
    <div className="space-y-6">
      {stats && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">总计</span>
            <Badge variant="outline">{stats.total}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">可见</span>
            <Badge variant="secondary">{stats.visible}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">隐藏</span>
            <Badge variant="outline">{stats.hidden}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">删除</span>
            <Badge variant="destructive">{stats.deleted}</Badge>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="搜索评论内容 / 用户 / 游戏标题"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-md"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部</SelectItem>
            <SelectItem value="VISIBLE">可见</SelectItem>
            <SelectItem value="HIDDEN">已隐藏</SelectItem>
            <SelectItem value="DELETED">已删除</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <BatchActions
        selectedIds={selectedIds}
        comments={comments}
        toggleSelectAll={toggleSelectAll}
        handleBatchAction={handleBatchAction}
        batchMutation={batchMutation}
        batchHardDeleteMutation={batchHardDeleteMutation}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无评论
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment as CommentCardProps["comment"]}
              contentLink={{
                href: `/game/${comment.game.id}`,
                title: comment.game.title,
              }}
              isSelected={selectedIds.has(comment.id)}
              isExpanded={expandedIds.has(comment.id)}
              onToggleSelect={() => toggleSelect(comment.id)}
              onToggleExpand={() => toggleExpand(comment.id)}
              onToggleHidden={() =>
                toggleHiddenMutation.mutate({
                  commentId: comment.id,
                  isHidden: !comment.isHidden,
                })
              }
              onDelete={() => deleteMutation.mutate({ commentId: comment.id })}
              onRestore={() => restoreMutation.mutate({ commentId: comment.id })}
              onHardDelete={() => hardDeleteMutation.mutate({ commentId: comment.id })}
            />
          ))}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BatchActionsProps {
  selectedIds: Set<string>;
  comments: { id: string }[];
  toggleSelectAll: () => void;
  handleBatchAction: (action: "hide" | "show" | "delete" | "restore") => void;
  batchMutation: { isPending: boolean };
  batchHardDeleteMutation: { isPending: boolean; mutate: (input: { commentIds: string[] }) => void };
}

function BatchActions({
  selectedIds,
  comments,
  toggleSelectAll,
  handleBatchAction,
  batchMutation,
  batchHardDeleteMutation,
}: BatchActionsProps) {
  if (comments.length === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSelectAll}
        className="gap-1"
      >
        {selectedIds.size === comments.length ? (
          <CheckSquare className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        {selectedIds.size === comments.length ? "取消全选" : "全选"}
      </Button>

      {selectedIds.size > 0 && (
        <>
          <span className="text-sm text-muted-foreground">
            已选 {selectedIds.size} 条
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction("hide")}
              disabled={batchMutation.isPending}
            >
              <EyeOff className="h-4 w-4 mr-1" />
              批量隐藏
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction("show")}
              disabled={batchMutation.isPending}
            >
              <Eye className="h-4 w-4 mr-1" />
              批量显示
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={batchMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  批量删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定批量删除吗？</AlertDialogTitle>
                  <AlertDialogDescription>
                    将删除 {selectedIds.size} 条评论，此操作可通过「已删除」筛选后恢复。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleBatchAction("delete")}>
                    确定删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction("restore")}
              disabled={batchMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              批量恢复
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={batchHardDeleteMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  彻底删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确定彻底删除吗？</AlertDialogTitle>
                  <AlertDialogDescription className="text-destructive">
                    将永久删除 {selectedIds.size} 条评论及其所有回复，此操作不可恢复！
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => batchHardDeleteMutation.mutate({ commentIds: Array.from(selectedIds) })}
                  >
                    永久删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminCommentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h1 className="text-xl font-semibold">评论管理</h1>
      </div>

      <Tabs defaultValue="video">
        <TabsList>
          <TabsTrigger value="video" className="gap-1.5">
            <Video className="h-4 w-4" />
            视频评论
          </TabsTrigger>
          <TabsTrigger value="game" className="gap-1.5">
            <Gamepad2 className="h-4 w-4" />
            游戏评论
          </TabsTrigger>
        </TabsList>
        <TabsContent value="video" className="mt-4">
          <VideoCommentList />
        </TabsContent>
        <TabsContent value="game" className="mt-4">
          <GameCommentList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
