"use client";

import { GameCard, type GameCardData } from "./game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { MotionList, MotionItem } from "@/components/motion";

interface GameGridProps {
  games: GameCardData[];
  isLoading?: boolean;
  columns?: 3 | 4 | 5;
  highlightQuery?: string | null;
}

const gridColumns = {
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
};

export function GameGrid({ games, isLoading, columns = 4, highlightQuery }: GameGridProps) {
  if (isLoading) {
    return (
      <div className={`grid ${gridColumns[columns]} gap-3 sm:gap-4 lg:gap-5`}>
        {Array.from({ length: 10 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">暂无游戏</p>
      </div>
    );
  }

  return (
    <MotionList className={`grid ${gridColumns[columns]} gap-3 sm:gap-4 lg:gap-5`}>
      {games.map((game, index) => (
        <MotionItem key={game.id}>
          <GameCard game={game} index={index} highlightQuery={highlightQuery} />
        </MotionItem>
      ))}
    </MotionList>
  );
}

function GameCardSkeleton() {
  return (
    <div className="space-y-2">
      <div className="relative aspect-video rounded-lg overflow-hidden">
        <Skeleton className="absolute inset-0" />
        <div className="absolute top-1.5 left-1.5">
          <Skeleton className="h-4 w-10 rounded" />
        </div>
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between">
          <Skeleton className="h-4 w-12 rounded bg-white/10" />
          <Skeleton className="h-4 w-10 rounded bg-white/10" />
        </div>
      </div>
      <div className="px-0.5 space-y-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
