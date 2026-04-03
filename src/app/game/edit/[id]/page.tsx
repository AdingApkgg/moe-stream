"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { notFound, useRouter } from "next/navigation";
import { useSiteConfig } from "@/contexts/site-config";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  GameForm,
  type GameSubmitData,
  type GameExtraInfo,
  type GameVersion,
  type GameCustomTab,
} from "@/components/game/game-form";
import type { TagItem } from "@/lib/schemas/content";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditGamePage({ params }: Props) {
  const siteConfig = useSiteConfig();
  if (siteConfig && !siteConfig.sectionGameEnabled) notFound();
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const authLoading = authStatus === "loading";
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: game, isLoading: gameLoading } = trpc.game.getEditData.useQuery({ id }, { enabled: !!session });

  const updateMutation = trpc.game.update.useMutation({
    onError: (error) => toast.error("更新失败", { description: error.message }),
  });

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?callbackUrl=/game/edit/${id}`);
    }
  }, [authLoading, session, router, id]);

  const initialData = useMemo(() => {
    if (!game) return undefined;

    const extra = (game.extraInfo || {}) as Record<string, unknown>;
    const extraInfo: GameExtraInfo = {
      originalName: (extra.originalName as string) || undefined,
      originalAuthor: (extra.originalAuthor as string) || undefined,
      originalAuthorUrl: (extra.originalAuthorUrl as string) || undefined,
      fileSize: (extra.fileSize as string) || undefined,
      platforms: (extra.platforms as string[]) || undefined,
      screenshots: (extra.screenshots as string[]) || undefined,
      videos: (extra.videos as string[]) || undefined,
      downloads: (extra.downloads as { name: string; url: string; password?: string }[]) || undefined,
    };

    const gameVersions: GameVersion[] =
      game.versions?.map((v: { id: string; label: string; description: string | null }) => ({
        id: v.id,
        label: v.label,
        description: v.description || "",
      })) || [];

    const gameCustomTabs: GameCustomTab[] =
      game.customTabs?.map((t: { id: string; title: string; icon: string | null; content: string }) => ({
        id: t.id,
        title: t.title,
        icon: t.icon || "file-text",
        content: t.content,
      })) || [];

    return {
      title: game.title,
      description: game.description || "",
      coverUrl: game.coverUrl || "",
      gameType: game.gameType || "",
      version: game.version || "",
      isFree: game.isFree,
      isNsfw: game.isNsfw ?? false,
      tags:
        (game.tags?.map((t: { tag: { id: string; name: string } }) => ({
          id: t.tag.id,
          name: t.tag.name,
        })) as TagItem[]) || [],
      extraInfo,
      versions: gameVersions,
      customTabs: gameCustomTabs,
    };
  }, [game]);

  const handleSubmit = async (data: GameSubmitData) => {
    setIsSubmitting(true);
    try {
      const tagNames = [...data.existingTagNames, ...data.tagNames];

      await updateMutation.mutateAsync({
        gameId: id,
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        gameType: data.gameType,
        isFree: data.isFree,
        isNsfw: data.isNsfw,
        version: data.version,
        extraInfo: data.extraInfo,
        tagNames: tagNames.length > 0 ? tagNames : undefined,
        versions: data.versions || [],
        customTabs: data.customTabs || [],
      });
      toast.success("游戏更新成功");
      router.push(`/game/${id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (gameLoading || authLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!session) return null;

  if (!game) {
    return <div className="container max-w-5xl mx-auto py-8 px-4 text-center text-muted-foreground">游戏不存在</div>;
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/game/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">编辑游戏</h1>
          <p className="text-sm text-muted-foreground">{game.title}</p>
        </div>
      </div>

      <GameForm
        mode="edit"
        initialData={initialData}
        gameId={id}
        tagQueryType="game"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
