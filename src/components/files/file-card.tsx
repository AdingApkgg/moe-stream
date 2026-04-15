"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileIcon,
  ImageIcon,
  VideoIcon,
  FileArchive,
  FileAudio,
  MoreHorizontal,
  Trash2,
  Link2,
  Unlink,
  Download,
  ExternalLink,
} from "lucide-react";
import { cn, getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { useRedirectOptions } from "@/hooks/use-redirect-options";

interface FileCardFile {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  contentType: string | null;
  contentId: string | null;
  createdAt: string;
}

interface FileCardProps {
  file: FileCardFile;
  onDelete?: (id: string) => void;
  onDetach?: (id: string) => void;
  onAttach?: (id: string) => void;
  showAttachInfo?: boolean;
  className?: string;
}

function renderFileIcon(mimeType: string, className: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className={className} />;
  if (mimeType.startsWith("video/")) return <VideoIcon className={className} />;
  if (mimeType.startsWith("audio/")) return <FileAudio className={className} />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("tar"))
    return <FileArchive className={className} />;
  return <FileIcon className={className} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  video: "视频",
  game: "游戏",
  imagePost: "图片帖",
};

export function FileCard({ file, onDelete, onDetach, onAttach, showAttachInfo = true, className }: FileCardProps) {
  const redirectOpts = useRedirectOptions();
  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");

  return (
    <Card className={cn("group overflow-hidden", className)}>
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={file.url} alt={file.filename} className="h-full w-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={file.url} className="h-full w-full object-cover" muted preload="metadata" />
        ) : (
          renderFileIcon(file.mimeType, "h-12 w-12 text-muted-foreground")
        )}

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={file.url} download={file.filename}>
                  <Download className="h-4 w-4 mr-2" />
                  下载
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={getRedirectUrl(file.url, redirectOpts)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  新窗口打开
                </a>
              </DropdownMenuItem>
              {file.contentId && onDetach && (
                <DropdownMenuItem onClick={() => onDetach(file.id)}>
                  <Unlink className="h-4 w-4 mr-2" />
                  取消关联
                </DropdownMenuItem>
              )}
              {!file.contentId && onAttach && (
                <DropdownMenuItem onClick={() => onAttach(file.id)}>
                  <Link2 className="h-4 w-4 mr-2" />
                  关联到内容
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(file.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-2.5 space-y-1">
        <p className="text-sm font-medium truncate" title={file.filename}>
          {file.filename}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(file.size)}</span>
          {showAttachInfo && file.contentType && (
            <span className="text-primary">{CONTENT_TYPE_LABELS[file.contentType] || file.contentType}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
