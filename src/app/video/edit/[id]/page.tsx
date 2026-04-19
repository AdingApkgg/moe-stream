"use client";

import { use, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { notFound, useRouter } from "next/navigation";
import { useSiteConfig } from "@/contexts/site-config";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-with-sound";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VideoForm, type VideoSubmitData, type SeriesData, type SeriesItem } from "@/components/video/video-form";
import type { TagItem } from "@/lib/schemas/content";

interface EditVideoPageProps {
  params: Promise<{ id: string }>;
}

export default function EditVideoPage({ params }: EditVideoPageProps) {
  const siteConfig = useSiteConfig();
  if (siteConfig && !siteConfig.sectionVideoEnabled) notFound();
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalSeriesId, setOriginalSeriesId] = useState<string | null>(null);
  const [initialSeriesData, setInitialSeriesData] = useState<{ seriesId: string; episodeNum: number } | undefined>();

  const { data: video, isLoading: videoLoading } = trpc.video.getForEdit.useQuery(
    { id },
    {
      enabled: !!session,
      // 编辑过程中关闭自动 refetch，防止窗口聚焦时把用户未保存的输入冲掉
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    },
  );
  const { data: userSeries, refetch: refetchSeries } = trpc.series.listByUser.useQuery(
    { limit: 50 },
    { enabled: !!session },
  );
  const { data: videoSeries } = trpc.series.getByVideoId.useQuery(
    { videoId: id },
    {
      enabled: !!session,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
    },
  );

  const createSeriesMutation = trpc.series.create.useMutation({
    onSuccess: () => {
      refetchSeries();
      toast.success("合集创建成功");
    },
    onError: (error) => toast.error("创建合集失败", { description: error.message }),
  });

  const updateMutation = trpc.video.update.useMutation({
    onError: (error) => toast.error("更新失败", { description: error.message }),
  });

  const addToSeriesMutation = trpc.series.addVideo.useMutation();
  const removeFromSeriesMutation = trpc.series.removeVideo.useMutation();

  useEffect(() => {
    if (videoSeries) {
      setOriginalSeriesId(videoSeries.series.id);
      setInitialSeriesData({
        seriesId: videoSeries.series.id,
        episodeNum: videoSeries.currentEpisode,
      });
    }
  }, [videoSeries]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login?callbackUrl=/video/edit/" + id);
    }
  }, [authStatus, router, id]);

  const initialData = video
    ? {
        title: video.title,
        description: video.description || "",
        coverUrl: video.coverUrl || "",
        videoUrl: video.videoUrl,
        isNsfw: video.isNsfw ?? false,
        tags: video.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })) as TagItem[],
        extraInfo:
          video.extraInfo && typeof video.extraInfo === "object" && !Array.isArray(video.extraInfo)
            ? (video.extraInfo as Parameters<typeof VideoForm>[0]["initialData"] extends { extraInfo?: infer E }
                ? E
                : never)
            : undefined,
      }
    : undefined;

  const seriesOptions: SeriesItem[] =
    userSeries?.items.map((s) => ({
      id: s.id,
      title: s.title,
      episodeCount: s.episodeCount,
    })) || [];

  const handleSubmit = async (data: VideoSubmitData, seriesData?: SeriesData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id,
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        videoUrl: data.videoUrl,
        isNsfw: data.isNsfw,
        tagIds: data.tagIds,
        tagNames: data.tagNames,
        extraInfo: data.extraInfo,
      });

      if (seriesData) {
        const { seriesId, episodeNum } = seriesData;
        if (seriesId !== originalSeriesId) {
          if (originalSeriesId) {
            try {
              await removeFromSeriesMutation.mutateAsync({ seriesId: originalSeriesId, videoId: id });
            } catch (error) {
              console.error("移除合集失败:", error);
            }
          }
          if (seriesId) {
            try {
              await addToSeriesMutation.mutateAsync({ seriesId, videoId: id, episodeNum });
            } catch (error) {
              console.error("添加到合集失败:", error);
            }
          }
        } else if (seriesId && videoSeries && episodeNum !== videoSeries.currentEpisode) {
          try {
            await removeFromSeriesMutation.mutateAsync({ seriesId, videoId: id });
            await addToSeriesMutation.mutateAsync({ seriesId, videoId: id, episodeNum });
          } catch (error) {
            console.error("更新集数失败:", error);
          }
        }
      }

      toast.success("视频更新成功");
      router.push(`/video/${id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSeries = async (title: string) => {
    const result = await createSeriesMutation.mutateAsync({ title });
    return { id: result.id };
  };

  if (authStatus === "loading" || videoLoading) {
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

  if (!session || !video) return null;

  if (!session.user.canUpload) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">暂无编辑权限</h1>
        <p className="text-muted-foreground text-center max-w-md">您的账号暂未开通投稿功能，无法编辑视频</p>
        <Button asChild variant="outline">
          <Link href="/my-works">返回我的作品</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/video/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">编辑视频</h1>
          <p className="text-sm text-muted-foreground">ID: {id}</p>
        </div>
      </div>

      <VideoForm
        mode="edit"
        initialData={initialData}
        videoId={id}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        seriesOptions={seriesOptions}
        initialSeries={initialSeriesData}
        onCreateSeries={handleCreateSeries}
      />
    </div>
  );
}
