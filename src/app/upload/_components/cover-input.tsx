"use client";

import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

interface CoverInputProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  fieldName?: string;
  watchValue?: string;
}

export function CoverInput({ form, fieldName = "coverUrl", watchValue }: CoverInputProps) {
  const coverUrl = watchValue ?? form.watch(fieldName);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          封面
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name={fieldName}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="封面图片链接（可选）" {...field} />
              </FormControl>
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
                onError={(e) => { e.currentTarget.style.display = "none"; }}
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
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <span className="text-sm">输入链接预览</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
