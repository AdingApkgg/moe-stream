"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MdxEditor } from "@/components/ui/mdx-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { GAME_TYPES, GAME_PLATFORMS } from "@/lib/constants";
import { gameUploadSchema, type GameUploadForm } from "../_lib/schemas";
import { TagPicker } from "./tag-picker";
import { CoverInput } from "./cover-input";
import type { TagItem } from "../_lib/types";
import {
  Download, FileVideo, Gamepad2, Image as ImageIcon,
  Link2, Loader2, Monitor, Plus, Trash2, GitBranch, GripVertical, LayoutGrid,
} from "lucide-react";
import { TAB_ICON_OPTIONS } from "@/lib/game-tab-icons";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";

export function GameSingleUpload() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([""]);
  const [videos, setVideos] = useState<string[]>([""]);
  const [downloads, setDownloads] = useState<{ name: string; url: string; password?: string }[]>([]);
  const [versions, setVersions] = useState<{ label: string; description: string }[]>([]);
  const [customTabs, setCustomTabs] = useState<{ title: string; icon: string; content: string }[]>([]);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 }, { staleTime: 10 * 60 * 1000 });
  const createMutation = trpc.game.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const form = useForm<GameUploadForm>({
    resolver: zodResolver(gameUploadSchema),
    defaultValues: {
      title: "", description: "", coverUrl: "", gameType: "",
      isFree: true, version: "", originalName: "", originalAuthor: "",
      originalAuthorUrl: "", fileSize: "", platforms: [],
    },
  });

  const gameCoverUrl = form.watch("coverUrl");

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find(t => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const onSubmit = async (data: GameUploadForm) => {
    setIsLoading(true);
    try {
      const extraInfo: Record<string, unknown> = {};
      if (data.originalName) extraInfo.originalName = data.originalName;
      if (data.originalAuthor) extraInfo.originalAuthor = data.originalAuthor;
      if (data.originalAuthorUrl) extraInfo.originalAuthorUrl = data.originalAuthorUrl;
      if (data.fileSize) extraInfo.fileSize = data.fileSize;
      if (data.platforms && data.platforms.length > 0) extraInfo.platforms = data.platforms;
      const validScreenshots = screenshots.filter(s => s.trim());
      if (validScreenshots.length > 0) extraInfo.screenshots = validScreenshots;
      const validVideos = videos.filter(s => s.trim());
      if (validVideos.length > 0) extraInfo.videos = validVideos;
      if (downloads.length > 0) extraInfo.downloads = downloads.filter(d => d.url.trim());

      const validVersions = versions.filter(v => v.label.trim());
      const validCustomTabs = customTabs.filter(t => t.title.trim() && t.content.trim()).map(t => ({
        title: t.title,
        icon: t.icon || undefined,
        content: t.content,
      }));

      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description || undefined,
        coverUrl: data.coverUrl || undefined,
        gameType: data.gameType || undefined,
        isFree: data.isFree,
        version: data.version || undefined,
        tagIds: selectedTags.map(t => t.id),
        tagNames: newTags,
        extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
        versions: validVersions.length > 0 ? validVersions : undefined,
        customTabs: validCustomTabs.length > 0 ? validCustomTabs : undefined,
      });

      toast.success(result.status === "PUBLISHED" ? "发布成功" : "提交成功，等待审核");
      router.push(`/game/${result.id}`);
    } catch {
      // onError 已处理
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* 左侧主内容 */}
          <div className="space-y-6 min-w-0">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>游戏标题 *</FormLabel>
                    <FormControl><Input placeholder="输入游戏标题" {...field} className="text-base" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField control={form.control} name="gameType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>游戏类型</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="选择类型" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {GAME_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="version" render={({ field }) => (
                    <FormItem>
                      <FormLabel>版本号</FormLabel>
                      <FormControl><Input placeholder="Ver1.0.0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="isFree" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5"><FormLabel>免费游戏</FormLabel></div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>游戏介绍</FormLabel>
                    <FormControl>
                      <MdxEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="游戏介绍，支持 Markdown 语法..."
                        maxLength={5000}
                        minHeight="160px"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* 扩展信息 Tabs */}
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="origin" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="origin" className="text-xs">原作信息</TabsTrigger>
                    <TabsTrigger value="screenshots" className="text-xs">游戏截图</TabsTrigger>
                    <TabsTrigger value="videos" className="text-xs">游戏视频</TabsTrigger>
                    <TabsTrigger value="downloads" className="text-xs">下载链接</TabsTrigger>
                    <TabsTrigger value="versions" className="text-xs">更新版本</TabsTrigger>
                    <TabsTrigger value="customTabs" className="text-xs">自定义页面</TabsTrigger>
                  </TabsList>

                  <TabsContent value="origin" className="space-y-4 mt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="originalName" render={({ field }) => (
                        <FormItem><FormLabel>原作名称</FormLabel><FormControl><Input placeholder="游戏原名（日/英文）" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="originalAuthor" render={({ field }) => (
                        <FormItem><FormLabel>原作作者</FormLabel><FormControl><Input placeholder="开发者/社团名称" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="originalAuthorUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>原作链接</FormLabel>
                        <FormControl>
                          <div className="relative"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="https://..." {...field} className="pl-9" /></div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="fileSize" render={({ field }) => (
                        <FormItem><FormLabel>文件大小</FormLabel><FormControl><Input placeholder="如：2.5GB" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="platforms" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />支持平台</FormLabel>
                          <FormControl>
                            <div className="flex flex-wrap gap-1.5">
                              {GAME_PLATFORMS.map((p) => {
                                const selected = field.value?.includes(p) ?? false;
                                return (
                                  <Badge
                                    key={p}
                                    variant={selected ? "default" : "outline"}
                                    className="cursor-pointer select-none transition-colors"
                                    onClick={() => {
                                      const next = selected
                                        ? (field.value ?? []).filter((v: string) => v !== p)
                                        : [...(field.value ?? []), p];
                                      field.onChange(next);
                                    }}
                                  >
                                    {p}
                                  </Badge>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </TabsContent>

                  <TabsContent value="screenshots" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />截图</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setScreenshots([...screenshots.filter(Boolean), ""])}>
                        <Plus className="h-4 w-4 mr-1" />添加截图
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {screenshots.map((url, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <div className="flex-1">
                            <UrlOrUploadInput
                              value={url}
                              onChange={(v) => { const s = [...screenshots]; s[i] = v; setScreenshots(s); }}
                              accept="image/*"
                              placeholder="https://example.com/screenshot.jpg"
                              contentType="game"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => setScreenshots(screenshots.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      已添加 {screenshots.filter(s => s.trim()).length} 张截图
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
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><FileVideo className="h-4 w-4" />预览视频</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setVideos([...videos.filter(Boolean), ""])}>
                        <Plus className="h-4 w-4 mr-1" />添加视频
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {videos.map((url, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <div className="flex-1">
                            <UrlOrUploadInput
                              value={url}
                              onChange={(v) => { const vs = [...videos]; vs[i] = v; setVideos(vs); }}
                              accept="video/*,.m3u8"
                              placeholder="https://example.com/preview.mp4"
                              contentType="game"
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => setVideos(videos.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      已添加 {videos.filter(s => s.trim()).length} 个视频
                    </p>
                  </TabsContent>

                  <TabsContent value="downloads" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><Download className="h-4 w-4" />下载链接</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDownloads([...downloads, { name: "", url: "", password: "" }])}><Plus className="h-4 w-4 mr-1" />添加链接</Button>
                    </div>
                    {downloads.map((dl, i) => (
                      <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                        <div className="flex-1 grid gap-2 sm:grid-cols-3">
                          <Input placeholder="网盘名称" value={dl.name} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], name: e.target.value }; setDownloads(u); }} />
                          <Input placeholder="下载链接" value={dl.url} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], url: e.target.value }; setDownloads(u); }} />
                          <Input placeholder="提取码（可选）" value={dl.password || ""} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], password: e.target.value }; setDownloads(u); }} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setDownloads(downloads.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {downloads.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无下载链接，点击上方按钮添加</p>}
                  </TabsContent>

                  <TabsContent value="versions" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><GitBranch className="h-4 w-4" />更新版本</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setVersions([...versions, { label: "", description: "" }])}><Plus className="h-4 w-4 mr-1" />添加版本</Button>
                    </div>
                    {versions.map((ver, i) => (
                      <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input
                            placeholder="版本标记，如：v1.0、v2.0 汉化版"
                            value={ver.label}
                            onChange={(e) => { const u = [...versions]; u[i] = { ...u[i], label: e.target.value }; setVersions(u); }}
                            className="flex-1"
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setVersions(versions.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <MdxEditor
                          value={ver.description}
                          onChange={(val) => { const u = [...versions]; u[i] = { ...u[i], description: val }; setVersions(u); }}
                          placeholder="版本描述（更新内容、注意事项等），支持 Markdown..."
                          maxLength={10000}
                          minHeight="100px"
                        />
                      </div>
                    ))}
                    {versions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无更新版本，点击上方按钮添加</p>}
                  </TabsContent>

                  <TabsContent value="customTabs" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" />自定义页面</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setCustomTabs([...customTabs, { title: "", icon: "file-text", content: "" }])}>
                        <Plus className="h-4 w-4 mr-1" />添加页面
                      </Button>
                    </div>
                    {customTabs.map((tab, i) => (
                      <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Select
                            value={tab.icon || "file-text"}
                            onValueChange={(val) => { const u = [...customTabs]; u[i] = { ...u[i], icon: val }; setCustomTabs(u); }}
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
                            onChange={(e) => { const u = [...customTabs]; u[i] = { ...u[i], title: e.target.value }; setCustomTabs(u); }}
                            className="flex-1"
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => setCustomTabs(customTabs.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <MdxEditor
                          value={tab.content}
                          onChange={(val) => { const u = [...customTabs]; u[i] = { ...u[i], content: val }; setCustomTabs(u); }}
                          placeholder="页面内容，支持 Markdown / MDX 语法..."
                          maxLength={50000}
                          minHeight="150px"
                        />
                      </div>
                    ))}
                    {customTabs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无自定义页面，点击上方按钮添加</p>}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">封面</CardTitle>
              </CardHeader>
              <CardContent>
                <CoverInput form={form} watchValue={gameCoverUrl} contentType="game" />
              </CardContent>
            </Card>

            <TagPicker
              allTags={allTags}
              selectedTags={selectedTags}
              newTags={newTags}
              onToggleTag={toggleTag}
              onAddNewTag={(name) => setNewTags([...newTags, name])}
              onRemoveNewTag={(name) => setNewTags(newTags.filter(t => t !== name))}
            />

            <Button type="submit" className="w-full h-11" disabled={isLoading} size="lg">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />发布中...</> : <><Gamepad2 className="mr-2 h-4 w-4" />发布游戏</>}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
