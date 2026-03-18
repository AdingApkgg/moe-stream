"use client";

import { use, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { notFound, useRouter } from "next/navigation";
import { useSiteConfig } from "@/contexts/site-config";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { GAME_TYPES, GAME_PLATFORMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MdxEditor } from "@/components/ui/mdx-editor";
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
  Search,
  Download,
  Save,
  Trash2,
  Monitor,
  Link2,
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
  const siteConfig = useSiteConfig();
  if (siteConfig && !siteConfig.sectionGameEnabled) notFound();
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const authLoading = authStatus === "loading";
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedTags, setSelectedTags] = useState<{ id: string; name: string }[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [newTagInput, setNewTagInput] = useState("");

  const [screenshots, setScreenshots] = useState<string[]>([""]);
  const [videos, setVideos] = useState<string[]>([""]);
  const [downloads, setDownloads] = useState<{ name: string; url: string; password?: string }[]>([]);
  const [originalName, setOriginalName] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [originalAuthorUrl, setOriginalAuthorUrl] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  const { data: game, isLoading: gameLoading } = trpc.admin.getGameForEdit.useQuery(
    { id },
    { enabled: !!session }
  );

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100, type: "game" }, { staleTime: 10 * 60 * 1000 });

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

    const gameTags = game.tags?.map((t: { tag: { id: string; name: string } }) => ({
      id: t.tag.id,
      name: t.tag.name,
    })) || [];
    setSelectedTags(gameTags);

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

  const onSubmit = async (data: EditForm) => {
    setIsSubmitting(true);
    try {
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

  if (!authLoading && !session) {
    router.replace(`/login?callbackUrl=/game/edit/${id}`);
    return null;
  }

  if (gameLoading || authLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4 text-center text-muted-foreground">
        游戏不存在
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            {/* 左侧主内容 */}
            <div className="space-y-6 min-w-0">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标题 *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="游戏标题" className="text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
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
                                <SelectItem key={type} value={type}>{type}</SelectItem>
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
                          <FormLabel>版本号</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ver1.0.0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isFree"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5"><FormLabel>免费游戏</FormLabel></div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>游戏介绍</FormLabel>
                        <FormControl>
                          <MdxEditor
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="游戏介绍，支持 Markdown 语法..."
                            maxLength={10000}
                            minHeight="160px"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 扩展信息 Tabs */}
              <Card>
                <CardContent className="pt-6">
                  <Tabs defaultValue="origin" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="origin" className="text-xs">原作信息</TabsTrigger>
                      <TabsTrigger value="screenshots" className="text-xs">游戏截图</TabsTrigger>
                      <TabsTrigger value="videos" className="text-xs">游戏视频</TabsTrigger>
                      <TabsTrigger value="downloads" className="text-xs">下载链接</TabsTrigger>
                    </TabsList>

                    <TabsContent value="origin" className="space-y-4 mt-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">原作名称</label>
                          <Input value={originalName} onChange={(e) => setOriginalName(e.target.value)} placeholder="游戏原名（日/英文）" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">原作作者</label>
                          <Input value={originalAuthor} onChange={(e) => setOriginalAuthor(e.target.value)} placeholder="开发者/社团名称" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">原作链接</label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={originalAuthorUrl} onChange={(e) => setOriginalAuthorUrl(e.target.value)} placeholder="https://..." className="pl-9" />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">文件大小</label>
                          <Input value={fileSize} onChange={(e) => setFileSize(e.target.value)} placeholder="如：2.5GB" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1">
                            <Monitor className="h-3.5 w-3.5" />支持平台
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {GAME_PLATFORMS.map((p) => (
                              <Badge
                                key={p}
                                variant={platforms.includes(p) ? "default" : "outline"}
                                className="cursor-pointer select-none transition-colors"
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
                      </div>
                    </TabsContent>

                    <TabsContent value="screenshots" className="space-y-4 mt-4">
                      <FormLabel className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />截图链接</FormLabel>
                      <Textarea
                        value={screenshots.filter(Boolean).join("\n")}
                        onChange={(e) => setScreenshots(e.target.value.split("\n"))}
                        placeholder={"每行一个截图链接，例如：\nhttps://example.com/screenshot1.jpg\nhttps://example.com/screenshot2.jpg"}
                        className="min-h-[100px] font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        每行一个 URL，已识别 {screenshots.filter(s => s.trim()).length} 张截图
                      </p>
                      {screenshots.some(s => s.trim()) && (
                        <div className="flex gap-2 flex-wrap">
                          {screenshots.filter(s => s.trim()).map((url, i) => (
                            <div key={i} className="w-24 h-16 rounded border overflow-hidden bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`截图 ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="videos" className="space-y-4 mt-4">
                      <FormLabel className="flex items-center gap-2"><FileVideo className="h-4 w-4" />视频链接</FormLabel>
                      <Textarea
                        value={videos.filter(Boolean).join("\n")}
                        onChange={(e) => setVideos(e.target.value.split("\n"))}
                        placeholder={"每行一个视频链接，支持 mp4、webm、m3u8\nhttps://example.com/preview.mp4"}
                        className="min-h-[80px] font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        每行一个 URL，已识别 {videos.filter(s => s.trim()).length} 个视频
                      </p>
                    </TabsContent>

                    <TabsContent value="downloads" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2"><Download className="h-4 w-4" />下载链接</FormLabel>
                        <Button type="button" variant="outline" size="sm" onClick={() => setDownloads([...downloads, { name: "", url: "" }])}>
                          <Plus className="h-4 w-4 mr-1" />添加链接
                        </Button>
                      </div>
                      {downloads.map((dl, i) => (
                        <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                          <div className="flex-1 grid gap-2 sm:grid-cols-3">
                            <Input placeholder="网盘名称" value={dl.name} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], name: e.target.value }; setDownloads(u); }} />
                            <Input placeholder="下载链接" value={dl.url} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], url: e.target.value }; setDownloads(u); }} />
                            <Input placeholder="提取码（可选）" value={dl.password || ""} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], password: e.target.value || undefined }; setDownloads(u); }} />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setDownloads(downloads.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      {downloads.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无下载链接，点击上方按钮添加</p>}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* 右侧边栏 */}
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              {/* 封面 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">封面</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField
                    control={form.control}
                    name="coverUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input {...field} placeholder="封面图片链接" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {coverUrl && (
                    <div className="rounded-lg overflow-hidden border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverUrl} alt="封面预览" className="w-full h-auto" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 标签 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">标签</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="gap-1 text-xs">
                        {tag.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(tag)} />
                      </Badge>
                    ))}
                    {newTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="gap-1 text-xs">
                        {tag} (新)
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setNewTags(newTags.filter((t) => t !== tag))} />
                      </Badge>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="搜索标签..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  <ScrollArea className="max-h-[120px]">
                    <div className="flex flex-wrap gap-1.5">
                      {filteredTags.map((tag: { id: string; name: string }) => {
                        const isSelected = selectedTags.some((t) => t.id === tag.id);
                        return (
                          <Badge
                            key={tag.id}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleTag(tag)}
                          >
                            {tag.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-1.5">
                    <Input
                      placeholder="新标签..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddNewTag())}
                      className="h-8 text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={handleAddNewTag}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    已选 {selectedTags.length + newTags.length}/10
                  </p>
                </CardContent>
              </Card>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存修改
                </Button>
                <Button type="button" variant="outline" className="w-full" asChild>
                  <Link href={`/game/${id}`}>取消</Link>
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
