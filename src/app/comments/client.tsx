"use client";

import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Play, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import { Pagination } from "@/components/ui/pagination";

export default function CommentsClient({ page }: { page: number }) {
  const { data, isLoading } = trpc.comment.listRecent.useQuery(
    { limit: 20, page }
  );

  const comments = data?.comments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="container py-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">评论动态</h1>
          <p className="text-sm text-muted-foreground">
            来自视频的最新评论
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            全站评论动态
          </CardTitle>
          <CardDescription>
            {totalCount > 0 ? `共 ${totalCount} 条评论` : "查看最新评论"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))
            ) : comments.length === 0 && page === 1 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无评论</p>
                <p className="text-sm mt-1">去视频下方发表第一条评论吧</p>
              </div>
            ) : (
              <>
                {comments.map((comment) => {
                  const isGuest = !comment.user;
                  const displayName = isGuest
                    ? ((comment as unknown as { guestName?: string }).guestName || "访客")
                    : (comment.user!.nickname || comment.user!.username);
                  const guestEmail = (comment as unknown as { guestEmail?: string }).guestEmail;
                  const avatarUrl = isGuest && guestEmail
                    ? `https://www.gravatar.com/avatar/${encodeURIComponent(guestEmail.toLowerCase().trim())}?d=identicon&s=80`
                    : (comment.user?.avatar || undefined);

                  return (
                    <Link
                      key={comment.id}
                      href={`/video/${comment.video.id}`}
                      className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="text-xs">
                          {isGuest ? <User className="h-4 w-4" /> : displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span className="font-medium text-foreground">
                            {displayName}
                          </span>
                          {comment.user?.role === "OWNER" && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded font-medium">
                              站长
                            </span>
                          )}
                          {comment.user?.role === "ADMIN" && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded font-medium">
                              管理员
                            </span>
                          )}
                          <span>评论了</span>
                          <span className="text-primary truncate max-w-[150px]">
                            {comment.video.title}
                          </span>
                          <span className="ml-auto shrink-0">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">{comment.content}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })}

                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  basePath="/comments"
                  className="mt-6"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
