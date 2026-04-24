"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  Play,
  Gamepad2,
  ImageIcon,
  ChevronRight,
  User,
  Send,
  BookOpen,
  Globe,
  Mail,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import { Pagination } from "@/components/ui/pagination";
import { useSiteConfig } from "@/contexts/site-config";
import { parseDeviceInfo, getHighEntropyDeviceInfo, mergeDeviceInfo, type DeviceInfo } from "@/lib/device-info";
import { useFingerprint } from "@/hooks/use-fingerprint";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { toast } from "@/lib/toast-with-sound";

// ==================== 评论动态 Tab ====================

function VideoCommentsTab({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const { data, isLoading } = trpc.comment.listRecent.useQuery({ limit: 20, page });
  const comments = data?.comments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{totalCount > 0 ? `共 ${totalCount} 条评论` : "暂无评论"}</p>
      {isLoading ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <EmptyState icon={Play} message="暂无视频评论" sub="去视频下方发表第一条评论吧" />
      ) : (
        <>
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              type="video"
              targetTitle={comment.video.title}
              targetHref={`/video/${comment.video.id}`}
            />
          ))}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} className="mt-4" />
        </>
      )}
    </div>
  );
}

function GameCommentsTab({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const { data, isLoading } = trpc.gameComment.listRecent.useQuery({ limit: 20, page });
  const comments = data?.comments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{totalCount > 0 ? `共 ${totalCount} 条评论` : "暂无评论"}</p>
      {isLoading ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <EmptyState icon={Gamepad2} message="暂无游戏评论" sub="去游戏页面发表评论吧" />
      ) : (
        <>
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              type="game"
              targetTitle={comment.game.title}
              targetHref={`/game/${comment.game.id}`}
            />
          ))}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} className="mt-4" />
        </>
      )}
    </div>
  );
}

function ImageCommentsTab({ page, onPageChange }: { page: number; onPageChange: (p: number) => void }) {
  const { data, isLoading } = trpc.imagePostComment.listRecent.useQuery({ limit: 20, page });
  const comments = data?.comments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{totalCount > 0 ? `共 ${totalCount} 条评论` : "暂无评论"}</p>
      {isLoading ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <EmptyState icon={ImageIcon} message="暂无图片评论" sub="去图片页面发表评论吧" />
      ) : (
        <>
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              type="image"
              targetTitle={comment.imagePost.title}
              targetHref={`/image/${comment.imagePost.id}`}
            />
          ))}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} className="mt-4" />
        </>
      )}
    </div>
  );
}

// ==================== 公共组件 ====================

const TYPE_CONFIG = {
  video: { icon: Play, label: "视频", color: "text-blue-500" },
  game: { icon: Gamepad2, label: "游戏", color: "text-emerald-500" },
  image: { icon: ImageIcon, label: "图片", color: "text-purple-500" },
} as const;

function CommentCard({
  comment,
  type,
  targetTitle,
  targetHref,
}: {
  comment: {
    id: string;
    content: string;
    createdAt: Date;
    user?: { id: string; username: string; nickname: string | null; avatar: string | null; role: string } | null;
    guestName?: string | null;
    guestEmail?: string | null;
  };
  type: keyof typeof TYPE_CONFIG;
  targetTitle: string;
  targetHref: string;
}) {
  const isGuest = !comment.user;
  const displayName = isGuest
    ? (comment as unknown as { guestName?: string }).guestName || "访客"
    : comment.user!.nickname || comment.user!.username;
  const guestEmail = (comment as unknown as { guestEmail?: string }).guestEmail;
  const avatarUrl =
    isGuest && guestEmail
      ? `https://www.gravatar.com/avatar/${encodeURIComponent(guestEmail.toLowerCase().trim())}?d=identicon&s=80`
      : comment.user?.avatar || undefined;

  const config = TYPE_CONFIG[type];
  const TypeIcon = config.icon;

  return (
    <Link
      href={targetHref}
      className="flex gap-3 p-3 rounded-xl border border-transparent hover:border-border/50 bg-muted/30 hover:bg-muted/50 transition-all group"
    >
      <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="text-xs">
          {isGuest ? <User className="h-4 w-4" /> : displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
          <span className="font-medium text-foreground">{displayName}</span>
          {comment.user?.role === "OWNER" && (
            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
              站长
            </span>
          )}
          {comment.user?.role === "ADMIN" && (
            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
              管理员
            </span>
          )}
          <span>评论了</span>
          <span className="inline-flex items-center gap-0.5">
            <TypeIcon className={`h-3 w-3 ${config.color}`} />
            <span className="text-primary truncate max-w-[180px]">{targetTitle}</span>
          </span>
          <span className="ml-auto shrink-0">{formatRelativeTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm line-clamp-2 text-foreground/80">{comment.content}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function CommentsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl bg-muted/30">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  sub: string;
}) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-12 w-12 mx-auto mb-3 opacity-40" />
      <p className="font-medium">{message}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}

// ==================== 留言板 ====================

function GuestbookSection() {
  const { data: session } = useSession();
  const redirectOpts = useRedirectOptions();
  const isMounted = useIsMounted();
  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestWebsite, setGuestWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const deviceInfoRef = useRef<DeviceInfo | null>(null);
  const { getVisitorId } = useFingerprint();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = trpc.guestbook.list.useInfiniteQuery(
    { limit: 15 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];

  const createMutation = trpc.guestbook.create.useMutation({
    onSuccess: () => {
      setContent("");
      utils.guestbook.list.invalidate();
      toast.success("留言成功！");
    },
    onError: (err) => {
      toast.error(err.message);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isSubmitting) return;

    if (!session && !guestName.trim()) {
      toast.error("请填写昵称");
      return;
    }

    setIsSubmitting(true);

    let currentDeviceInfo = deviceInfoRef.current;
    if (!currentDeviceInfo || currentDeviceInfo.osVersion === "10.15.7") {
      const baseInfo = parseDeviceInfo(navigator.userAgent, {
        platform: navigator.platform || null,
        language: navigator.language || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        screen: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio || null,
      });
      const highEntropyInfo = await getHighEntropyDeviceInfo();
      currentDeviceInfo = mergeDeviceInfo(baseInfo, highEntropyInfo);
      deviceInfoRef.current = currentDeviceInfo;
    }

    const visitorId = await getVisitorId().catch(() => undefined);

    createMutation.mutate({
      content: content.trim(),
      guestName: session ? undefined : guestName.trim() || undefined,
      guestEmail: session ? undefined : guestEmail.trim() || undefined,
      guestWebsite: session ? undefined : guestWebsite.trim() || undefined,
      deviceInfo: currentDeviceInfo ? { ...currentDeviceInfo, visitorId: visitorId ?? null } : undefined,
    });
  }, [content, isSubmitting, session, guestName, guestEmail, guestWebsite, getVisitorId, createMutation]);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          留言板
        </CardTitle>
        <CardDescription>有什么想说的？在这里留下你的足迹吧</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 留言表单 */}
        <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <Textarea
            ref={textareaRef}
            placeholder={isMounted && session ? "写下你的留言..." : "说点什么吧..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px] resize-none bg-background"
            maxLength={500}
          />

          {isMounted && !session && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" />
                  昵称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="你的昵称"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={50}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  邮箱
                </Label>
                <Input
                  placeholder="your@email.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  type="email"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  网址
                </Label>
                <Input
                  placeholder="https://..."
                  value={guestWebsite}
                  onChange={(e) => setGuestWebsite(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.length}/500</span>
            <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || isSubmitting} className="gap-1.5">
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              发送留言
            </Button>
          </div>
        </div>

        {/* 留言列表 */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : allMessages.length === 0 ? (
            <EmptyState icon={BookOpen} message="还没有留言" sub="成为第一个留言的人吧！" />
          ) : (
            <>
              {allMessages.map((msg) => {
                const isGuest = !msg.user;
                const displayName = isGuest ? msg.guestName || "访客" : msg.user!.nickname || msg.user!.username;
                const gEmail = msg.guestEmail;
                const avatarUrl =
                  isGuest && gEmail
                    ? `https://www.gravatar.com/avatar/${encodeURIComponent(gEmail.toLowerCase().trim())}?d=identicon&s=80`
                    : msg.user?.avatar || undefined;

                return (
                  <div key={msg.id} className="flex gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {isGuest ? <User className="h-4 w-4" /> : displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{displayName}</span>
                        {msg.user?.role === "OWNER" && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                            站长
                          </span>
                        )}
                        {msg.user?.role === "ADMIN" && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                            管理员
                          </span>
                        )}
                        {msg.guestWebsite && (
                          <a
                            href={getRedirectUrl(msg.guestWebsite, redirectOpts)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="h-3 w-3" />
                          </a>
                        )}
                        <span className="ml-auto shrink-0">{formatRelativeTime(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </div>
                );
              })}

              {hasNextPage && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="text-muted-foreground"
                  >
                    {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    加载更多留言
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== 主页面 ====================

export default function CommentsClient({ page, tab }: { page: number; tab?: string }) {
  const siteConfig = useSiteConfig();
  const router = useRouter();

  const videoEnabled = siteConfig?.sectionVideoEnabled !== false;
  const imageEnabled = siteConfig?.sectionImageEnabled !== false;
  const gameEnabled = siteConfig?.sectionGameEnabled !== false;

  const tabs = useMemo(
    () =>
      [
        videoEnabled && { id: "video", label: "视频评论", icon: Play },
        gameEnabled && { id: "game", label: "游戏评论", icon: Gamepad2 },
        imageEnabled && { id: "image", label: "图片评论", icon: ImageIcon },
      ].filter(Boolean) as { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[],
    [videoEnabled, gameEnabled, imageEnabled],
  );

  const defaultTab = tabs[0]?.id ?? "video";
  const activeTab = tab && tabs.some((t) => t.id === tab) ? tab : defaultTab;

  const handleTabChange = useCallback(
    (newTab: string) => {
      const tabParam = newTab !== defaultTab ? `?tab=${newTab}` : "";
      router.push(`/comments${tabParam}`);
    },
    [defaultTab, router],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const tabParam = activeTab !== defaultTab ? `?tab=${activeTab}` : "";
      const base = newPage === 1 ? "/comments" : `/comments/page/${newPage}`;
      router.push(`${base}${tabParam}`);
    },
    [activeTab, defaultTab, router],
  );

  return (
    <div className="container py-6 max-w-3xl">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">评论动态</h1>
          <p className="text-sm text-muted-foreground">查看全站最新评论与留言</p>
        </div>
      </div>

      {/* 评论 Tabs */}
      <Card>
        <CardContent className="pt-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {videoEnabled && (
              <TabsContent value="video">
                <VideoCommentsTab page={page} onPageChange={handlePageChange} />
              </TabsContent>
            )}
            {gameEnabled && (
              <TabsContent value="game">
                <GameCommentsTab page={page} onPageChange={handlePageChange} />
              </TabsContent>
            )}
            {imageEnabled && (
              <TabsContent value="image">
                <ImageCommentsTab page={page} onPageChange={handlePageChange} />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* 留言板 */}
      <GuestbookSection />
    </div>
  );
}
