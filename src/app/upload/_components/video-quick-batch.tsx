"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { TagPicker } from "./tag-picker";
import { BatchProgressBar, VideoBatchResults } from "./batch-results";
import type { TagItem, VideoBatchResult, BatchProgress } from "../_lib/types";
import {
  GripVertical, Layers, Loader2, Plus, Trash2, Upload,
  FileVideo, Link2, ClipboardPaste, ArrowDown,
} from "lucide-react";

interface VideoEntry {
  id: string;
  title: string;
  videoUrl: string;
  coverUrl: string;
}

let entryCounter = 0;
function createEntry(videoUrl = "", title = ""): VideoEntry {
  return { id: `e-${++entryCounter}`, title, videoUrl, coverUrl: "" };
}

function extractTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const filename = path.split("/").pop() || "";
    const name = filename.replace(/\.[^.]+$/, "");
    return decodeURIComponent(name).replace(/[_-]+/g, " ").trim();
  } catch {
    return "";
  }
}

export function VideoQuickBatch() {
  const [entries, setEntries] = useState<VideoEntry[]>([createEntry()]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress>({ current: 0, total: 0 });
  const [results, setResults] = useState<VideoBatchResult[]>([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 });
  const { data: userSeries, refetch: refetchSeries } = trpc.series.listByUser.useQuery({ limit: 50 });
  const batchCreate = trpc.video.batchCreate.useMutation();
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

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find(t => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const validEntries = entries.filter(e => e.videoUrl.trim());

  const updateEntry = (id: string, field: keyof VideoEntry, value: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeEntry = (id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      return next.length === 0 ? [createEntry()] : next;
    });
  };

  const addEntry = () => {
    setEntries(prev => [...prev, createEntry()]);
  };

  const handlePasteUrls = () => {
    const lines = pasteText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && (l.startsWith("http://") || l.startsWith("https://")));

    if (lines.length === 0) {
      toast.error("未检测到有效的链接");
      return;
    }

    const newEntries = lines.map(url => createEntry(url, extractTitleFromUrl(url)));
    const existing = entries.filter(e => e.videoUrl.trim());
    setEntries([...existing, ...newEntries]);
    setPasteMode(false);
    setPasteText("");
    toast.success(`已添加 ${lines.length} 个视频链接`);
  };

  const handleAutoTitle = () => {
    setEntries(prev => prev.map(e => {
      if (e.videoUrl.trim() && !e.title.trim()) {
        return { ...e, title: extractTitleFromUrl(e.videoUrl) || e.title };
      }
      return e;
    }));
  };

  const handleSubmit = async () => {
    const valid = entries.filter(e => e.videoUrl.trim());
    if (valid.length === 0) {
      toast.error("至少需要一个视频链接");
      return;
    }

    const untitled = valid.filter(e => !e.title.trim());
    if (untitled.length > 0) {
      toast.error(`还有 ${untitled.length} 个视频未填写标题`);
      return;
    }

    setImporting(true);
    setResults([]);
    setProgress({ current: 0, total: 1 });

    try {
      const seriesTitle = selectedSeriesId
        ? userSeries?.items.find(s => s.id === selectedSeriesId)?.title
        : undefined;

      const res = await batchCreate.mutateAsync({
        seriesTitle: seriesTitle || undefined,
        videos: valid.map(e => ({
          title: e.title.trim(),
          videoUrl: e.videoUrl.trim(),
          coverUrl: e.coverUrl.trim() || "",
          tagNames: [...selectedTags.map(t => t.name), ...newTags],
        })),
      });

      setProgress({ current: 1, total: 1 });
      const allResults = res.results.map(r => ({
        title: r.title,
        seriesTitle,
        id: r.id,
        error: r.error,
        merged: r.merged,
      }));

      const success = allResults.filter(r => r.id).length;
      const fail = allResults.filter(r => r.error).length;
      toast.success(`发布完成：${success} 成功${fail > 0 ? `，${fail} 失败` : ""}`);
      setResults(allResults);
      refetchSeries();

      if (fail === 0) {
        setEntries([createEntry()]);
      }
    } catch (err) {
      toast.error("批量发布失败", {
        description: err instanceof Error ? err.message : "未知错误",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 视频列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileVideo className="h-5 w-5" />
                视频列表
              </CardTitle>
              <CardDescription>
                {validEntries.length > 0
                  ? `已添加 ${validEntries.length} 个视频`
                  : "逐条添加或批量粘贴链接"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={pasteMode ? "default" : "outline"}
                size="sm"
                onClick={() => setPasteMode(!pasteMode)}
              >
                <ClipboardPaste className="h-4 w-4 mr-1" />
                批量粘贴
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 批量粘贴区域 */}
          {pasteMode && (
            <div className="space-y-3 p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
              <p className="text-sm font-medium">粘贴视频链接（每行一个）</p>
              <Textarea
                placeholder={"https://example.com/video1.mp4\nhttps://example.com/video2.mp4\nhttps://example.com/video3.mp4"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="min-h-[120px] font-mono text-sm"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" onClick={handlePasteUrls} disabled={!pasteText.trim()}>
                  <ArrowDown className="h-4 w-4 mr-1" />
                  解析并添加
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPasteMode(false); setPasteText(""); }}>
                  取消
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  检测到 {pasteText.split("\n").filter(l => l.trim().startsWith("http")).length} 个链接
                </span>
              </div>
            </div>
          )}

          {/* 视频条目列表 */}
          <ScrollArea className={entries.length > 5 ? "max-h-[500px]" : ""}>
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    "group flex gap-3 items-start p-3 rounded-lg border transition-colors",
                    entry.videoUrl.trim()
                      ? "bg-card hover:bg-muted/30"
                      : "bg-muted/20 border-dashed",
                  )}
                >
                  {/* 序号 */}
                  <div className="flex items-center gap-1 pt-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <span className="text-sm font-medium text-muted-foreground tabular-nums w-5 text-right">
                      {index + 1}
                    </span>
                  </div>

                  {/* 表单内容 */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex gap-2">
                      <Input
                        placeholder="视频标题"
                        value={entry.title}
                        onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                        className={cn("flex-1", !entry.title.trim() && entry.videoUrl.trim() && "border-yellow-400")}
                      />
                    </div>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="https://example.com/video.mp4"
                        value={entry.videoUrl}
                        onChange={(e) => updateEntry(entry.id, "videoUrl", e.target.value)}
                        className="pl-9"
                        onPaste={(e) => {
                          const text = e.clipboardData.getData("text");
                          const lines = text.split("\n").filter(l => l.trim().startsWith("http"));
                          if (lines.length > 1) {
                            e.preventDefault();
                            const newEntries = lines.map(url => createEntry(url.trim(), extractTitleFromUrl(url.trim())));
                            const before = entries.slice(0, index);
                            const after = entries.slice(index + 1);
                            const current = entry.videoUrl.trim() ? [entry] : [];
                            setEntries([...before, ...current, ...newEntries, ...after]);
                            toast.success(`已粘贴 ${lines.length} 个链接`);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* 删除按钮 */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* 添加更多 + 自动标题 */}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={addEntry}>
              <Plus className="h-4 w-4 mr-1" />
              添加视频
            </Button>
            {validEntries.some(e => !e.title.trim()) && (
              <Button type="button" variant="ghost" size="sm" onClick={handleAutoTitle}>
                <FileVideo className="h-4 w-4 mr-1" />
                自动填充标题
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 共享设置：合集 + 标签 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 合集选择 */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                合集
              </CardTitle>
              {selectedSeriesId && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSeriesId(null)}>
                  取消选择
                </Button>
              )}
            </div>
            <CardDescription>将所有视频添加到同一合集（可选）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showCreateSeries ? (
              <>
                <Select
                  value={selectedSeriesId || ""}
                  onValueChange={(v) => setSelectedSeriesId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择合集..." />
                  </SelectTrigger>
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
              </>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="合集名称"
                  value={newSeriesTitle}
                  onChange={(e) => setNewSeriesTitle(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setShowCreateSeries(false); setNewSeriesTitle(""); }}>
                    取消
                  </Button>
                  <Button
                    type="button" size="sm" className="flex-1"
                    disabled={!newSeriesTitle.trim() || createSeriesMutation.isPending}
                    onClick={() => { if (newSeriesTitle.trim()) createSeriesMutation.mutate({ title: newSeriesTitle.trim() }); }}
                  >
                    {createSeriesMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    创建
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 共享标签 */}
        <TagPicker
          allTags={allTags}
          selectedTags={selectedTags}
          newTags={newTags}
          onToggleTag={toggleTag}
          onAddNewTag={(name) => setNewTags([...newTags, name])}
          onRemoveNewTag={(name) => setNewTags(newTags.filter(t => t !== name))}
        />
      </div>

      {/* 发布按钮 */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {validEntries.length > 0 ? (
                <span>
                  共 <strong className="text-foreground">{validEntries.length}</strong> 个视频
                  {selectedSeriesId && (
                    <>
                      {" → "}
                      <Badge variant="outline" className="text-xs">
                        <Layers className="h-3 w-3 mr-1" />
                        {userSeries?.items.find(s => s.id === selectedSeriesId)?.title}
                      </Badge>
                    </>
                  )}
                  {(selectedTags.length + newTags.length) > 0 && (
                    <span className="ml-1">· {selectedTags.length + newTags.length} 个标签</span>
                  )}
                </span>
              ) : (
                "请先添加视频"
              )}
            </div>
            <Button
              type="button"
              size="lg"
              className="min-w-[160px]"
              onClick={handleSubmit}
              disabled={validEntries.length === 0 || importing}
            >
              {importing ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />发布中...</>
              ) : (
                <><Upload className="mr-2 h-5 w-5" />批量发布 ({validEntries.length})</>
              )}
            </Button>
          </div>
          <BatchProgressBar progress={progress} label="批" isActive={importing} />
        </CardContent>
      </Card>

      {/* 结果 */}
      <VideoBatchResults results={results} importing={importing} />
    </div>
  );
}
