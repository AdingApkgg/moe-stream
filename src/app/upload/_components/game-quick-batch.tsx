"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { GAME_TYPES } from "@/lib/constants";
import { TagPicker } from "./tag-picker";
import { BatchProgressBar, GameBatchResults } from "./batch-results";
import type { TagItem, GameBatchResult, BatchProgress } from "../_lib/types";
import {
  ChevronDown, ChevronUp, Download, Gamepad2,
  GripVertical, Loader2, Plus, Trash2, Upload,
} from "lucide-react";

interface GameEntry {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  gameType: string;
  isFree: boolean;
  version: string;
  downloads: { name: string; url: string; password?: string }[];
  expanded: boolean;
}

let entryCounter = 0;
function createGameEntry(): GameEntry {
  return {
    id: `g-${++entryCounter}`,
    title: "", description: "", coverUrl: "", gameType: "",
    isFree: true, version: "",
    downloads: [],
    expanded: true,
  };
}

export function GameQuickBatch() {
  const [entries, setEntries] = useState<GameEntry[]>([createGameEntry()]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress>({ current: 0, total: 0 });
  const [results, setResults] = useState<GameBatchResult[]>([]);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 });
  const batchCreate = trpc.game.batchCreate.useMutation();

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find(t => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const validEntries = entries.filter(e => e.title.trim());

  const updateEntry = (id: string, updates: Partial<GameEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const removeEntry = (id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      return next.length === 0 ? [createGameEntry()] : next;
    });
  };

  const addEntry = () => {
    setEntries(prev => {
      const collapsed = prev.map(e => ({ ...e, expanded: false }));
      return [...collapsed, createGameEntry()];
    });
  };

  const toggleExpand = (id: string) => {
    updateEntry(id, { expanded: !entries.find(e => e.id === id)?.expanded });
  };

  const addDownload = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { downloads: [...entry.downloads, { name: "", url: "", password: "" }] });
  };

  const updateDownload = (entryId: string, idx: number, field: string, value: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    const dls = [...entry.downloads];
    dls[idx] = { ...dls[idx], [field]: value };
    updateEntry(entryId, { downloads: dls });
  };

  const removeDownload = (entryId: string, idx: number) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { downloads: entry.downloads.filter((_, i) => i !== idx) });
  };

  const handleSubmit = async () => {
    if (validEntries.length === 0) {
      toast.error("至少需要一个游戏标题");
      return;
    }

    setImporting(true);
    setResults([]);
    const CHUNK = 100;
    const totalChunks = Math.ceil(validEntries.length / CHUNK);
    setProgress({ current: 0, total: totalChunks });
    const allResults: GameBatchResult[] = [];

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = validEntries.slice(i * CHUNK, (i + 1) * CHUNK);
        try {
          const res = await batchCreate.mutateAsync({
            games: chunk.map(e => {
              const extraInfo: Record<string, unknown> = {};
              const validDls = e.downloads.filter(d => d.url.trim());
              if (validDls.length > 0) extraInfo.downloads = validDls;
              return {
                title: e.title.trim(),
                description: e.description.trim() || undefined,
                coverUrl: e.coverUrl.trim() || undefined,
                gameType: e.gameType || undefined,
                isFree: e.isFree,
                version: e.version.trim() || undefined,
                tagNames: [...selectedTags.map(t => t.name), ...newTags],
                extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
              };
            }),
          });
          allResults.push(...res.results);
        } catch (err) {
          allResults.push(...chunk.map(g => ({
            title: g.title,
            error: err instanceof Error ? err.message : "未知错误",
          })));
        }
        setProgress({ current: i + 1, total: totalChunks });
        setResults([...allResults]);
      }

      const newC = allResults.filter(r => r.id && !r.updated).length;
      const updC = allResults.filter(r => r.updated).length;
      const failC = allResults.filter(r => r.error).length;
      toast.success(`发布完成：新建 ${newC}${updC ? `，更新 ${updC}` : ""}${failC ? `，失败 ${failC}` : ""}`);
      setResults(allResults);

      if (failC === 0) {
        setEntries([createGameEntry()]);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 游戏条目列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                游戏列表
              </CardTitle>
              <CardDescription>
                {validEntries.length > 0
                  ? `已添加 ${validEntries.length} 个游戏`
                  : "逐条添加游戏信息"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className={entries.length > 3 ? "h-[600px]" : ""}>
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={cn(
                    "group rounded-lg border transition-colors",
                    entry.title.trim() ? "bg-card" : "bg-muted/20 border-dashed",
                  )}
                >
                  {/* 折叠头部 */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-sm font-medium text-muted-foreground tabular-nums w-5 text-right shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      {entry.title.trim() ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{entry.title}</span>
                          {entry.gameType && <Badge variant="default" className="text-[10px] py-0">{entry.gameType}</Badge>}
                          <Badge variant={entry.isFree ? "secondary" : "outline"} className="text-[10px] py-0">
                            {entry.isFree ? "免费" : "付费"}
                          </Badge>
                          {entry.downloads.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              <Download className="h-2.5 w-2.5 inline mr-0.5" />{entry.downloads.filter(d => d.url.trim()).length} 下载
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">未填写</span>
                      )}
                    </div>
                    {entry.expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 展开内容 */}
                  {entry.expanded && (
                    <div className="px-3 pb-3 space-y-3 border-t">
                      <div className="pt-3 space-y-3">
                        {/* 标题 */}
                        <Input
                          placeholder="游戏标题 *"
                          value={entry.title}
                          onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                          className={cn("text-base", !entry.title.trim() && "border-yellow-400")}
                          autoFocus={!entry.title.trim()}
                        />

                        {/* 类型 + 版本 + 免费 */}
                        <div className="grid grid-cols-3 gap-2">
                          <Select value={entry.gameType} onValueChange={(v) => updateEntry(entry.id, { gameType: v })}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="游戏类型" />
                            </SelectTrigger>
                            <SelectContent>
                              {GAME_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="版本号"
                            value={entry.version}
                            onChange={(e) => updateEntry(entry.id, { version: e.target.value })}
                            className="h-9 text-sm"
                          />
                          <div className="flex items-center justify-between rounded-md border px-3 h-9">
                            <span className="text-sm text-muted-foreground">免费</span>
                            <Switch
                              checked={entry.isFree}
                              onCheckedChange={(v) => updateEntry(entry.id, { isFree: v })}
                            />
                          </div>
                        </div>

                        {/* 简介 */}
                        <Textarea
                          placeholder="游戏介绍（可选）"
                          value={entry.description}
                          onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                          className="min-h-[60px] resize-none text-sm"
                        />

                        {/* 封面 */}
                        <Input
                          placeholder="封面图片链接（可选）"
                          value={entry.coverUrl}
                          onChange={(e) => updateEntry(entry.id, { coverUrl: e.target.value })}
                          className="text-sm"
                        />

                        {/* 下载链接 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1.5">
                              <Download className="h-4 w-4" />
                              下载链接
                            </span>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addDownload(entry.id)}>
                              <Plus className="h-3 w-3 mr-1" />添加
                            </Button>
                          </div>
                          {entry.downloads.map((dl, di) => (
                            <div key={di} className="flex gap-2 items-center">
                              <Input placeholder="网盘名" value={dl.name} onChange={(e) => updateDownload(entry.id, di, "name", e.target.value)} className="h-8 text-xs flex-[2]" />
                              <Input placeholder="下载链接" value={dl.url} onChange={(e) => updateDownload(entry.id, di, "url", e.target.value)} className="h-8 text-xs flex-[4]" />
                              <Input placeholder="密码" value={dl.password || ""} onChange={(e) => updateDownload(entry.id, di, "password", e.target.value)} className="h-8 text-xs flex-[1.5]" />
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeDownload(entry.id, di)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button type="button" variant="outline" size="sm" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-1" />
            添加游戏
          </Button>
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

      {/* 发布按钮 */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {validEntries.length > 0 ? (
                <span>
                  共 <strong className="text-foreground">{validEntries.length}</strong> 个游戏
                  {(selectedTags.length + newTags.length) > 0 && (
                    <span className="ml-1">· {selectedTags.length + newTags.length} 个标签</span>
                  )}
                </span>
              ) : (
                "请先添加游戏"
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
      <GameBatchResults results={results} importing={importing} />
    </div>
  );
}
