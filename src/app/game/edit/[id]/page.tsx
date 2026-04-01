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
import { MdxEditor } from "@/components/ui/mdx-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  GitBranch,
  GripVertical,
  LayoutGrid,
} from "lucide-react";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";
import { TAB_ICON_OPTIONS } from "@/lib/game-tab-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [isNsfw, setIsNsfw] = useState(false);
  const [versions, setVersions] = useState<{ id?: string; label: string; description: string }[]>([]);
  const [customTabs, setCustomTabs] = useState<{ id?: string; title: string; icon: string; content: string }[]>([]);

  const { data: game, isLoading: gameLoading } = trpc.admin.getGameForEdit.useQuery({ id }, { enabled: !!session });

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

    const gameTags =
      game.tags?.map((t: { tag: { id: string; name: string } }) => ({
        id: t.tag.id,
        name: t.tag.name,
      })) || [];
    setSelectedTags(gameTags);
    setIsNsfw(game.isNsfw ?? false);

    const extra = (game.extraInfo || {}) as Record<string, unknown>;
    setScreenshots((extra.screenshots as string[]) || [""]);
    setVideos((extra.videos as string[]) || [""]);
    setDownloads((extra.downloads as { name: string; url: string; password?: string }[]) || []);
    setOriginalName((extra.originalName as string) || "");
    setOriginalAuthor((extra.originalAuthor as string) || "");
    setOriginalAuthorUrl((extra.originalAuthorUrl as string) || "");
    setFileSize((extra.fileSize as string) || "");
    setPlatforms((extra.platforms as string[]) || []);

    if (game.versions && game.versions.length > 0) {
      setVersions(
        game.versions.map((v: { id: string; label: string; description: string | null }) => ({
          id: v.id,
          label: v.label,
          description: v.description || "",
        })),
      );
    }

    if (game.customTabs && game.customTabs.length > 0) {
      setCustomTabs(
        game.customTabs.map((t: { id: string; title: string; icon: string | null; content: string }) => ({
          id: t.id,
          title: t.title,
          icon: t.icon || "file-text",
          content: t.content,
        })),
      );
    }
  }, [game, form]);

  const filteredTags =
    allTags?.filter((tag: { id: string; name: string }) => {
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

      const validVersions = versions
        .filter((v) => v.label.trim())
        .map((v) => ({
          id: v.id,
          label: v.label,
          description: v.description || undefined,
        }));

      const validCustomTabs = customTabs
        .filter((t) => t.title.trim() && t.content.trim())
        .map((t) => ({
          id: t.id,
          title: t.title,
          icon: t.icon || undefined,
          content: t.content,
        }));

      await updateMutation.mutateAsync({
        gameId: id,
        title: data.title,
        description: data.description || undefined,
        coverUrl: data.coverUrl || undefined,
        gameType: data.gameType || undefined,
        isFree: data.isFree,
        isNsfw,
        version: data.version || undefined,
        extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
        tagNames: tagNames.length > 0 ? tagNames : undefined,
        versions: validVersions,
        customTabs: validCustomTabs,
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
    return <div className="container max-w-5xl mx-auto py-8 px-4 text-center text-muted-foreground">游戏不存在</div>;
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
                          <div className="space-y-0.5">
                            <FormLabel>免费游戏</FormLabel>
                          </div>
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
                    <TabsList className="grid w-full grid-cols-6">
                      <TabsTrigger value="origin" className="text-xs">
                        原作信息
                      </TabsTrigger>
                      <TabsTrigger value="screenshots" className="text-xs">
                        游戏截图
                      </TabsTrigger>
                      <TabsTrigger value="videos" className="text-xs">
                        游戏视频
                      </TabsTrigger>
                      <TabsTrigger value="downloads" className="text-xs">
                        下载链接
                      </TabsTrigger>
                      <TabsTrigger value="versions" className="text-xs">
                        更新版本
                      </TabsTrigger>
                      <TabsTrigger value="customTabs" className="text-xs">
                        自定义页面
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="origin" className="space-y-4 mt-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">原作名称</label>
                          <Input
                            value={originalName}
                            onChange={(e) => setOriginalName(e.target.value)}
                            placeholder="游戏原名（日/英文）"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">原作作者</label>
                          <Input
                            value={originalAuthor}
                            onChange={(e) => setOriginalAuthor(e.target.value)}
                            placeholder="开发者/社团名称"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">原作链接</label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={originalAuthorUrl}
                            onChange={(e) => setOriginalAuthorUrl(e.target.value)}
                            placeholder="https://..."
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">文件大小</label>
                          <Input
                            value={fileSize}
                            onChange={(e) => setFileSize(e.target.value)}
                            placeholder="如：2.5GB"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1">
                            <Monitor className="h-3.5 w-3.5" />
                            支持平台
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
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          截图
                        </FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScreenshots([...screenshots.filter(Boolean), ""])}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加截图
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {screenshots.map((url, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <div className="flex-1">
                              <UrlOrUploadInput
                                value={url}
                                onChange={(v) => {
                                  const s = [...screenshots];
                                  s[i] = v;
                                  setScreenshots(s);
                                }}
                                accept="image/*"
                                placeholder="https://example.com/screenshot.jpg"
                                contentType="game"
                                contentId={id}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-0.5 shrink-0"
                              onClick={() => setScreenshots(screenshots.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        已添加 {screenshots.filter((s) => s.trim()).length} 张截图
                      </p>
                      {screenshots.some((s) => s.trim()) && (
                        <div className="flex gap-2 flex-wrap">
                          {screenshots
                            .filter((s) => s.trim())
                            .map((url, i) => (
                              <div key={i} className="w-24 h-16 rounded border overflow-hidden bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`截图 ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="videos" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          <FileVideo className="h-4 w-4" />
                          预览视频
                        </FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setVideos([...videos.filter(Boolean), ""])}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加视频
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {videos.map((url, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <div className="flex-1">
                              <UrlOrUploadInput
                                value={url}
                                onChange={(v) => {
                                  const vs = [...videos];
                                  vs[i] = v;
                                  setVideos(vs);
                                }}
                                accept="video/*,.m3u8"
                                placeholder="https://example.com/preview.mp4"
                                contentType="game"
                                contentId={id}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-0.5 shrink-0"
                              onClick={() => setVideos(videos.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        已添加 {videos.filter((s) => s.trim()).length} 个视频
                      </p>
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
                          onClick={() => setDownloads([...downloads, { name: "", url: "" }])}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加链接
                        </Button>
                      </div>
                      {downloads.map((dl, i) => (
                        <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                          <div className="flex gap-2 items-center">
                            <Input
                              placeholder="网盘名称"
                              value={dl.name}
                              onChange={(e) => {
                                const u = [...downloads];
                                u[i] = { ...u[i], name: e.target.value };
                                setDownloads(u);
                              }}
                              className="flex-1"
                            />
                            <Input
                              placeholder="提取码（可选）"
                              value={dl.password || ""}
                              onChange={(e) => {
                                const u = [...downloads];
                                u[i] = { ...u[i], password: e.target.value || undefined };
                                setDownloads(u);
                              }}
                              className="w-32"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => setDownloads(downloads.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <UrlOrUploadInput
                            value={dl.url}
                            onChange={(v) => {
                              const u = [...downloads];
                              u[i] = { ...u[i], url: v };
                              setDownloads(u);
                            }}
                            placeholder="下载链接"
                            contentType="game"
                            contentId={game?.id}
                          />
                        </div>
                      ))}
                      {downloads.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">暂无下载链接，点击上方按钮添加</p>
                      )}
                    </TabsContent>

                    <TabsContent value="versions" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          更新版本
                        </FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setVersions([...versions, { label: "", description: "" }])}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加版本
                        </Button>
                      </div>
                      {versions.map((ver, i) => (
                        <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Input
                              placeholder="版本标记，如：v1.0、v2.0 汉化版"
                              value={ver.label}
                              onChange={(e) => {
                                const u = [...versions];
                                u[i] = { ...u[i], label: e.target.value };
                                setVersions(u);
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setVersions(versions.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <MdxEditor
                            value={ver.description}
                            onChange={(val) => {
                              const u = [...versions];
                              u[i] = { ...u[i], description: val };
                              setVersions(u);
                            }}
                            placeholder="版本描述（更新内容、注意事项等），支持 Markdown..."
                            maxLength={10000}
                            minHeight="100px"
                          />
                        </div>
                      ))}
                      {versions.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">暂无更新版本，点击上方按钮添加</p>
                      )}
                    </TabsContent>

                    <TabsContent value="customTabs" className="space-y-4 mt-4">
                      <div className="flex items-center justify-between">
                        <FormLabel className="flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" />
                          自定义页面
                        </FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCustomTabs([...customTabs, { title: "", icon: "file-text", content: "" }])}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加页面
                        </Button>
                      </div>
                      {customTabs.map((tab, i) => (
                        <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Select
                              value={tab.icon || "file-text"}
                              onValueChange={(val) => {
                                const u = [...customTabs];
                                u[i] = { ...u[i], icon: val };
                                setCustomTabs(u);
                              }}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TAB_ICON_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <span className="flex items-center gap-1.5">
                                      <opt.icon className="h-3.5 w-3.5" />
                                      {opt.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="页面标题，如：攻略、MOD 列表"
                              value={tab.title}
                              onChange={(e) => {
                                const u = [...customTabs];
                                u[i] = { ...u[i], title: e.target.value };
                                setCustomTabs(u);
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setCustomTabs(customTabs.filter((_, j) => j !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <MdxEditor
                            value={tab.content}
                            onChange={(val) => {
                              const u = [...customTabs];
                              u[i] = { ...u[i], content: val };
                              setCustomTabs(u);
                            }}
                            placeholder="页面内容，支持 Markdown / MDX 语法..."
                            maxLength={50000}
                            minHeight="150px"
                          />
                        </div>
                      ))}
                      {customTabs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          暂无自定义页面，点击上方按钮添加
                        </p>
                      )}
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
                        <UrlOrUploadInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          accept="image/*"
                          placeholder="封面图片链接"
                          contentType="game"
                          contentId={id}
                        />
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
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => setNewTags(newTags.filter((t) => t !== tag))}
                        />
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

                  <ScrollArea className="h-[120px] [&_[data-slot=scroll-area-viewport]>div]:!block">
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

                  <p className="text-xs text-muted-foreground">已选 {selectedTags.length + newTags.length}/10</p>
                </CardContent>
              </Card>

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

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
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
