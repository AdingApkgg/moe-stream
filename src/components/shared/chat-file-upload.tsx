"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, ImagePlus, Loader2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ChatFileUploadProps {
  onUpload: (file: { url: string; name: string; size: number; type: string }) => void;
}

export function ChatFileUpload({ onUpload }: ChatFileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File, isImage: boolean) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", isImage ? "chat-image" : "chat-file");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      onUpload({
        url: data.url,
        name: file.name,
        size: file.size,
        type: file.type,
      });
      setPreview(null);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("图片不能超过 10MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    handleFile(file, true);
    e.target.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("文件不能超过 50MB");
      return;
    }

    handleFile(file, false);
    e.target.value = "";
  };

  return (
    <>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {uploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-2xl">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {preview && (
        <div className="relative inline-block mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="预览" className="h-20 rounded-lg" />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" disabled={uploading}>
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-40 p-1" sideOffset={8}>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <ImagePlus className="h-4 w-4" />
            发送图片
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            <Paperclip className="h-4 w-4" />
            发送文件
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
