"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Search, Tag, X } from "lucide-react";
import type { TagItem } from "../_lib/types";

interface TagPickerProps {
  allTags: TagItem[] | undefined;
  selectedTags: TagItem[];
  newTags: string[];
  onToggleTag: (tag: TagItem) => void;
  onAddNewTag: (name: string) => void;
  onRemoveNewTag: (name: string) => void;
  maxTags?: number;
}

export function TagPicker({
  allTags,
  selectedTags,
  newTags,
  onToggleTag,
  onAddNewTag,
  onRemoveNewTag,
  maxTags = 10,
}: TagPickerProps) {
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");

  const totalCount = selectedTags.length + newTags.length;
  const isFull = totalCount >= maxTags;

  const filtered = allTags?.filter((tag) => {
    if (!search.trim()) return true;
    return tag.name.toLowerCase().includes(search.toLowerCase());
  }) || [];

  const handleAdd = () => {
    const name = input.trim();
    if (!name || isFull) return;
    if (newTags.includes(name)) return;
    if (selectedTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) return;

    const existing = allTags?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onToggleTag(existing);
    } else {
      onAddNewTag(name);
    }
    setInput("");
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="h-5 w-5" />
          标签
        </CardTitle>
        <CardDescription>选择或创建标签，最多 {maxTags} 个</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 已选标签 */}
        {totalCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="default"
                className="cursor-pointer hover:bg-primary/80 transition-colors gap-1 px-3 py-1"
                onClick={() => onToggleTag(tag)}
              >
                {tag.name}
                <X className="h-3 w-3" />
              </Badge>
            ))}
            {newTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1 px-3 py-1"
                onClick={() => onRemoveNewTag(tag)}
              >
                <Plus className="h-3 w-3" />
                {tag}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* 添加新标签 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="输入新标签名称..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              disabled={isFull}
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" onClick={handleAdd} disabled={isFull || !input.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">已选择 {totalCount} / {maxTags} 个标签</p>

        <Separator />

        {/* 标签列表 */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索已有标签..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <ScrollArea className="h-40 rounded-md border p-3 bg-muted/30">
            <div className="flex flex-wrap gap-1.5">
              {filtered.length > 0 ? (
                filtered.map((tag) => {
                  const isSelected = selectedTags.some((t) => t.id === tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer text-xs transition-all",
                        isSelected ? "hover:bg-primary/80" : "hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => onToggleTag(tag)}
                    >
                      {tag.name}
                    </Badge>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  {search ? "未找到匹配的标签" : "暂无标签"}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
