"use client";

import { useState, useCallback } from "react";
import { useSiteConfig } from "@/contexts/site-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Link2, Upload, FolderOpen, X, CheckCircle2, Zap } from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/files/file-uploader";
import { FilePickerDialog } from "./file-picker-dialog";

export interface UrlOrUploadInputProps {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  placeholder?: string;
  contentType?: "video" | "game" | "imagePost";
  contentId?: string;
  disabled?: boolean;
  className?: string;
}

export function UrlOrUploadInput({
  value,
  onChange,
  accept,
  placeholder = "https://example.com/file",
  contentType,
  contentId,
  disabled,
  className,
}: UrlOrUploadInputProps) {
  const siteConfig = useSiteConfig();
  const uploadEnabled = siteConfig?.fileUploadEnabled ?? false;
  const [tab, setTab] = useState<string>("link");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadedResult, setUploadedResult] = useState<UploadedFile | null>(null);

  const handleFileUploaded = useCallback(
    (file: UploadedFile) => {
      setUploadedResult(file);
      onChange(file.url);
    },
    [onChange],
  );

  const handlePickFile = useCallback(
    (url: string) => {
      onChange(url);
      setPickerOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange("");
    setUploadedResult(null);
  }, [onChange]);

  if (!uploadEnabled) {
    return (
      <div className={cn("relative", className)}>
        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8 p-0.5">
          <TabsTrigger value="link" className="text-xs h-7 gap-1 px-2.5">
            <Link2 className="h-3.5 w-3.5" />
            外链
          </TabsTrigger>
          <TabsTrigger value="upload" className="text-xs h-7 gap-1 px-2.5">
            <Upload className="h-3.5 w-3.5" />
            上传
          </TabsTrigger>
          <TabsTrigger value="files" className="text-xs h-7 gap-1 px-2.5">
            <FolderOpen className="h-3.5 w-3.5" />
            我的文件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="mt-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="pl-9"
              disabled={disabled}
            />
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-2">
          {uploadedResult && value === uploadedResult.url ? (
            <div className="flex items-center gap-2.5 rounded-lg border p-3 bg-muted/30">
              {uploadedResult.size === 0 ? (
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadedResult.filename}</p>
                <p className="text-xs text-muted-foreground truncate">{value}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <FileUploader
              contentType={contentType}
              contentId={contentId}
              accept={accept}
              maxFiles={1}
              onFileUploaded={handleFileUploaded}
            />
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full h-20 border-dashed flex flex-col gap-1"
            onClick={() => setPickerOpen(true)}
            disabled={disabled}
          >
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{value ? "重新选择文件" : "从我的文件中选择"}</span>
          </Button>
          {value && tab === "files" && <p className="text-xs text-muted-foreground mt-1.5 truncate">当前: {value}</p>}
        </TabsContent>
      </Tabs>

      {value && tab !== "link" && <p className="text-xs text-muted-foreground truncate">URL: {value}</p>}

      <FilePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickFile}
        mimePrefix={accept?.replace("/*", "/").replace(/,.*/, "")}
      />
    </div>
  );
}
