"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { ImageForm, type ImageSubmitData } from "@/components/image/image-form";

export function ImageSingleUpload() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const createMutation = trpc.image.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const handleSubmit = async (data: ImageSubmitData) => {
    setIsLoading(true);
    try {
      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        images: data.images,
        isNsfw: data.isNsfw,
        tagIds: data.tagIds,
        tagNames: data.tagNames,
      });
      toast.success(result.status === "PUBLISHED" ? "发布成功" : "提交成功，等待审核");
      router.push(`/image/${result.id}`);
    } catch {
      // onError 已处理
    } finally {
      setIsLoading(false);
    }
  };

  return <ImageForm mode="create" onSubmit={handleSubmit} isSubmitting={isLoading} />;
}
