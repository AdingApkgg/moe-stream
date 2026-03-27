"use client";

import { FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, X } from "lucide-react";
import { UrlOrUploadInput } from "@/components/shared/url-or-upload-input";
import type { UseFormReturn } from "react-hook-form";

interface CoverInputProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  fieldName?: string;
  watchValue?: string;
  contentType?: "video" | "game" | "imagePost";
  contentId?: string;
}

export function CoverInput({ form, fieldName = "coverUrl", watchValue, contentType, contentId }: CoverInputProps) {
  const coverUrl = watchValue ?? form.watch(fieldName);

  return (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name={fieldName}
        render={({ field }) => (
          <FormItem>
            <UrlOrUploadInput
              value={field.value ?? ""}
              onChange={field.onChange}
              accept="image/*"
              placeholder="封面图片链接（可选）"
              contentType={contentType}
              contentId={contentId}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div
        className={cn(
          "relative aspect-video rounded-lg border-2 border-dashed overflow-hidden transition-colors group",
          coverUrl ? "border-transparent" : "border-muted-foreground/25",
        )}
      >
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt="封面预览"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => form.setValue(fieldName, "")}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-1.5 opacity-50" />
            <span className="text-xs">输入链接或上传预览封面</span>
          </div>
        )}
      </div>
    </div>
  );
}
