"use client";

import { useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { videoFormSchema, type VideoFormData, type TagItem } from "@/lib/schemas/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { VideoPlayer } from "@/components/video/video-player";
import { TagPicker } from "@/components/shared/tag-picker";
import { CoverInput } from "@/components/shared/cover-input";
import type { VideoExtraInfo } from "@/lib/shortcode-parser";
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Info,
  Layers,
  ListVideo,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";
import { cn } from "@/lib/utils";

export interface VideoSubmitData {
  title: string;
  description?: string;
  coverUrl?: string;
  videoUrl: string;
  isNsfw: boolean;
  tagIds: string[];
  tagNames: string[];
  extraInfo?: VideoExtraInfo | null;
}

export interface SeriesItem {
  id: string;
  title: string;
  episodeCount: number;
}

export interface SeriesData {
  seriesId: string | null;
  episodeNum: number;
}

interface VideoFormProps {
  mode: "create" | "edit";
  initialData?: {
    title: string;
    description?: string;
    coverUrl?: string;
    videoUrl: string;
    isNsfw: boolean;
    tags: TagItem[];
    extraInfo?: VideoExtraInfo;
  };
  videoId?: string;
  onSubmit: (data: VideoSubmitData, seriesData?: SeriesData) => Promise<void>;
  isSubmitting: boolean;
  seriesOptions?: SeriesItem[];
  initialSeries?: { seriesId: string; episodeNum: number };
  onCreateSeries?: (title: string) => Promise<{ id: string }>;
}

export function VideoForm({
  mode,
  initialData,
  videoId,
  onSubmit,
  isSubmitting,
  seriesOptions,
  initialSeries,
  onCreateSeries,
}: VideoFormProps) {
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isNsfw, setIsNsfw] = useState(false);
  const [extraInfo, setExtraInfo] = useState<VideoExtraInfo>({});
  const [extraOpen, setExtraOpen] = useState(false);

  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [episodeNum, setEpisodeNum] = useState<number>(1);
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 }, { staleTime: 10 * 60 * 1000 });
  const { data: usedAuthors } = trpc.user.usedAuthors.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const form = useForm<VideoFormData>({
    resolver: zodResolver(videoFormSchema),
    defaultValues: { title: "", description: "", coverUrl: "", videoUrl: "" },
  });

  const coverUrl = useWatch({ control: form.control, name: "coverUrl" });
  const videoUrl = useWatch({ control: form.control, name: "videoUrl" });

  // 仅在初次加载到 initialData 时回填表单与本地状态，
  // 避免后续 tRPC refetch（如窗口聚焦）覆盖用户正在编辑的内容
  const [hasInitialized, setHasInitialized] = useState(false);
  if (initialData && !hasInitialized) {
    setHasInitialized(true);
    form.reset({
      title: initialData.title,
      description: initialData.description || "",
      coverUrl: initialData.coverUrl || "",
      videoUrl: initialData.videoUrl,
    });
    setSelectedTags(initialData.tags);
    setIsNsfw(initialData.isNsfw);
    if (initialData.extraInfo && typeof initialData.extraInfo === "object") {
      setExtraInfo(initialData.extraInfo);
      const info = initialData.extraInfo;
      if (info.intro || info.author || info.downloads?.length || info.episodes?.length) {
        setExtraOpen(true);
      }
    }
  }

  const [hasInitialSeries, setHasInitialSeries] = useState(false);
  if (initialSeries && !hasInitialSeries) {
    setHasInitialSeries(true);
    setSelectedSeriesId(initialSeries.seriesId);
    setEpisodeNum(initialSeries.episodeNum);
  }

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find((t) => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const hasExtraInfo = () =>
    extraInfo.intro ||
    extraInfo.author ||
    extraInfo.authorIntro ||
    (extraInfo.keywords && extraInfo.keywords.length > 0) ||
    (extraInfo.downloads && extraInfo.downloads.length > 0) ||
    (extraInfo.episodes && extraInfo.episodes.length > 0) ||
    (extraInfo.relatedVideos && extraInfo.relatedVideos.length > 0) ||
    (extraInfo.notices && extraInfo.notices.length > 0);

  const extraFilledCount = useMemo(() => {
    let count = 0;
    if (extraInfo.intro) count++;
    if (extraInfo.author || extraInfo.authorIntro) count++;
    if (extraInfo.downloads?.length) count++;
    if (extraInfo.episodes?.length) count++;
    if (extraInfo.relatedVideos?.length) count++;
    return count;
  }, [extraInfo]);

  const handleSubmit = async (data: VideoFormData) => {
    const submitData: VideoSubmitData = {
      title: data.title,
      description: data.description || undefined,
      // 保留空字符串以便清空封面（服务端 zod 允许 ""，会落库为空）
      coverUrl: data.coverUrl ?? "",
      videoUrl: data.videoUrl,
      isNsfw,
      tagIds: selectedTags.map((t) => t.id),
      tagNames: newTags,
      ...(hasExtraInfo() ? { extraInfo } : { extraInfo: mode === "edit" ? null : undefined }),
    };
    const seriesData: SeriesData | undefined = mode === "edit" ? { seriesId: selectedSeriesId, episodeNum } : undefined;
    await onSubmit(submitData, seriesData);
  };

  const handleCreateSeries = async () => {
    if (!newSeriesTitle.trim() || !onCreateSeries) return;
    setIsCreatingSeries(true);
    try {
      const result = await onCreateSeries(newSeriesTitle.trim());
      setSelectedSeriesId(result.id);
      setShowCreateSeries(false);
      setNewSeriesTitle("");
    } finally {
      setIsCreatingSeries(false);
    }
  };

  const submitButton = (
    <Button type="submit" className="w-full h-11" disabled={isSubmitting} size="lg">
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {mode === "create" ? "发布中..." : "保存中..."}
        </>
      ) : (
        <>
          {mode === "create" ? <Upload className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          {mode === "create" ? "发布视频" : "保存更改"}
        </>
      )}
    </Button>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
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
                            contentId={videoId}
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

            {/* 扩展信息 */}
            <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        扩展信息（可选）
                      </CardTitle>
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
                    <Tabs defaultValue="intro" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="intro" className="text-xs">
                          作品介绍
                        </TabsTrigger>
                        <TabsTrigger value="author" className="text-xs">
                          作者信息
                        </TabsTrigger>
                        <TabsTrigger value="downloads" className="text-xs">
                          下载链接
                        </TabsTrigger>
                        <TabsTrigger value="related" className="text-xs">
                          相关内容
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="intro" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <FormLabel>作品介绍</FormLabel>
                          <Textarea
                            placeholder="详细的作品介绍..."
                            value={extraInfo.intro || ""}
                            onChange={(e) => setExtraInfo({ ...extraInfo, intro: e.target.value })}
                            className="min-h-[100px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel>剧集介绍</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExtraInfo({
                                  ...extraInfo,
                                  episodes: [...(extraInfo.episodes || []), { title: "", content: "" }],
                                })
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              添加剧集
                            </Button>
                          </div>
                          {extraInfo.episodes?.map((episode, index) => (
                            <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder={`第 ${index + 1} 集标题`}
                                  value={episode.title}
                                  onChange={(e) => {
                                    const eps = [...(extraInfo.episodes || [])];
                                    eps[index] = { ...eps[index], title: e.target.value };
                                    setExtraInfo({ ...extraInfo, episodes: eps });
                                  }}
                                />
                                <Textarea
                                  placeholder="剧集介绍..."
                                  value={episode.content}
                                  onChange={(e) => {
                                    const eps = [...(extraInfo.episodes || [])];
                                    eps[index] = { ...eps[index], content: e.target.value };
                                    setExtraInfo({ ...extraInfo, episodes: eps });
                                  }}
                                  className="min-h-[60px]"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setExtraInfo({
                                    ...extraInfo,
                                    episodes: extraInfo.episodes?.filter((_, i) => i !== index),
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

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
                        <div className="space-y-2">
                          <FormLabel>搜索关键词</FormLabel>
                          <Input
                            placeholder="用逗号分隔多个关键词"
                            value={extraInfo.keywords?.join(", ") || ""}
                            onChange={(e) =>
                              setExtraInfo({
                                ...extraInfo,
                                keywords: e.target.value
                                  .split(",")
                                  .map((k) => k.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground">帮助用户找到这个视频的关键词</p>
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

                      <TabsContent value="related" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2">
                            <ListVideo className="h-4 w-4" />
                            相关视频
                          </FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setExtraInfo({
                                ...extraInfo,
                                relatedVideos: [...(extraInfo.relatedVideos || []), ""],
                              })
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            添加
                          </Button>
                        </div>
                        {extraInfo.relatedVideos?.map((vid, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              placeholder="相关视频标题"
                              value={vid}
                              onChange={(e) => {
                                const rv = [...(extraInfo.relatedVideos || [])];
                                rv[index] = e.target.value;
                                setExtraInfo({ ...extraInfo, relatedVideos: rv });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setExtraInfo({
                                  ...extraInfo,
                                  relatedVideos: extraInfo.relatedVideos?.filter((_, i) => i !== index),
                                })
                              }
                            >
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

          {/* 右侧边栏 */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">封面</CardTitle>
              </CardHeader>
              <CardContent>
                <CoverInput form={form} watchValue={coverUrl} contentType="video" contentId={videoId} />
              </CardContent>
            </Card>

            {/* 合集 - 仅编辑模式 */}
            {mode === "edit" && seriesOptions && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <Layers className="h-4 w-4" />
                      合集
                    </CardTitle>
                    {selectedSeriesId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSeriesId(null);
                          setEpisodeNum(1);
                        }}
                      >
                        取消
                      </Button>
                    )}
                  </div>
                  <CardDescription>将视频添加到合集（可选）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!showCreateSeries ? (
                    <>
                      <Select
                        value={selectedSeriesId || ""}
                        onValueChange={(value) => {
                          setSelectedSeriesId(value || null);
                          const series = seriesOptions.find((s) => s.id === value);
                          if (series) setEpisodeNum(series.episodeCount + 1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择合集..." />
                        </SelectTrigger>
                        <SelectContent>
                          {seriesOptions.map((series) => (
                            <SelectItem key={series.id} value={series.id}>
                              <div className="flex items-center gap-2">
                                <span>{series.title}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {series.episodeCount}集
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                          {seriesOptions.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无合集</div>
                          )}
                        </SelectContent>
                      </Select>
                      {selectedSeriesId && (
                        <div className="flex items-center gap-2">
                          <FormLabel className="shrink-0">第</FormLabel>
                          <Input
                            type="number"
                            min={1}
                            value={episodeNum}
                            onChange={(e) => setEpisodeNum(parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <FormLabel className="shrink-0">集</FormLabel>
                        </div>
                      )}
                      {onCreateSeries && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCreateSeries(true)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          创建新合集
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        placeholder="合集名称"
                        value={newSeriesTitle}
                        onChange={(e) => setNewSeriesTitle(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setShowCreateSeries(false);
                            setNewSeriesTitle("");
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          disabled={!newSeriesTitle.trim() || isCreatingSeries}
                          onClick={handleCreateSeries}
                        >
                          {isCreatingSeries && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                          创建
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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

        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur-sm border-t lg:hidden z-40">
          {submitButton}
        </div>
      </form>
    </Form>
  );
}
