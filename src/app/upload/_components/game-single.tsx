"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { GameForm, type GameSubmitData } from "@/components/game/game-form";

export function GameSingleUpload() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const createMutation = trpc.game.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const handleSubmit = async (data: GameSubmitData) => {
    setIsLoading(true);
    try {
      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        gameType: data.gameType,
        isFree: data.isFree,
        isNsfw: data.isNsfw,
        version: data.version,
        tagIds: data.tagIds,
        tagNames: data.tagNames,
        extraInfo: data.extraInfo,
        versions: data.versions,
        customTabs: data.customTabs,
      });
      toast.success(result.status === "PUBLISHED" ? "发布成功" : "提交成功，等待审核");
      router.push(`/game/${result.id}`);
    } catch {
      // onError 已处理
    } finally {
      setIsLoading(false);
    }
  };

  return <GameForm mode="create" onSubmit={handleSubmit} isSubmitting={isLoading} />;
}
