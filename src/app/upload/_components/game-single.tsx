"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { GAME_TYPES } from "@/lib/constants";
import { gameUploadSchema, type GameUploadForm } from "../_lib/schemas";
import { TagPicker } from "./tag-picker";
import { CoverInput } from "./cover-input";
import type { TagItem } from "../_lib/types";
import {
  Download, FileVideo, Gamepad2, Image as ImageIcon,
  Info, Link2, Loader2, Plus, Trash2,
} from "lucide-react";

export function GameSingleUpload() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([""]);
  const [videos, setVideos] = useState<string[]>([""]);
  const [downloads, setDownloads] = useState<{ name: string; url: string; password?: string }[]>([]);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 });
  const createMutation = trpc.game.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const form = useForm<GameUploadForm>({
    resolver: zodResolver(gameUploadSchema),
    defaultValues: {
      title: "", description: "", coverUrl: "", gameType: "",
      isFree: true, version: "", originalName: "", originalAuthor: "",
      originalAuthorUrl: "", fileSize: "", platforms: "",
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
      if (data.platforms) extraInfo.platforms = data.platforms.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const validScreenshots = screenshots.filter(s => s.trim());
      if (validScreenshots.length > 0) extraInfo.screenshots = validScreenshots;
      const validVideos = videos.filter(s => s.trim());
      if (validVideos.length > 0) extraInfo.videos = validVideos;
      if (downloads.length > 0) extraInfo.downloads = downloads.filter(d => d.url.trim());

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  游戏基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>游戏标题 *</FormLabel>
                    <FormControl><Input placeholder="输入游戏标题" {...field} className="text-base" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid gap-4 md:grid-cols-3">
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
                    <FormControl><Textarea placeholder="游戏介绍（可选）" className="min-h-[120px] resize-none" {...field} /></FormControl>
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
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  扩展信息
                </CardTitle>
                <CardDescription>原作信息、截图、下载链接等（可选）</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="origin" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="origin" className="text-xs">原作信息</TabsTrigger>
                    <TabsTrigger value="screenshots" className="text-xs">游戏截图</TabsTrigger>
                    <TabsTrigger value="videos" className="text-xs">游戏视频</TabsTrigger>
                    <TabsTrigger value="downloads" className="text-xs">下载链接</TabsTrigger>
                  </TabsList>

                  <TabsContent value="origin" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField control={form.control} name="fileSize" render={({ field }) => (
                        <FormItem><FormLabel>文件大小</FormLabel><FormControl><Input placeholder="如：2.5GB" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="platforms" render={({ field }) => (
                        <FormItem><FormLabel>支持平台</FormLabel><FormControl><Input placeholder="Windows, Mac, Android（逗号分隔）" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </TabsContent>

                  <TabsContent value="screenshots" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><ImageIcon className="h-4 w-4" />截图链接</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setScreenshots([...screenshots, ""])}><Plus className="h-4 w-4 mr-1" />添加截图</Button>
                    </div>
                    {screenshots.map((url, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="https://example.com/screenshot.jpg" value={url} onChange={(e) => { const u = [...screenshots]; u[i] = e.target.value; setScreenshots(u); }} className="pl-9" />
                        </div>
                        {screenshots.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setScreenshots(screenshots.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    {screenshots.some(s => s.trim()) && (
                      <div className="flex gap-2 flex-wrap mt-2">
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
                      <FormLabel className="flex items-center gap-2"><FileVideo className="h-4 w-4" />视频链接</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setVideos([...videos, ""])}><Plus className="h-4 w-4 mr-1" />添加视频</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">支持 mp4、webm 等直链或 m3u8 流媒体地址</p>
                    {videos.map((url, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="relative flex-1">
                          <FileVideo className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="https://example.com/preview.mp4" value={url} onChange={(e) => { const u = [...videos]; u[i] = e.target.value; setVideos(u); }} className="pl-9" />
                        </div>
                        {videos.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setVideos(videos.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="downloads" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <FormLabel className="flex items-center gap-2"><Download className="h-4 w-4" />下载链接</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDownloads([...downloads, { name: "", url: "", password: "" }])}><Plus className="h-4 w-4 mr-1" />添加链接</Button>
                    </div>
                    {downloads.map((dl, i) => (
                      <div key={i} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                        <div className="flex-1 grid gap-2 md:grid-cols-3">
                          <Input placeholder="网盘名称" value={dl.name} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], name: e.target.value }; setDownloads(u); }} />
                          <Input placeholder="下载链接" value={dl.url} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], url: e.target.value }; setDownloads(u); }} />
                          <Input placeholder="提取码（可选）" value={dl.password || ""} onChange={(e) => { const u = [...downloads]; u[i] = { ...u[i], password: e.target.value }; setDownloads(u); }} />
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

          {/* 右侧 */}
          <div className="space-y-6">
            <CoverInput form={form} watchValue={gameCoverUrl} />

            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading} size="lg">
              {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />发布中...</> : <><Gamepad2 className="mr-2 h-5 w-5" />发布游戏</>}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
