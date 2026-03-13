"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useStableSession } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hash, Plus, Users, MessageSquare, Lock, Loader2 } from "lucide-react";
import Link from "next/link";

export default function ChannelsPage() {
  const { session } = useStableSession();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  const { data, isLoading } = trpc.channel.list.useQuery({ limit: 50 });
  const utils = trpc.useUtils();

  const createMutation = trpc.channel.create.useMutation({
    onSuccess: () => {
      setShowCreate(false);
      setName("");
      setSlug("");
      setDescription("");
      setType("PUBLIC");
      utils.channel.list.invalidate();
    },
  });

  const channels = data?.channels ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Hash className="h-6 w-6" />
          <h1 className="text-2xl font-bold">聊天频道</h1>
        </div>

        {session?.user && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                创建频道
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新频道</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">频道名称</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如: 综合讨论"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">频道标识（URL slug）</label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="例如: general"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">描述（可选）</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="简述频道用途"
                    maxLength={500}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">类型</label>
                  <div className="flex gap-2">
                    <Button
                      variant={type === "PUBLIC" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setType("PUBLIC")}
                    >
                      公开
                    </Button>
                    <Button
                      variant={type === "PRIVATE" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setType("PRIVATE")}
                    >
                      <Lock className="h-3.5 w-3.5 mr-1" />
                      私有
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={!name.trim() || !slug.trim() || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({ name, slug, description, type })
                  }
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  创建
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Hash className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>暂无频道</p>
          <p className="text-sm mt-1">创建一个频道开始讨论吧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/channels/${ch.slug}`}
              className="flex items-center gap-4 p-4 bg-card border rounded-xl hover:bg-accent/50 transition-colors"
            >
              <Avatar className="h-11 w-11 shrink-0">
                {ch.avatarUrl ? (
                  <AvatarImage src={ch.avatarUrl} />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    #
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{ch.name}</span>
                  {ch.type === "PRIVATE" && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      <Lock className="h-2.5 w-2.5 mr-0.5" />
                      私有
                    </Badge>
                  )}
                </div>
                {ch.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {ch.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {ch._count.members}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {ch._count.messages}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
