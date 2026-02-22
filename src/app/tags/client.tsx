"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  X,
  Tags,
  FileVideo,
  Gamepad2,
  FolderOpen,
} from "lucide-react";

interface TagData {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  _count: { videos?: number; games?: number };
}

interface CategoryGroup<T extends TagData> {
  category: { id: string; name: string; slug: string; color: string } | null;
  tags: T[];
}

interface TagsPageClientProps {
  videoGroups: CategoryGroup<TagData & { _count: { videos: number } }>[];
  gameGroups: CategoryGroup<TagData & { _count: { games: number } }>[];
  totalVideoTags: number;
  totalGameTags: number;
}

export function TagsPageClient({
  videoGroups,
  gameGroups,
  totalVideoTags,
  totalGameTags,
}: TagsPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const clearSearch = useCallback(() => setSearchQuery(""), []);
  const isSearching = searchQuery.length > 0;

  const filteredVideoGroups = useMemo(() => {
    if (!searchQuery) return videoGroups;
    const q = searchQuery.toLowerCase();
    return videoGroups
      .map((g) => ({ ...g, tags: g.tags.filter((t) => t.name.toLowerCase().includes(q)) }))
      .filter((g) => g.tags.length > 0);
  }, [searchQuery, videoGroups]);

  const filteredGameGroups = useMemo(() => {
    if (!searchQuery) return gameGroups;
    const q = searchQuery.toLowerCase();
    return gameGroups
      .map((g) => ({ ...g, tags: g.tags.filter((t) => t.name.toLowerCase().includes(q)) }))
      .filter((g) => g.tags.length > 0);
  }, [searchQuery, gameGroups]);

  const filteredVideoCount = filteredVideoGroups.reduce((s, g) => s + g.tags.length, 0);
  const filteredGameCount = filteredGameGroups.reduce((s, g) => s + g.tags.length, 0);

  return (
    <div className="container py-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">标签</h1>
        <span className="text-sm text-muted-foreground">
          视频 {totalVideoTags} 个 · 游戏 {totalGameTags} 个
        </span>
      </div>

      {/* 搜索框 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索标签..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs defaultValue="video" className="space-y-6">
        <TabsList>
          <TabsTrigger value="video" className="gap-1.5">
            <FileVideo className="h-4 w-4" />
            视频标签
            <Badge variant="secondary" className="ml-1 text-xs">{filteredVideoCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="game" className="gap-1.5">
            <Gamepad2 className="h-4 w-4" />
            游戏标签
            <Badge variant="secondary" className="ml-1 text-xs">{filteredGameCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="video" className="space-y-8">
          {filteredVideoGroups.length === 0 ? (
            <EmptyState isSearching={isSearching} searchQuery={searchQuery} />
          ) : (
            filteredVideoGroups.map((group) => (
              <CategorySection
                key={group.category?.id ?? "uncategorized"}
                category={group.category}
                tags={group.tags}
                type="video"
                getCount={(t) => (t._count as { videos: number }).videos}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="game" className="space-y-8">
          {filteredGameGroups.length === 0 ? (
            <EmptyState isSearching={isSearching} searchQuery={searchQuery} />
          ) : (
            filteredGameGroups.map((group) => (
              <CategorySection
                key={group.category?.id ?? "uncategorized"}
                category={group.category}
                tags={group.tags}
                type="game"
                getCount={(t) => (t._count as { games: number }).games}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategorySection<T extends TagData>({
  category,
  tags,
  type,
  getCount,
}: {
  category: { id: string; name: string; slug: string; color: string } | null;
  tags: T[];
  type: "video" | "game";
  getCount: (tag: T) => number;
}) {
  const basePath = type === "video" ? "/video/tag" : "/game/tag";

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {category ? (
          <>
            <div
              className="w-4 h-4 rounded-md"
              style={{ backgroundColor: category.color }}
            />
            <h2 className="text-lg font-semibold">{category.name}</h2>
          </>
        ) : (
          <>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">其他</h2>
          </>
        )}
        <Badge variant="outline" className="text-xs ml-1">
          {tags.length}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const count = getCount(tag);
          return (
            <Link
              key={tag.id}
              href={`${basePath}/${tag.slug}`}
              className="transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 active:scale-95"
            >
              <Badge
                variant="outline"
                className="text-sm py-1.5 px-3 cursor-pointer hover:bg-accent transition-colors"
                style={
                  category
                    ? { borderColor: `${category.color}40`, color: category.color }
                    : undefined
                }
              >
                {tag.name}
                <span className="ml-1 opacity-60">({count})</span>
              </Badge>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState({
  isSearching,
  searchQuery,
}: {
  isSearching: boolean;
  searchQuery: string;
}) {
  return (
    <div className="text-center py-12">
      <Tags className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">
        {isSearching ? `没有找到包含 "${searchQuery}" 的标签` : "暂无标签"}
      </p>
    </div>
  );
}
