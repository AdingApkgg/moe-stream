"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StickerPickerProps {
  onSelect: (sticker: { packId: string; stickerId: string; imageUrl: string; name: string }) => void;
}

export function StickerPicker({ onSelect }: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [activePackId, setActivePackId] = useState<string | null>(null);

  const { data: packs, isLoading } = trpc.sticker.listPacks.useQuery(
    undefined,
    { enabled: open },
  );

  const activePack = activePackId || packs?.[0]?.id;

  const { data: stickers } = trpc.sticker.listStickers.useQuery(
    { packId: activePack || "" },
    { enabled: !!activePack && open },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-80 p-0 rounded-xl"
        sideOffset={8}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !packs || packs.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            暂无表情包
          </div>
        ) : (
          <>
            {/* Pack tabs */}
            <div className="flex items-center gap-1 px-2 py-2 border-b overflow-x-auto scrollbar-none">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setActivePackId(pack.id)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    activePack === pack.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-muted-foreground",
                  )}
                >
                  {pack.name}
                </button>
              ))}
            </div>

            {/* Sticker grid */}
            <ScrollArea className="h-60">
              <div className="grid grid-cols-5 gap-1 p-2">
                {stickers?.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => {
                      onSelect({
                        packId: activePack!,
                        stickerId: sticker.id,
                        imageUrl: sticker.imageUrl,
                        name: sticker.name,
                      });
                      setOpen(false);
                    }}
                    className="aspect-square rounded-lg hover:bg-accent transition-colors p-1 flex items-center justify-center"
                    title={sticker.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sticker.imageUrl}
                      alt={sticker.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
