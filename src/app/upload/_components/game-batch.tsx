"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { Download, DownloadCloud, FileText, FileVideo, Image as ImageIcon, Loader2, Tag, Upload } from "lucide-react";
import { DropZone } from "./drop-zone";
import { BatchProgressBar, GameBatchResults } from "./batch-results";
import { parseGameBatchJson, buildGameExtraInfo, downloadTemplate, GAME_BATCH_TEMPLATE } from "../_lib/parsers";
import type { ParsedGameBatchData, ParsedGame, GameBatchResult, BatchProgress } from "../_lib/types";

const CHUNK_SIZE = 100;

export function GameBatchUpload() {
  const [parsed, setParsed] = useState<ParsedGameBatchData | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress>({ current: 0, total: 0 });
  const [results, setResults] = useState<GameBatchResult[]>([]);

  const batchCreate = trpc.game.batchCreate.useMutation();

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast.error("请选择 JSON 文件");
      return;
    }
    setFileName(file.name);
    setParsed(null);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const result = parseGameBatchJson(data);
        if (result.games.length === 0 || !result.games[0].title) {
          toast.error("JSON 文件中未找到有效游戏数据");
          return;
        }
        setParsed(result);
        toast.success(`解析成功：${result.games.length} 个游戏`);
      } catch {
        toast.error("JSON 文件解析失败，请检查文件格式");
      }
    };
    reader.readAsText(file);
  };

  const importGames = async (games: ParsedGame[], prevResults: GameBatchResult[] = []): Promise<GameBatchResult[]> => {
    const totalChunks = Math.ceil(games.length / CHUNK_SIZE);
    setProgress({ current: 0, total: totalChunks });
    const allResults: GameBatchResult[] = [...prevResults];

    for (let i = 0; i < totalChunks; i++) {
      const chunk = games.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      try {
        const res = await batchCreate.mutateAsync({
          games: chunk.map((g) => ({
            title: g.title,
            description: g.description || undefined,
            coverUrl: g.coverUrl || undefined,
            gameType: g.gameType || undefined,
            isFree: g.isFree,
            version: g.version || undefined,
            tagNames: g.tags?.length > 0 ? g.tags : undefined,
            extraInfo: buildGameExtraInfo(g),
          })),
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

    return allResults;
  };

  const handleImport = async () => {
    if (!parsed || parsed.games.length === 0) return;
    setImporting(true);
    setResults([]);

    try {
      const all = await importGames(parsed.games);
      const newC = all.filter(r => r.id && !r.updated).length;
      const updC = all.filter(r => r.updated).length;
      const failC = all.filter(r => r.error).length;
      toast.success(`导入完成：新建 ${newC}，更新 ${updC}，失败 ${failC}`);
      setResults(all);
    } finally {
      setImporting(false);
    }
  };

  const handleRetry = async () => {
    if (!parsed) return;
    const failedTitles = new Set(results.filter(r => r.error).map(r => r.title));
    const failedGames = parsed.games.filter(g => failedTitles.has(g.title));
    if (failedGames.length === 0) return;

    const prevOk = results.filter(r => r.id);
    setImporting(true);

    try {
      const all = await importGames(failedGames, prevOk);
      const newOk = all.filter(r => r.id).length - prevOk.length;
      const newFail = all.filter(r => r.error).length;
      toast.success(`重试完成：${newOk} 成功，${newFail} 仍失败`);
      setResults(all);
    } finally {
      setImporting(false);
    }
  };

  const totalChunks = parsed ? Math.ceil(parsed.games.length / CHUNK_SIZE) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            批量导入游戏
          </CardTitle>
          <CardDescription>
            拖入或选择 JSON 文件批量导入游戏资源（每 {CHUNK_SIZE} 个一批，自动分块处理）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DropZone
            id="game-batch-input"
            accept=".json"
            fileName={fileName}
            summary={parsed ? `${parsed.games.length} 个游戏` : undefined}
            hint="JSON 数组格式，每项包含 title, gameType, tagNames, extraInfo 等"
            onFile={handleFile}
            onClear={() => { setParsed(null); setFileName(""); setResults([]); }}
            hasData={!!parsed}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" onClick={handleImport} disabled={!parsed || parsed.games.length === 0 || importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {importing
                ? `导入中 ${progress.current}/${progress.total}`
                : `开始导入${parsed ? ` (${parsed.games.length} 个游戏)` : ""}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(GAME_BATCH_TEMPLATE, "game-batch-template.json")}
            >
              <DownloadCloud className="h-4 w-4 mr-1" />
              下载模板
            </Button>
          </div>

          <BatchProgressBar progress={progress} label="批" isActive={importing} />
        </CardContent>
      </Card>

      {/* 解析预览 */}
      {parsed && parsed.games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">解析预览</CardTitle>
            <CardDescription>
              共 {parsed.games.length} 个游戏{totalChunks > 1 ? `，将分 ${totalChunks} 批处理` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {parsed.games.map((game, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    {game.coverUrl && (
                      <div className="shrink-0 w-16 h-10 rounded overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.coverUrl} alt={game.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs tabular-nums shrink-0 w-6 text-right">{i + 1}</span>
                        <span className="font-medium truncate">{game.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap ml-8">
                        {game.gameType && <Badge variant="default" className="text-[10px] py-0">{game.gameType}</Badge>}
                        <Badge variant={game.isFree ? "secondary" : "outline"} className="text-[10px] py-0">{game.isFree ? "免费" : "付费"}</Badge>
                        {game.version && <span className="text-[10px] text-muted-foreground">{game.version}</span>}
                        {game.downloads?.length > 0 && <span className="text-[10px] text-muted-foreground"><Download className="h-2.5 w-2.5 inline mr-0.5" />{game.downloads.length} 下载</span>}
                        {game.screenshots?.length > 0 && <span className="text-[10px] text-muted-foreground"><ImageIcon className="h-2.5 w-2.5 inline mr-0.5" />{game.screenshots.length} 截图</span>}
                        {game.videos?.length > 0 && <span className="text-[10px] text-muted-foreground"><FileVideo className="h-2.5 w-2.5 inline mr-0.5" />{game.videos.length} 视频</span>}
                        {game.tags?.length > 0 && <span className="text-[10px] text-muted-foreground"><Tag className="h-2.5 w-2.5 inline mr-0.5" />{game.tags.length} 标签</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <GameBatchResults results={results} importing={importing} onRetry={handleRetry} />
    </div>
  );
}
