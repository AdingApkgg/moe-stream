"use client";

import { use, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { GAME_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast-with-sound";
import {
  Loader2,
  ArrowLeft,
  Plus,
  X,
  Image as ImageIcon,
  FileVideo,
  Tag,
  Info,
  Search,
  Download,
  Save,
  Gamepad2,
  Trash2,
  Monitor,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

const editSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200),
  description: z.string().max(10000).optional().or(z.literal("")),
  coverUrl: z.string().optional().or(z.literal("")),
  gameType: z.string().optional().or(z.literal("")),
  version: z.string().optional().or(z.literal("")),
  isFree: z.boolean(),
});

type EditForm = z.infer<typeof editSchema>;

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditGamePage({ params }: Props) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const authLoading = authStatus === "loading";
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tags
  const [selectedTags, setSelectedTags] = useState<{ id: string; name: string }[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [newTagInput, setNewTagInput] = useState("");

  // Extra info fields
  const [screenshots, setScreenshots] = useState<string[]>([""]);
  const [videos, setVideos] = useState<string[]>([""]);
  const [downloads, setDownloads] = useState<{ name: string; url: string; password?: string }[]>([]);
  const [originalName, setOriginalName] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [originalAuthorUrl, setOriginalAuthorUrl] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platformInput, setPlatformInput] = useState("");

  const { data: game, isLoading: gameLoading } = trpc.admin.getGameForEdit.useQuery(
    { id },
    { enabled: !!session }
  );

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100, type: "game" });

  const updateMutation = trpc.admin.updateGame.useMutation({
    onSuccess: () => {
      toast.success("游戏更新成功");
      router.push(`/game/${id}`);
    },
    onError: (error) => {
      toast.error("更新失败", { description: error.message });
    },
  });

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: "",
      description: "",
      coverUrl: "",
      gameType: "",
      version: "",
      isFree: true,
    },
  });

  const coverUrl = form.watch("coverUrl");

  // Load game data into form
  useEffect(() => {
    if (!game) return;
    form.reset({
      title: game.title,
      description: game.description || "",
      coverUrl: game.coverUrl || "",
      gameType: game.gameType || "",
      version: game.version || "",
      isFree: game.isFree,
    });

    // Tags
    const gameTags = game.tags?.map((t: { tag: { id: string; name: string } }) => ({
      id: t.tag.id,
      name: t.tag.name,
    })) || [];
    setSelectedTags(gameTags);

    // Extra info
    const extra = (game.extraInfo || {}) as Record<string, unknown>;
    setScreenshots((extra.screenshots as string[]) || [""]);
    setVideos((extra.videos as string[]) || [""]);
    setDownloads((extra.downloads as { name: string; url: string; password?: string }[]) || []);
    setOriginalName((extra.originalName as string) || "");
    setOriginalAuthor((extra.originalAuthor as string) || "");
    setOriginalAuthorUrl((extra.originalAuthorUrl as string) || "");
    setFileSize((extra.fileSize as string) || "");
    setPlatforms((extra.platforms as string[]) || []);
  }, [game, form]);

  // Filter tags
  const filteredTags = allTags?.filter((tag: { id: string; name: string }) => {
    if (!tagSearch.trim()) return true;
    return tag.name.toLowerCase().includes(tagSearch.toLowerCase());
  }) || [];

  const toggleTag = (tag: { id: string; name: string }) => {
    const exists = selectedTags.find((t) => t.id === tag.id);
    if (exists) {
      setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    } else if (selectedTags.length + newTags.length < 10) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddNewTag = () => {
    const tag = newTagInput.trim();
    if (!tag || newTags.length + selectedTags.length >= 10) return;
    if (newTags.includes(tag)) return;
    if (selectedTags.some((t) => t.name.toLowerCase() === tag.toLowerCase())) return;
    const existing = allTags?.find((t: { name: string }) => t.name.toLowerCase() === tag.toLowerCase());
    if (existing) {
      toggleTag(existing);
    } else {
      setNewTags([...newTags, tag]);
    }
    setNewTagInput("");
  };

  const handleAddPlatform = () => {
    const p = platformInput.trim();
    if (!p || platforms.includes(p)) return;
    setPlatforms([...platforms, p]);
    setPlatformInput("");
  };

  const onSubmit = async (data: EditForm) => {
    setIsSubmitting(true);
    try {
      // Build extraInfo
      const extraInfo: Record<string, unknown> = {};
      const validScreenshots = screenshots.filter((s) => s.trim());
      const validVideos = videos.filter((v) => v.trim());
      const validDownloads = downloads.filter((d) => d.url.trim());
      if (validScreenshots.length > 0) extraInfo.screenshots = validScreenshots;
      if (validVideos.length > 0) extraInfo.videos = validVideos;
      if (validDownloads.length > 0) extraInfo.downloads = validDownloads;
      if (originalName) extraInfo.originalName = originalName;
      if (originalAuthor) extraInfo.originalAuthor = originalAuthor;
      if (originalAuthorUrl) extraInfo.originalAuthorUrl = originalAuthorUrl;
      if (fileSize) extraInfo.fileSize = fileSize;
      if (platforms.length > 0) extraInfo.platforms = platforms;

      const tagNames = [...selectedTags.map((t) => t.name), ...newTags];

      await updateMutation.mutateAsync({
        gameId: id,
        title: data.title,
        description: data.description || undefined,
        coverUrl: data.coverUrl || undefined,
        gameType: data.gameType || undefined,
        isFree: data.isFree,
        version: data.version || undefined,
        extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
        tagNames: tagNames.length > 0 ? tagNames : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth redirect
  if (!authLoading && !session) {
    router.replace(`/login?callbackUrl=/game/edit/${id}`);
    return null;
  }

  if (gameLoading || authLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 text-center text-muted-foreground">
        游戏不存在
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic" className="gap-1 text-xs sm:text-sm">
                <Gamepad2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">基本信息</span>
              </TabsTrigger>
              <TabsTrigger value="tags" className="gap-1 text-xs sm:text-sm">
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">标签</span>
              </TabsTrigger>
              <TabsTrigger value="media" className="gap-1 text-xs sm:text-sm">
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">媒体</span>
              </TabsTrigger>
              <TabsTrigger value="downloads" className="gap-1 text-xs sm:text-sm">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">下载</span>
              </TabsTrigger>
              <TabsTrigger value="extra" className="gap-1 text-xs sm:text-sm">
                <Info className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">扩展</span>
              </TabsTrigger>
            </TabsList>

            {/* Basic Info */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标题 *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="游戏标题" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>描述</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="游戏描述..." className="min-h-[120px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gameType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>游戏类型</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择类型" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {GAME_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>版本</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="例如：Ver1.0.3" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="isFree"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormLabel className="mt-0">免费游戏</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coverUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>封面图片</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {coverUrl && (
                    <div className="rounded-lg overflow-hidden border bg-muted max-w-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverUrl} alt="封面预览" className="w-full h-auto" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tags */}
            <TabsContent value="tags" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">标签管理</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selected tags */}
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="gap-1">
                        {tag.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(tag)} />
                      </Badge>
                    ))}
                    {newTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1">
                        {tag} (新)
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setNewTags(newTags.filter((t) => t !== tag))}
                        />
                      </Badge>
                    ))}
                    {selectedTags.length + newTags.length === 0 && (
                      <span className="text-sm text-muted-foreground">未选择标签</span>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索标签..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Tag list */}
                  <ScrollArea className="max-h-[200px]">
                    <div className="flex flex-wrap gap-2">
                      {filteredTags.map((tag: { id: string; name: string }) => {
                        const isSelected = selectedTags.some((t) => t.id === tag.id);
                        return (
                          <Badge
                            key={tag.id}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleTag(tag)}
                          >
                            {tag.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* Add new tag */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加新标签..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddNewTag())}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddNewTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    已选 {selectedTags.length + newTags.length}/10 个标签
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Media */}
            <TabsContent value="media" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    游戏截图
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {screenshots.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) => {
                          const next = [...screenshots];
                          next[i] = e.target.value;
                          setScreenshots(next);
                        }}
                        placeholder="截图 URL..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setScreenshots(screenshots.filter((_, j) => j !== i))}
                        disabled={screenshots.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScreenshots([...screenshots, ""])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加截图
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileVideo className="h-4 w-4" />
                    游戏视频
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {videos.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={url}
                        onChange={(e) => {
                          const next = [...videos];
                          next[i] = e.target.value;
                          setVideos(next);
                        }}
                        placeholder="视频 URL (mp4, webm, m3u8)..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setVideos(videos.filter((_, j) => j !== i))}
                        disabled={videos.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVideos([...videos, ""])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加视频
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Downloads */}
            <TabsContent value="downloads" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    下载链接
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {downloads.map((dl, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={dl.name}
                            onChange={(e) => {
                              const next = [...downloads];
                              next[i] = { ...next[i], name: e.target.value };
                              setDownloads(next);
                            }}
                            placeholder="名称（如：夸克网盘）"
                          />
                          <Input
                            value={dl.password || ""}
                            onChange={(e) => {
                              const next = [...downloads];
                              next[i] = { ...next[i], password: e.target.value || undefined };
                              setDownloads(next);
                            }}
                            placeholder="密码（可选）"
                          />
                        </div>
                        <Input
                          value={dl.url}
                          onChange={(e) => {
                            const next = [...downloads];
                            next[i] = { ...next[i], url: e.target.value };
                            setDownloads(next);
                          }}
                          placeholder="下载 URL..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1"
                        onClick={() => setDownloads(downloads.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDownloads([...downloads, { name: "", url: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加下载链接
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Extra Info */}
            <TabsContent value="extra" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    扩展信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">原作名称</label>
                      <Input
                        value={originalName}
                        onChange={(e) => setOriginalName(e.target.value)}
                        placeholder="原作/日文名称"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">文件大小</label>
                      <Input
                        value={fileSize}
                        onChange={(e) => setFileSize(e.target.value)}
                        placeholder="例如：2.5GB"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">作者/开发者</label>
                      <Input
                        value={originalAuthor}
                        onChange={(e) => setOriginalAuthor(e.target.value)}
                        placeholder="开发者名称"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">作者链接</label>
                      <Input
                        value={originalAuthorUrl}
                        onChange={(e) => setOriginalAuthorUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  {/* Platforms */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5" />
                      支持平台
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {platforms.map((p) => (
                        <Badge key={p} variant="secondary" className="gap-1">
                          {p}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => setPlatforms(platforms.filter((x) => x !== p))}
                          />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={platformInput}
                        onChange={(e) => setPlatformInput(e.target.value)}
                        placeholder="输入平台名称..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPlatform())}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={handleAddPlatform}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["Windows", "Mac", "Linux", "Android", "iOS"].map((p) => (
                        <Badge
                          key={p}
                          variant={platforms.includes(p) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => {
                            if (platforms.includes(p)) {
                              setPlatforms(platforms.filter((x) => x !== p));
                            } else {
                              setPlatforms([...platforms, p]);
                            }
                          }}
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Submit */}
          <div className="flex gap-3 justify-end sticky bottom-4">
            <Button type="button" variant="outline" asChild>
              <Link href={`/game/${id}`}>取消</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存修改
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
