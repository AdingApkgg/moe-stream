"use client";

import Link from "next/link";
import { Heart, MessageSquare, UserMinus, UserPlus, Users } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { StatItem } from "./stat-item";

export function FollowButton({ userId }: { userId: string }) {
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const enabled = !!session?.user;
  const { data: isFollowing, isLoading } = trpc.follow.isFollowing.useQuery({ userId }, { enabled });

  const followMutation = trpc.follow.follow.useMutation({
    onSuccess: () => {
      utils.follow.isFollowing.invalidate({ userId });
      utils.follow.counts.invalidate({ userId });
    },
  });

  const unfollowMutation = trpc.follow.unfollow.useMutation({
    onSuccess: () => {
      utils.follow.isFollowing.invalidate({ userId });
      utils.follow.counts.invalidate({ userId });
    },
  });

  if (!session?.user) {
    return (
      <Button asChild variant="default" size="sm" className="gap-1.5 shrink-0">
        <Link href="/login">
          <UserPlus className="h-3.5 w-3.5" />
          关注
        </Link>
      </Button>
    );
  }

  // 加载关注状态时禁用按钮，避免初始状态闪烁（先显示"关注"再变"已关注"）
  if (isLoading || isFollowing === undefined) {
    return (
      <Button variant="default" size="sm" className="gap-1.5 shrink-0" disabled>
        <UserPlus className="h-3.5 w-3.5" />
        关注
      </Button>
    );
  }

  const pending = followMutation.isPending || unfollowMutation.isPending;

  if (isFollowing) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={pending}
          onClick={() => unfollowMutation.mutate({ userId })}
        >
          <UserMinus className="h-3.5 w-3.5" />
          已关注
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link href={`/messages?user=${userId}`}>
            <MessageSquare className="h-3.5 w-3.5" />
            私信
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      className="gap-1.5 shrink-0"
      disabled={pending}
      onClick={() => followMutation.mutate({ userId })}
    >
      <UserPlus className="h-3.5 w-3.5" />
      关注
    </Button>
  );
}

export function FollowCounts({ userId }: { userId: string }) {
  const { data: counts } = trpc.follow.counts.useQuery({ userId });
  if (!counts) return null;
  return (
    <>
      <StatItem icon={Users} label="粉丝" value={counts.followers} />
      <StatItem icon={Heart} label="关注" value={counts.following} />
    </>
  );
}
