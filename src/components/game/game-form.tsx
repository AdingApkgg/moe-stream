"use client";

import { useState, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { gameFormSchema, type GameFormData, type TagItem } from "@/lib/schemas/content";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useSiteConfig } from "@/contexts/site-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostEditor } from "@/components/editor/post-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { GAME_TYPES, GAME_PLATFORMS } from "@/lib/constants";
import { TagPicker } from "@/components/shared/tag-picker";
import { CoverInput } from "@/components/shared/cover-input";
import {
  ChevronDown,
  Download,
  FileVideo,
  FolderOpen,
  Gamepad2,
  GitBranch,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  Monitor,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { TAB_ICON_OPTIONS } from "@/lib/game-tab-icons";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";
import { FileUploader, type UploadedFile } from "@/components/files/file-uploader";
import { FilePickerDialog } from "@/components/shared/file-picker-dialog";
import { cn } from "@/lib/utils";

export interface GameExtraInfo {
  originalName?: string;
  originalAuthor?: string;
  originalAuthorUrl?: string;
  fileSize?: string;
  platforms?: string[];
  screenshots?: string[];
  videos?: string[];
  downloads?: { name: string; url: string; password?: string }[];
}

export interface GameVersion {
  id?: string;
  label: string;
  description: string;
}

export interface GameCustomTab {
  id?: string;
  title: string;
  icon: string;
  content: string;
}

export interface GameSubmitData {
  title: string;
  description?: string;
  coverUrl?: string;
  gameType?: string;
  version?: string;
  isFree: boolean;
  isNsfw: boolean;
  tagIds: string[];
  tagNames: string[];
  existingTagNames: string[];
  aliases?: string[];
  extraInfo?: Record<string, unknown>;
  versions?: { id?: string; label: string; description?: string }[];
  customTabs?: { id?: string; title: string; icon?: string; content: string }[];
}

interface GameFormProps {
  mode: "create" | "edit";
  initialData?: {
    title: string;
    description?: string;
    coverUrl?: string;
    gameType?: string;
    version?: string;
    isFree: boolean;
    isNsfw: boolean;
    tags: TagItem[];
    aliases?: string[];
    extraInfo?: GameExtraInfo;
    versions?: GameVersion[];
    customTabs?: GameCustomTab[];
  };
  gameId?: string;
  tagQueryType?: "video" | "game" | "image";
  onSubmit: (data: GameSubmitData) => Promise<void>;
  isSubmitting: boolean;
}

export function GameForm({ mode, initialData, gameId, tagQueryType, onSubmit, isSubmitting }: GameFormProps) {
  const siteConfig = useSiteConfig();
  const uploadEnabled = siteConfig?.fileUploadEnabled ?? false;

  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [extraOpen, setExtraOpen] = useState(mode === "edit");

  const [originalName, setOriginalName] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [originalAuthorUrl, setOriginalAuthorUrl] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);

  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [screenshotTab, setScreenshotTab] = useState<string>(uploadEnabled ? "upload" : "link");
  const [screenshotLinkInput, setScreenshotLinkInput] = useState("");
  const [screenshotPickerOpen, setScreenshotPickerOpen] = useState(false);

  const [videos, setVideos] = useState<string[]>([]);
  const [videoTab, setVideoTab] = useState<string>(uploadEnabled ? "upload" : "link");
  const [videoLinkInput, setVideoLinkInput] = useState("");
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);

  const [downloads, setDownloads] = useState<{ name: string; url: string; password?: string }[]>([]);
  const [versions, setVersions] = useState<GameVersion[]>([]);
  const [customTabs, setCustomTabs] = useState<GameCustomTab[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasInput, setAliasInput] = useState("");

  const tagQuery = tagQueryType ? { limit: 100, type: tagQueryType } : { limit: 100 };
  const { data: allTags } = trpc.tag.list.useQuery(tagQuery, { staleTime: 10 * 60 * 1000 });
  const { data: usedAuthors } = trpc.user.usedAuthors.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const form = useForm<GameFormData>({
    resolver: zodResolver(gameFormSchema),
    defaultValues: {
      title: "",
      description: "",
      coverUrl: "",
      gameType: "",
      version: "",
      isFree: true,
    },
  });

  const gameCoverUrl = useWatch({ control: form.control, name: "coverUrl" });
  const watched = useWatch({ control: form.control });

  const draftSnapshot = useMemo(
    () => ({
      form: watched,
      selectedTags,
      newTags,
      isNsfw,
      originalName,
      originalAuthor,
      originalAuthorUrl,
      fileSize,
      platforms,
      screenshots,
      videos,
      downloads,
      versions,
      customTabs,
      aliases,
    }),
    [
      watched,
      selectedTags,
      newTags,
      isNsfw,
      originalName,
      originalAuthor,
      originalAuthorUrl,
      fileSize,
      platforms,
      screenshots,
      videos,
      downloads,
      versions,
      customTabs,
      aliases,
    ],
  );
  const { clearDraft } = useFormDraft({
    key: "moe.draft.game.create",
    value: draftSnapshot,
    enabled: mode === "create",
    isEmpty: (s) =>
      !s.form?.title &&
      !s.form?.description &&
      !s.form?.coverUrl &&
      !s.form?.gameType &&
      !s.form?.version &&
      (s.selectedTags?.length ?? 0) === 0 &&
      (s.newTags?.length ?? 0) === 0 &&
      !s.originalName &&
      !s.originalAuthor &&
      (s.aliases?.length ?? 0) === 0 &&
      (s.versions?.length ?? 0) === 0 &&
      (s.customTabs?.length ?? 0) === 0 &&
      (s.downloads?.length ?? 0) === 0 &&
      !(s.screenshots ?? []).some((x: string) => x.trim()) &&
      !(s.videos ?? []).some((x: string) => x.trim()),
    onRestore: (s) => {
      form.reset({
        title: s.form?.title || "",
        description: s.form?.description || "",
        coverUrl: s.form?.coverUrl || "",
        gameType: s.form?.gameType || "",
        version: s.form?.version || "",
        isFree: s.form?.isFree ?? true,
      });
      if (s.selectedTags) setSelectedTags(s.selectedTags);
      if (s.newTags) setNewTags(s.newTags);
      if (typeof s.isNsfw === "boolean") setIsNsfw(s.isNsfw);
      if (typeof s.originalName === "string") setOriginalName(s.originalName);
      if (typeof s.originalAuthor === "string") setOriginalAuthor(s.originalAuthor);
      if (typeof s.originalAuthorUrl === "string") setOriginalAuthorUrl(s.originalAuthorUrl);
      if (typeof s.fileSize === "string") setFileSize(s.fileSize);
      if (s.platforms) setPlatforms(s.platforms);
      if (s.screenshots) setScreenshots(s.screenshots);
      if (s.videos) setVideos(s.videos);
      if (s.downloads) setDownloads(s.downloads);
      if (s.versions) setVersions(s.versions);
      if (s.customTabs) setCustomTabs(s.customTabs);
      if (s.aliases) setAliases(s.aliases);
      setExtraOpen(true);
    },
  });

  // 仅在初次加载到 initialData 时回填表单与本地状态，
  // 避免后续 tRPC refetch（如窗口聚焦）覆盖用户正在编辑的内容
  const [hasInitialized, setHasInitialized] = useState(false);
  if (initialData && !hasInitialized) {
    setHasInitialized(true);
    form.reset({
      title: initialData.title,
      description: initialData.description || "",
      coverUrl: initialData.coverUrl || "",
      gameType: initialData.gameType || "",
      version: initialData.version || "",
      isFree: initialData.isFree,
    });
    setSelectedTags(initialData.tags);
    setIsNsfw(initialData.isNsfw);

    if (initialData.extraInfo) {
      const ei = initialData.extraInfo;
      setOriginalName(ei.originalName || "");
      setOriginalAuthor(ei.originalAuthor || "");
      setOriginalAuthorUrl(ei.originalAuthorUrl || "");
      setFileSize(ei.fileSize || "");
      setPlatforms(ei.platforms || []);
      setScreenshots(ei.screenshots || (mode === "edit" ? [""] : []));
      setVideos(ei.videos || (mode === "edit" ? [""] : []));
      setDownloads(ei.downloads || []);
    } else if (mode === "edit") {
      setScreenshots([""]);
      setVideos([""]);
    }

    if (initialData.versions?.length) {
      setVersions(initialData.versions);
    }
    if (initialData.customTabs?.length) {
      setCustomTabs(initialData.customTabs);
    }
    if (initialData.aliases?.length) {
      setAliases(initialData.aliases);
    }
  }

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find((t) => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const extraFilledCount = useMemo(() => {
    let count = 0;
    if (originalName || originalAuthor || aliases.length > 0) count++;
    if (screenshots.filter((s) => s.trim()).length > 0) count++;
    if (videos.filter((v) => v.trim()).length > 0) count++;
    if (downloads.length > 0) count++;
    if (versions.length > 0) count++;
    if (customTabs.length > 0) count++;
    return count;
  }, [originalName, originalAuthor, aliases, screenshots, videos, downloads, versions, customTabs]);

  const handleSubmit = async (data: GameFormData) => {
    const extraInfo: Record<string, unknown> = {};
    if (originalName) extraInfo.originalName = originalName;
    if (originalAuthor) extraInfo.originalAuthor = originalAuthor;
    if (originalAuthorUrl) extraInfo.originalAuthorUrl = originalAuthorUrl;
    if (fileSize) extraInfo.fileSize = fileSize;
    if (platforms.length > 0) extraInfo.platforms = platforms;
    const validScreenshots = screenshots.filter((s) => s.trim());
    if (validScreenshots.length > 0) extraInfo.screenshots = validScreenshots;
    const validVideos = videos.filter((v) => v.trim());
    if (validVideos.length > 0) extraInfo.videos = validVideos;
    const validDownloads = downloads.filter((d) => d.url.trim());
    if (validDownloads.length > 0) extraInfo.downloads = validDownloads;

    const validVersions = versions
      .filter((v) => v.label.trim())
      .map((v) => ({ id: v.id, label: v.label, description: v.description || undefined }));

    const validCustomTabs = customTabs
      .filter((t) => t.title.trim() && t.content.trim())
      .map((t) => ({ id: t.id, title: t.title, icon: t.icon || undefined, content: t.content }));

    const normalizedAliases = Array.from(
      new Map(
        aliases
          .map((a) => a.trim())
          .filter(Boolean)
          .map((a) => [a.toLowerCase(), a] as const),
      ).values(),
    ).slice(0, 20);

    await onSubmit({
      title: data.title,
      description: data.description || undefined,
      // 保留空字符串以便清空封面（服务端会把 "" 归一为 null）
      coverUrl: data.coverUrl ?? "",
      gameType: data.gameType || undefined,
      version: data.version || undefined,
      isFree: data.isFree,
      isNsfw,
      tagIds: selectedTags.map((t) => t.id),
      tagNames: newTags,
      existingTagNames: selectedTags.map((t) => t.name),
      aliases: normalizedAliases,
      extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
      versions: validVersions.length > 0 ? validVersions : undefined,
      customTabs: validCustomTabs.length > 0 ? validCustomTabs : undefined,
    });
    if (mode === "create") clearDraft();
  };

  const commitAliasInput = () => {
    const raw = aliasInput.trim();
    if (!raw) return;
    const parts = raw
      .split(/[,，\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const lowerExisting = new Set(aliases.map((a) => a.toLowerCase()));
    const toAdd: string[] = [];
    for (const p of parts) {
      const k = p.toLowerCase();
      if (lowerExisting.has(k)) continue;
      lowerExisting.add(k);
      toAdd.push(p);
    }
    if (toAdd.length > 0) {
      setAliases((prev) => [...prev, ...toAdd].slice(0, 20));
    }
    setAliasInput("");
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
          {mode === "create" ? <Gamepad2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          {mode === "create" ? "发布游戏" : "保存修改"}
        </>
      )}
    </Button>
  );

  const renderMediaSection = (
    type: "screenshots" | "videos",
    label: string,
    icon: React.ReactNode,
    urls: string[],
    setUrls: React.Dispatch<React.SetStateAction<string[]>>,
    tabValue: string,
    setTabValue: (v: string) => void,
    linkInput: string,
    setLinkInput: (v: string) => void,
    pickerOpen: boolean,
    setPickerOpen: (v: boolean) => void,
    accept: string,
    mimePrefix: string,
    maxFiles: number,
    contentType: "game",
  ) => (
    <TabsContent value={type} className="space-y-4 mt-4">
      <FormLabel className="flex items-center gap-2">
        {icon}
        {label}
      </FormLabel>

      {mode === "create" ? (
        <>
          <Tabs value={tabValue} onValueChange={setTabValue}>
            <TabsList className="h-8 p-0.5">
              {uploadEnabled && (
                <TabsTrigger value="upload" className="text-xs h-7 gap-1 px-2.5">
                  <Upload className="h-3.5 w-3.5" />
                  上传
                </TabsTrigger>
              )}
              <TabsTrigger value="link" className="text-xs h-7 gap-1 px-2.5">
                <Link2 className="h-3.5 w-3.5" />
                外链
              </TabsTrigger>
              {uploadEnabled && (
                <TabsTrigger value="files" className="text-xs h-7 gap-1 px-2.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  我的文件
                </TabsTrigger>
              )}
            </TabsList>

            {uploadEnabled && (
              <TabsContent value="upload" className="mt-2">
                <FileUploader
                  contentType={contentType}
                  accept={accept}
                  maxFiles={maxFiles}
                  onFileUploaded={(file: UploadedFile) => setUrls((prev) => [...prev, file.url])}
                  compact
                />
              </TabsContent>
            )}

            <TabsContent value="link" className="mt-2 space-y-2">
              <Textarea
                placeholder={`粘贴链接，每行一个`}
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!linkInput.trim()}
                  onClick={() => {
                    const newUrls = linkInput
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);
                    if (newUrls.length > 0) {
                      setUrls((prev) => [...prev, ...newUrls]);
                      setLinkInput("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                  {linkInput.split("\n").filter((l) => l.trim()).length > 1
                    ? `（${linkInput.split("\n").filter((l) => l.trim()).length} 条）`
                    : ""}
                </Button>
              </div>
            </TabsContent>

            {uploadEnabled && (
              <TabsContent value="files" className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-16 border-dashed flex flex-col gap-1"
                  onClick={() => setPickerOpen(true)}
                >
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">从我的文件中选择（可多选）</span>
                </Button>
                <FilePickerDialog
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  onSelect={(url) => {
                    setUrls((prev) => [...prev, url]);
                    setPickerOpen(false);
                  }}
                  onSelectMultiple={(u) => {
                    setUrls((prev) => [...prev, ...u]);
                    setPickerOpen(false);
                  }}
                  multiple
                  mimePrefix={mimePrefix}
                />
              </TabsContent>
            )}
          </Tabs>
        </>
      ) : (
        /* 编辑模式：URL 行列表 */
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              已添加 {urls.filter((s) => s.trim()).length} {type === "screenshots" ? "张截图" : "个视频"}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setUrls([...urls.filter(Boolean), ""])}>
              <Plus className="h-4 w-4 mr-1" />
              添加{type === "screenshots" ? "截图" : "视频"}
            </Button>
          </div>
          {urls.map((url, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <UrlOrUploadInput
                  value={url}
                  onChange={(v) => {
                    const s = [...urls];
                    s[i] = v;
                    setUrls(s);
                  }}
                  accept={accept}
                  placeholder={
                    type === "screenshots" ? "https://example.com/screenshot.jpg" : "https://example.com/preview.mp4"
                  }
                  contentType={contentType}
                  contentId={gameId}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0"
                onClick={() => setUrls(urls.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 预览 */}
      {type === "screenshots" && urls.filter((s) => s.trim()).length > 0 && (
        <div className="space-y-2">
          {mode === "create" && (
            <p className="text-xs text-muted-foreground">已添加 {urls.filter((s) => s.trim()).length} 张截图</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {urls
              .filter((s) => s.trim())
              .map((url, i) => (
                <div key={i} className="relative group w-24 h-16 rounded border overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`截图 ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  {mode === "create" && (
                    <button
                      type="button"
                      className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {type === "videos" && urls.filter((v) => v.trim()).length > 0 && mode === "create" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">已添加 {urls.filter((v) => v.trim()).length} 个视频</p>
          <div className="space-y-1">
            {urls
              .filter((v) => v.trim())
              .map((url, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-muted-foreground">{url}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </TabsContent>
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
                      <FormLabel>游戏标题 *</FormLabel>
                      <FormControl>
                        <Input placeholder="输入游戏标题" {...field} className="text-base" />
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
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GAME_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
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
                          <Input placeholder="Ver1.0.0" {...field} />
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
                        <PostEditor
                          variant="doc"
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

            {/* 扩展信息 */}
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

                      {/* 原作信息 */}
                      <TabsContent value="origin" className="space-y-4 mt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <FormLabel>原作名称</FormLabel>
                            <Input
                              value={originalName}
                              onChange={(e) => setOriginalName(e.target.value)}
                              placeholder="游戏原名（日/英文）"
                            />
                          </div>
                          <div className="space-y-2">
                            <FormLabel>原作作者</FormLabel>
                            <Input
                              value={originalAuthor}
                              onChange={(e) => setOriginalAuthor(e.target.value)}
                              placeholder="开发者/社团名称"
                              list="used-authors"
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
                          <FormLabel>原作链接</FormLabel>
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
                        <div className="space-y-2">
                          <FormLabel className="flex items-center justify-between">
                            <span>搜索别名（可选）</span>
                            <span className="text-xs text-muted-foreground font-normal">{aliases.length}/20</span>
                          </FormLabel>
                          <div className="flex flex-wrap gap-1.5 min-h-9 p-2 rounded-md border bg-background">
                            {aliases.map((a) => (
                              <Badge key={a} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                                {a}
                                <button
                                  type="button"
                                  onClick={() => setAliases(aliases.filter((x) => x !== a))}
                                  className="hover:text-destructive"
                                  aria-label={`移除 ${a}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            <input
                              value={aliasInput}
                              onChange={(e) => setAliasInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === ",") {
                                  e.preventDefault();
                                  commitAliasInput();
                                } else if (e.key === "Backspace" && !aliasInput && aliases.length > 0) {
                                  setAliases(aliases.slice(0, -1));
                                }
                              }}
                              onBlur={commitAliasInput}
                              placeholder={aliases.length === 0 ? "输入别名回车，如：P5R、女神异闻录5皇家版" : ""}
                              className="flex-1 min-w-[10ch] bg-transparent outline-none text-sm"
                              disabled={aliases.length >= 20}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            支持原作名 / 缩写 / 昵称，搜索时会一并匹配；回车或逗号分隔
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <FormLabel>文件大小</FormLabel>
                            <Input
                              value={fileSize}
                              onChange={(e) => setFileSize(e.target.value)}
                              placeholder="如：2.5GB"
                            />
                          </div>
                          <div className="space-y-2">
                            <FormLabel className="flex items-center gap-1">
                              <Monitor className="h-3.5 w-3.5" />
                              支持平台
                            </FormLabel>
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

                      {/* 截图 */}
                      {renderMediaSection(
                        "screenshots",
                        "截图",
                        <ImageIcon className="h-4 w-4" />,
                        screenshots,
                        setScreenshots,
                        screenshotTab,
                        setScreenshotTab,
                        screenshotLinkInput,
                        setScreenshotLinkInput,
                        screenshotPickerOpen,
                        setScreenshotPickerOpen,
                        "image/*",
                        "image/",
                        20,
                        "game",
                      )}

                      {/* 视频 */}
                      {renderMediaSection(
                        "videos",
                        "预览视频",
                        <FileVideo className="h-4 w-4" />,
                        videos,
                        setVideos,
                        videoTab,
                        setVideoTab,
                        videoLinkInput,
                        setVideoLinkInput,
                        videoPickerOpen,
                        setVideoPickerOpen,
                        "video/*,.m3u8",
                        "video/",
                        10,
                        "game",
                      )}

                      {/* 下载链接 */}
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
                            onClick={() => setDownloads([...downloads, { name: "", url: "", password: "" }])}
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
                              contentId={gameId}
                            />
                          </div>
                        ))}
                        {downloads.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无下载链接，点击上方按钮添加
                          </p>
                        )}
                      </TabsContent>

                      {/* 更新版本 */}
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
                            <PostEditor
                              variant="doc"
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
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无更新版本，点击上方按钮添加
                          </p>
                        )}
                      </TabsContent>

                      {/* 自定义页面 */}
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
                            onClick={() =>
                              setCustomTabs([...customTabs, { title: "", icon: "file-text", content: "" }])
                            }
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
                            <PostEditor
                              variant="doc"
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
                <CoverInput form={form} watchValue={gameCoverUrl} contentType="game" contentId={gameId} />
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

        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur-sm border-t lg:hidden z-40">
          {submitButton}
        </div>
      </form>
    </Form>
  );
}
