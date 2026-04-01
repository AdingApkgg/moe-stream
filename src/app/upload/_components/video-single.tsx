"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { VideoForm, type VideoSubmitData } from "@/components/video/video-form";

export function VideoSingleUpload() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const createMutation = trpc.video.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const handleSubmit = async (data: VideoSubmitData) => {
    setIsLoading(true);
    try {
      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl || "",
        videoUrl: data.videoUrl,
        isNsfw: data.isNsfw,
        tagIds: data.tagIds,
        tagNames: data.tagNames,
        ...(data.extraInfo ? { extraInfo: data.extraInfo } : {}),
      });
      toast.success("发布成功");
      router.push(`/video/${result.id}`);
    } catch {
      // onError 已处理
    } finally {
      setIsLoading(false);
    }
  };

  return <VideoForm mode="create" onSubmit={handleSubmit} isSubmitting={isLoading} />;
}
