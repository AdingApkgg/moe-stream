"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { notFound, useRouter } from "next/navigation";
import { useSiteConfig } from "@/contexts/site-config";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ImageForm, type ImageSubmitData } from "@/components/image/image-form";
import type { TagItem } from "@/lib/schemas/content";

interface EditImagePageProps {
  params: Promise<{ id: string }>;
}

export default function EditImagePage({ params }: EditImagePageProps) {
  const siteConfig = useSiteConfig();
  if (siteConfig && !siteConfig.sectionImageEnabled) notFound();
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: post, isLoading: postLoading } = trpc.image.getForEdit.useQuery({ id }, { enabled: !!session });

  const updateMutation = trpc.image.update.useMutation({
    onError: (error) => toast.error("更新失败", { description: error.message }),
  });

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login?callbackUrl=/image/edit/" + id);
    }
  }, [authStatus, router, id]);

  const initialData = useMemo(() => {
    if (!post) return undefined;
    return {
      title: post.title,
      description: post.description || "",
      isNsfw: post.isNsfw ?? false,
      tags: post.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })) as TagItem[],
      imageUrls: (post.images as string[]) ?? [],
    };
  }, [post]);

  const handleSubmit = async (data: ImageSubmitData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id,
        title: data.title,
        description: data.description,
        images: data.images,
        isNsfw: data.isNsfw,
        tagIds: data.tagIds,
        tagNames: data.tagNames,
      });
      toast.success("更新成功");
      router.push(`/image/${id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authStatus === "loading" || postLoading) {
    return (
      <div className="container py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[300px] w-full rounded-lg" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!session || !post) return null;

  if (!session.user.canUpload) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">暂无编辑权限</h1>
        <p className="text-muted-foreground text-center max-w-md">您的账号暂未开通投稿功能，无法编辑图片帖</p>
        <Button asChild variant="outline">
          <Link href="/image">返回图片列表</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/image/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">编辑图片帖</h1>
          <p className="text-sm text-muted-foreground">ID: {id}</p>
        </div>
      </div>

      <ImageForm
        mode="edit"
        initialData={initialData}
        contentId={id}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
