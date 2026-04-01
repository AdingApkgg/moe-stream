"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { VideoPlayer } from "@/components/video/video-player";
import { videoUploadSchema, type VideoUploadForm } from "../_lib/schemas";
import { TagPicker } from "./tag-picker";
import { CoverInput } from "./cover-input";
import type { TagItem } from "../_lib/types";
import type { VideoExtraInfo } from "@/lib/shortcode-parser";
import { ChevronDown, Download, Eye, EyeOff, Loader2, Plus, Trash2, Upload, User } from "lucide-react";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";
import { cn } from "@/lib/utils";

export function VideoSingleUpload() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [extraInfo, setExtraInfo] = useState<VideoExtraInfo>({});
  const [extraOpen, setExtraOpen] = useState(false);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 }, { staleTime: 10 * 60 * 1000 });
  const { data: usedAuthors } = trpc.user.usedAuthors.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

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
    const exists = selectedTags.find((t) => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const hasExtraInfo = () =>
    extraInfo.author ||
    extraInfo.authorIntro ||
    (extraInfo.downloads?.length ?? 0) > 0 ||
    (extraInfo.notices?.length ?? 0) > 0;

  const extraFilledCount = useMemo(() => {
    let count = 0;
    if (extraInfo.author || extraInfo.authorIntro) count++;
    if (extraInfo.downloads?.length) count++;
    return count;
  }, [extraInfo]);

  const onSubmit = async (data: VideoUploadForm) => {
    setIsLoading(true);
    try {
      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl || "",
        videoUrl: data.videoUrl,
        isNsfw,
        tagIds: selectedTags.map((t) => t.id),
        tagNames: newTags,
        ...(hasExtraInfo() ? { extraInfo } : {}),
      });

      toast.success("发布成功");
      router.push(`/video/${result.id}`);
    } catch {
      // onError 已处理
    } finally {
      setIsLoading(false);
    }
  };

  const submitButton = (
    <Button type="submit" className="w-full h-11" disabled={isLoading} size="lg">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          发布中...
        </>
      ) : (
        <>
          <Upload className="mr-2 h-4 w-4" />
          发布视频
        </>
      )}
    </Button>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          {/* 左侧主内容 */}
          <div className="space-y-5 min-w-0 pb-20 lg:pb-0">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>标题 *</FormLabel>
                      <FormControl>
                        <Input placeholder="输入视频标题" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>视频 *</FormLabel>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <UrlOrUploadInput
                            value={field.value}
                            onChange={field.onChange}
                            accept="video/*,.m3u8"
                            placeholder="https://example.com/video.mp4"
                            contentType="video"
                          />
                        </div>
                        {field.value && (
                          <Button
                            type="button"
                            variant={showPreview ? "default" : "outline"}
                            size="icon"
                            className="mt-0.5 shrink-0"
                            onClick={() => setShowPreview(!showPreview)}
                          >
                            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      <FormDescription>支持 MP4, WebM, HLS (m3u8) 格式</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showPreview && videoUrl && (
                  <div className="rounded-lg overflow-hidden border bg-black">
                    <VideoPlayer url={videoUrl} poster={coverUrl || undefined} autoStart={false} />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>简介</FormLabel>
                      <FormControl>
                        <Textarea placeholder="视频简介（可选）" className="min-h-[80px] resize-y" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 扩展信息 — Collapsible */}
            <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">扩展信息（可选）</CardTitle>
                      <div className="flex items-center gap-2">
                        {extraFilledCount > 0 && (
                          <Badge variant="secondary" className="text-[11px]">
                            已填 {extraFilledCount} 项
                          </Badge>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            extraOpen && "rotate-180",
                          )}
                        />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Tabs defaultValue="author" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="author" className="text-xs">
                          作者信息
                        </TabsTrigger>
                        <TabsTrigger value="downloads" className="text-xs">
                          下载链接
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="author" className="space-y-4 mt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <FormLabel className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              原作者
                            </FormLabel>
                            <Input
                              placeholder="原作者名称"
                              list="used-authors"
                              value={extraInfo.author || ""}
                              onChange={(e) => setExtraInfo({ ...extraInfo, author: e.target.value })}
                            />
                            {usedAuthors && usedAuthors.length > 0 && (
                              <datalist id="used-authors">
                                {usedAuthors.map((a) => (
                                  <option key={a} value={a} />
                                ))}
                              </datalist>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <FormLabel>作者介绍</FormLabel>
                          <Textarea
                            placeholder="作者介绍..."
                            value={extraInfo.authorIntro || ""}
                            onChange={(e) => setExtraInfo({ ...extraInfo, authorIntro: e.target.value })}
                            className="min-h-[80px]"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="downloads" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            下载链接
                          </FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setExtraInfo({
                                ...extraInfo,
                                downloads: [...(extraInfo.downloads || []), { name: "", url: "", password: "" }],
                              })
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            添加链接
                          </Button>
                        </div>
                        {extraInfo.downloads?.map((dl, i) => (
                          <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                            <div className="flex-1 grid gap-2 sm:grid-cols-3">
                              <Input
                                placeholder="网盘名称"
                                value={dl.name}
                                onChange={(e) => {
                                  const dls = [...(extraInfo.downloads || [])];
                                  dls[i] = { ...dls[i], name: e.target.value };
                                  setExtraInfo({ ...extraInfo, downloads: dls });
                                }}
                              />
                              <Input
                                placeholder="下载链接"
                                value={dl.url}
                                onChange={(e) => {
                                  const dls = [...(extraInfo.downloads || [])];
                                  dls[i] = { ...dls[i], url: e.target.value };
                                  setExtraInfo({ ...extraInfo, downloads: dls });
                                }}
                              />
                              <Input
                                placeholder="提取码（可选）"
                                value={dl.password || ""}
                                onChange={(e) => {
                                  const dls = [...(extraInfo.downloads || [])];
                                  dls[i] = { ...dls[i], password: e.target.value };
                                  setExtraInfo({ ...extraInfo, downloads: dls });
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setExtraInfo({
                                  ...extraInfo,
                                  downloads: extraInfo.downloads?.filter((_, j) => j !== i),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {(!extraInfo.downloads || extraInfo.downloads.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无下载链接，点击上方按钮添加
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">封面</CardTitle>
              </CardHeader>
              <CardContent>
                <CoverInput form={form} watchValue={coverUrl} contentType="video" />
              </CardContent>
            </Card>

            <TagPicker
              allTags={allTags}
              selectedTags={selectedTags}
              newTags={newTags}
              onToggleTag={toggleTag}
              onAddNewTag={(name) => setNewTags([...newTags, name])}
              onRemoveNewTag={(name) => setNewTags(newTags.filter((t) => t !== name))}
            />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="nsfw-toggle" className={cn("text-sm font-medium", isNsfw && "text-red-500")}>
                NSFW
              </Label>
              <Switch
                id="nsfw-toggle"
                checked={isNsfw}
                onCheckedChange={setIsNsfw}
                className="data-[state=checked]:bg-red-500"
              />
            </div>

            <div className="hidden lg:block">{submitButton}</div>
          </div>
        </div>

        {/* 移动端底部固定提交栏 */}
        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur-sm border-t lg:hidden z-40">
          {submitButton}
        </div>
      </form>
    </Form>
  );
}
