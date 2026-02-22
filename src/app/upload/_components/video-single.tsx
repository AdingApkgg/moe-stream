"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/video/video-player";
import { videoUploadSchema, type VideoUploadForm } from "../_lib/schemas";
import { TagPicker } from "./tag-picker";
import { CoverInput } from "./cover-input";
import type { TagItem } from "../_lib/types";
import type { VideoExtraInfo } from "@/lib/shortcode-parser";
import {
  ChevronDown, Download, Eye, EyeOff, FileVideo, Info,
  Layers, Link2, ListVideo, Loader2, Plus, Trash2, Upload, User,
} from "lucide-react";

export function VideoSingleUpload() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [episodeNum, setEpisodeNum] = useState(1);
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [extraInfo, setExtraInfo] = useState<VideoExtraInfo>({});
  const [showExtraInfo, setShowExtraInfo] = useState(false);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 });
  const { data: userSeries, refetch: refetchSeries } = trpc.series.listByUser.useQuery({ limit: 50 });

  const createSeriesMutation = trpc.series.create.useMutation({
    onSuccess: (s) => {
      setSelectedSeriesId(s.id);
      setShowCreateSeries(false);
      setNewSeriesTitle("");
      refetchSeries();
      toast.success("合集创建成功");
    },
    onError: (e) => toast.error("创建合集失败", { description: e.message }),
  });
  const addToSeriesMutation = trpc.series.addVideo.useMutation();
  const createMutation = trpc.video.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const form = useForm<VideoUploadForm>({
    resolver: zodResolver(videoUploadSchema),
    defaultValues: { title: "", description: "", coverUrl: "", videoUrl: "" },
  });

  const coverUrl = form.watch("coverUrl");
  const videoUrl = form.watch("videoUrl");

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find(t => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const hasExtraInfo = () =>
    extraInfo.intro || extraInfo.author || extraInfo.authorIntro ||
    (extraInfo.keywords?.length ?? 0) > 0 || (extraInfo.downloads?.length ?? 0) > 0 ||
    (extraInfo.episodes?.length ?? 0) > 0 || (extraInfo.relatedVideos?.length ?? 0) > 0 ||
    (extraInfo.notices?.length ?? 0) > 0;

  const onSubmit = async (data: VideoUploadForm) => {
    setIsLoading(true);
    try {
      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl || "",
        videoUrl: data.videoUrl,
        tagIds: selectedTags.map(t => t.id),
        tagNames: newTags,
        ...(hasExtraInfo() ? { extraInfo } : {}),
      });

      if (selectedSeriesId) {
        try {
          await addToSeriesMutation.mutateAsync({ seriesId: selectedSeriesId, videoId: result.id, episodeNum });
        } catch (error) {
          console.error("添加到合集失败:", error);
        }
      }

      toast.success("发布成功");
      router.push(`/video/${result.id}`);
    } catch {
      // onError 已处理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileVideo className="h-5 w-5" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题 *</FormLabel>
                    <FormControl><Input placeholder="输入视频标题" {...field} className="text-base" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="videoUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>视频链接 *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <div className="relative flex-1">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="https://example.com/video.mp4" {...field} className="pl-9" />
                        </div>
                      </FormControl>
                      <Button type="button" variant={showPreview ? "default" : "outline"} size="icon" onClick={() => setShowPreview(!showPreview)} disabled={!field.value}>
                        {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <FormDescription>支持 MP4, WebM, HLS (m3u8) 格式</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {showPreview && videoUrl && (
                  <div className="rounded-lg overflow-hidden border bg-black">
                    <VideoPlayer url={videoUrl} poster={coverUrl || undefined} autoStart={false} />
                  </div>
                )}

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>简介</FormLabel>
                    <FormControl>
                      <Textarea placeholder="视频简介（可选）" className="min-h-[100px] resize-none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* 标签 */}
            <TagPicker
              allTags={allTags}
              selectedTags={selectedTags}
              newTags={newTags}
              onToggleTag={toggleTag}
              onAddNewTag={(name) => setNewTags([...newTags, name])}
              onRemoveNewTag={(name) => setNewTags(newTags.filter(t => t !== name))}
            />

            {/* 扩展信息 */}
            <Collapsible open={showExtraInfo} onOpenChange={setShowExtraInfo}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        扩展信息
                        {hasExtraInfo() && <Badge variant="secondary" className="text-xs">已填写</Badge>}
                      </CardTitle>
                      <ChevronDown className={cn("h-5 w-5 transition-transform", showExtraInfo && "rotate-180")} />
                    </div>
                    <CardDescription>添加作品介绍、作者信息、下载链接等（可选）</CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <Tabs defaultValue="intro" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="intro" className="text-xs">作品介绍</TabsTrigger>
                        <TabsTrigger value="author" className="text-xs">作者信息</TabsTrigger>
                        <TabsTrigger value="downloads" className="text-xs">下载链接</TabsTrigger>
                        <TabsTrigger value="related" className="text-xs">相关内容</TabsTrigger>
                      </TabsList>

                      <TabsContent value="intro" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <FormLabel>作品介绍</FormLabel>
                          <Textarea placeholder="详细的作品介绍..." value={extraInfo.intro || ""} onChange={(e) => setExtraInfo({ ...extraInfo, intro: e.target.value })} className="min-h-[100px]" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>剧集介绍</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={() => setExtraInfo({ ...extraInfo, episodes: [...(extraInfo.episodes || []), { title: "", content: "" }] })}>
                              <Plus className="h-4 w-4 mr-1" />添加剧集
                            </Button>
                          </div>
                          {extraInfo.episodes?.map((ep, i) => (
                            <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                              <div className="flex-1 space-y-2">
                                <Input placeholder={`第 ${i + 1} 集标题`} value={ep.title} onChange={(e) => { const eps = [...(extraInfo.episodes || [])]; eps[i] = { ...eps[i], title: e.target.value }; setExtraInfo({ ...extraInfo, episodes: eps }); }} />
                                <Textarea placeholder="剧集介绍..." value={ep.content} onChange={(e) => { const eps = [...(extraInfo.episodes || [])]; eps[i] = { ...eps[i], content: e.target.value }; setExtraInfo({ ...extraInfo, episodes: eps }); }} className="min-h-[60px]" />
                              </div>
                              <Button type="button" variant="ghost" size="icon" onClick={() => setExtraInfo({ ...extraInfo, episodes: extraInfo.episodes?.filter((_, j) => j !== i) })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="author" className="space-y-4 mt-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <FormLabel className="flex items-center gap-2"><User className="h-4 w-4" />原作者</FormLabel>
                            <Input placeholder="原作者名称" value={extraInfo.author || ""} onChange={(e) => setExtraInfo({ ...extraInfo, author: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <FormLabel>作者介绍</FormLabel>
                          <Textarea placeholder="作者介绍..." value={extraInfo.authorIntro || ""} onChange={(e) => setExtraInfo({ ...extraInfo, authorIntro: e.target.value })} className="min-h-[80px]" />
                        </div>
                        <div className="space-y-2">
                          <FormLabel>搜索关键词</FormLabel>
                          <Input placeholder="用逗号分隔多个关键词" value={extraInfo.keywords?.join(", ") || ""} onChange={(e) => setExtraInfo({ ...extraInfo, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })} />
                          <p className="text-xs text-muted-foreground">帮助用户找到这个视频的关键词</p>
                        </div>
                      </TabsContent>

                      <TabsContent value="downloads" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2"><Download className="h-4 w-4" />下载链接</FormLabel>
                          <Button type="button" variant="outline" size="sm" onClick={() => setExtraInfo({ ...extraInfo, downloads: [...(extraInfo.downloads || []), { name: "", url: "", password: "" }] })}>
                            <Plus className="h-4 w-4 mr-1" />添加链接
                          </Button>
                        </div>
                        {extraInfo.downloads?.map((dl, i) => (
                          <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                            <div className="flex-1 grid gap-2 md:grid-cols-3">
                              <Input placeholder="网盘名称" value={dl.name} onChange={(e) => { const dls = [...(extraInfo.downloads || [])]; dls[i] = { ...dls[i], name: e.target.value }; setExtraInfo({ ...extraInfo, downloads: dls }); }} />
                              <Input placeholder="下载链接" value={dl.url} onChange={(e) => { const dls = [...(extraInfo.downloads || [])]; dls[i] = { ...dls[i], url: e.target.value }; setExtraInfo({ ...extraInfo, downloads: dls }); }} />
                              <Input placeholder="提取码（可选）" value={dl.password || ""} onChange={(e) => { const dls = [...(extraInfo.downloads || [])]; dls[i] = { ...dls[i], password: e.target.value }; setExtraInfo({ ...extraInfo, downloads: dls }); }} />
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setExtraInfo({ ...extraInfo, downloads: extraInfo.downloads?.filter((_, j) => j !== i) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {(!extraInfo.downloads || extraInfo.downloads.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">暂无下载链接，点击上方按钮添加</p>
                        )}
                      </TabsContent>

                      <TabsContent value="related" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2"><ListVideo className="h-4 w-4" />相关视频</FormLabel>
                          <Button type="button" variant="outline" size="sm" onClick={() => setExtraInfo({ ...extraInfo, relatedVideos: [...(extraInfo.relatedVideos || []), ""] })}>
                            <Plus className="h-4 w-4 mr-1" />添加
                          </Button>
                        </div>
                        {extraInfo.relatedVideos?.map((v, i) => (
                          <div key={i} className="flex gap-2">
                            <Input placeholder="相关视频标题" value={v} onChange={(e) => { const rv = [...(extraInfo.relatedVideos || [])]; rv[i] = e.target.value; setExtraInfo({ ...extraInfo, relatedVideos: rv }); }} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => setExtraInfo({ ...extraInfo, relatedVideos: extraInfo.relatedVideos?.filter((_, j) => j !== i) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* 右侧 */}
          <div className="space-y-6">
            <CoverInput form={form} watchValue={coverUrl} />

            {/* 合集 */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5" />合集</CardTitle>
                  {selectedSeriesId && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedSeriesId(null); setEpisodeNum(1); }}>取消</Button>
                  )}
                </div>
                <CardDescription>将视频添加到合集（可选）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showCreateSeries ? (
                  <>
                    <Select value={selectedSeriesId || ""} onValueChange={(v) => { setSelectedSeriesId(v || null); const s = userSeries?.items.find(x => x.id === v); if (s) setEpisodeNum(s.episodeCount + 1); }}>
                      <SelectTrigger><SelectValue placeholder="选择合集..." /></SelectTrigger>
                      <SelectContent>
                        {userSeries?.items.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                              <span>{s.title}</span>
                              <Badge variant="secondary" className="text-xs">{s.episodeCount}集</Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {(!userSeries?.items || userSeries.items.length === 0) && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无合集</div>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedSeriesId && (
                      <div className="flex items-center gap-2">
                        <FormLabel className="shrink-0">第</FormLabel>
                        <Input type="number" min={1} value={episodeNum} onChange={(e) => setEpisodeNum(parseInt(e.target.value) || 1)} className="w-20" />
                        <FormLabel className="shrink-0">集</FormLabel>
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateSeries(true)} className="w-full">
                      <Plus className="h-4 w-4 mr-1" />创建新合集
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <Input placeholder="合集名称" value={newSeriesTitle} onChange={(e) => setNewSeriesTitle(e.target.value)} />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setShowCreateSeries(false); setNewSeriesTitle(""); }}>取消</Button>
                      <Button type="button" size="sm" className="flex-1" disabled={!newSeriesTitle.trim() || createSeriesMutation.isPending} onClick={() => { if (newSeriesTitle.trim()) createSeriesMutation.mutate({ title: newSeriesTitle.trim() }); }}>
                        {createSeriesMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                        创建
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading} size="lg">
              {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />发布中...</> : <><Upload className="mr-2 h-5 w-5" />发布视频</>}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
