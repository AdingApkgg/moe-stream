"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [input, setInput] = useState("");

  const totalCount = selectedTags.length + newTags.length;
  const isFull = totalCount >= maxTags;

  const filtered = useMemo(() => {
    if (!allTags) return [];
    if (!input.trim()) return allTags;
    const q = input.toLowerCase();
    return allTags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [allTags, input]);

  const canCreateNew = useMemo(() => {
    if (!input.trim() || isFull) return false;
    const q = input.trim().toLowerCase();
    if (newTags.some((t) => t.toLowerCase() === q)) return false;
    if (selectedTags.some((t) => t.name.toLowerCase() === q)) return false;
    if (allTags?.some((t) => t.name.toLowerCase() === q)) return false;
    return true;
  }, [input, isFull, newTags, selectedTags, allTags]);

  const handleAdd = () => {
    const name = input.trim();
    if (!name || isFull) return;

    const existing = allTags?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onToggleTag(existing);
    } else if (!newTags.includes(name) && !selectedTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      onAddNewTag(name);
    }
    setInput("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Tag className="h-4 w-4" />
            标签
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {totalCount}/{maxTags}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 已选标签 */}
        {totalCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="default"
                className="cursor-pointer hover:bg-primary/80 transition-colors gap-1 text-[11px] px-2 py-0.5"
                onClick={() => onToggleTag(tag)}
              >
                {tag.name}
                <X className="h-2.5 w-2.5" />
              </Badge>
            ))}
            {newTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1 text-[11px] px-2 py-0.5"
                onClick={() => onRemoveNewTag(tag)}
              >
                <Plus className="h-2.5 w-2.5" />
                {tag}
                <X className="h-2.5 w-2.5" />
              </Badge>
            ))}
          </div>
        )}

        {/* 统一输入框：搜索 + 新建 */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={isFull ? "已达上限" : "搜索或创建标签..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              disabled={isFull}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {canCreateNew && (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              创建
            </Button>
          )}
        </div>

        {/* 标签列表 */}
        <ScrollArea className="h-28 rounded-md border p-2 bg-muted/30">
          <div className="flex flex-wrap gap-1">
            {filtered.length > 0 ? (
              filtered.map((tag) => {
                const isSelected = selectedTags.some((t) => t.id === tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-[11px] transition-all py-0",
                      isSelected ? "hover:bg-primary/80" : "hover:bg-accent hover:text-accent-foreground",
                    )}
                    onClick={() => onToggleTag(tag)}
                  >
                    {tag.name}
                  </Badge>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground py-2 px-1">{input ? "未找到匹配的标签" : "暂无标签"}</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
