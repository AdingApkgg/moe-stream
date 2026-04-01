"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSiteConfig } from "@/contexts/site-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/lib/toast-with-sound";
import { trpc } from "@/lib/trpc";
import { imageUploadSchema, type ImageUploadForm } from "../_lib/schemas";
import { TagPicker } from "./tag-picker";
import type { TagItem } from "../_lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FolderOpen, Image as ImageIcon, Link2, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/files/file-uploader";
import { FilePickerDialog } from "@/components/shared/file-picker-dialog";
import { cn } from "@/lib/utils";

export function ImageSingleUpload() {
  const router = useRouter();
  const siteConfig = useSiteConfig();
  const uploadEnabled = siteConfig?.fileUploadEnabled ?? false;

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageTab, setImageTab] = useState<string>(uploadEnabled ? "upload" : "link");
  const [isNsfw, setIsNsfw] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: allTags } = trpc.tag.list.useQuery({ limit: 100 }, { staleTime: 10 * 60 * 1000 });
  const createMutation = trpc.image.create.useMutation({
    onError: (e) => toast.error("发布失败", { description: e.message }),
  });

  const form = useForm<ImageUploadForm>({
    resolver: zodResolver(imageUploadSchema),
    defaultValues: { title: "", description: "" },
  });

  const toggleTag = (tag: TagItem) => {
    const exists = selectedTags.find((t) => t.id === tag.id);
    if (exists) setSelectedTags(selectedTags.filter((t) => t.id !== tag.id));
    else if (selectedTags.length + newTags.length < 10) setSelectedTags([...selectedTags, tag]);
  };

  const removeImageUrl = useCallback((index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileUploaded = useCallback(
    (file: UploadedFile) => {
      if (!imageUrls.includes(file.url)) {
        setImageUrls((prev) => [...prev, file.url]);
      }
    },
    [imageUrls],
  );

  const validImages = imageUrls.filter((url) => url.trim());

  const onSubmit = async (data: ImageUploadForm) => {
    if (validImages.length === 0) {
      toast.error("请至少添加一张图片");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createMutation.mutateAsync({
        title: data.title,
        description: data.description || undefined,
        images: validImages,
        isNsfw,
        tagIds: selectedTags.map((t) => t.id),
        tagNames: newTags,
      });

      toast.success(result.status === "PUBLISHED" ? "发布成功" : "提交成功，等待审核");
      router.push(`/image/${result.id}`);
    } catch {
      // onError handles this
    } finally {
      setIsLoading(false);
    }
  };

  const submitButton = (
    <Button type="submit" className="w-full h-11" disabled={isLoading} size="lg">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          发布中...
        </>
      ) : (
        <>
          <Upload className="mr-2 h-4 w-4" />
          发布图片
        </>
      )}
    </Button>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-5 min-w-0 pb-20 lg:pb-0">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>标题 *</FormLabel>
                      <FormControl>
                        <Input placeholder="输入图片标题" {...field} className="text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl>
                        <Textarea placeholder="图片描述（可选）" className="min-h-[80px] resize-y" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  图片
                  {validImages.length > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {validImages.length} 张
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">上传图片或添加外链，至少一张</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={imageTab} onValueChange={setImageTab}>
                  <TabsList className="h-8 p-0.5">
                    {uploadEnabled && (
                      <TabsTrigger value="upload" className="text-xs h-7 gap-1 px-2.5">
                        <Upload className="h-3.5 w-3.5" />
                        上传
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="link" className="text-xs h-7 gap-1 px-2.5">
                      <Link2 className="h-3.5 w-3.5" />
                      外链
                    </TabsTrigger>
                    {uploadEnabled && (
                      <TabsTrigger value="files" className="text-xs h-7 gap-1 px-2.5">
                        <FolderOpen className="h-3.5 w-3.5" />
                        我的文件
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {uploadEnabled && (
                    <TabsContent value="upload" className="mt-2">
                      <FileUploader
                        contentType="imagePost"
                        accept="image/*"
                        maxFiles={20}
                        onFileUploaded={handleFileUploaded}
                      />
                    </TabsContent>
                  )}

                  <TabsContent value="link" className="mt-2 space-y-2">
                    <Textarea
                      placeholder={
                        "粘贴图片链接，每行一个\nhttps://example.com/image1.jpg\nhttps://example.com/image2.jpg"
                      }
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      rows={3}
                      className="text-sm resize-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!linkInput.trim()}
                        onClick={() => {
                          const urls = linkInput
                            .split("\n")
                            .map((l) => l.trim())
                            .filter((u) => u && !imageUrls.includes(u));
                          if (urls.length > 0) {
                            setImageUrls((prev) => [...prev, ...urls]);
                            setLinkInput("");
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                        {linkInput.split("\n").filter((l) => l.trim()).length > 1
                          ? `（${linkInput.split("\n").filter((l) => l.trim()).length} 条）`
                          : ""}
                      </Button>
                    </div>
                  </TabsContent>

                  {uploadEnabled && (
                    <TabsContent value="files" className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-16 border-dashed flex flex-col gap-1"
                        onClick={() => setPickerOpen(true)}
                      >
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">从我的文件中选择（可多选）</span>
                      </Button>
                      <FilePickerDialog
                        open={pickerOpen}
                        onOpenChange={setPickerOpen}
                        onSelect={(url) => {
                          if (!imageUrls.includes(url)) {
                            setImageUrls((prev) => [...prev, url]);
                          }
                          setPickerOpen(false);
                        }}
                        onSelectMultiple={(urls) => {
                          const newUrls = urls.filter((u) => !imageUrls.includes(u));
                          if (newUrls.length > 0) {
                            setImageUrls((prev) => [...prev, ...newUrls]);
                          }
                          setPickerOpen(false);
                        }}
                        multiple
                        mimePrefix="image/"
                      />
                    </TabsContent>
                  )}
                </Tabs>

                {validImages.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">已添加 {validImages.length} 张图片</p>
                      {validImages.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive h-7"
                          onClick={() => setImageUrls([])}
                        >
                          清空全部
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {validImages.map((url, i) => (
                        <div
                          key={`${url}-${i}`}
                          className="group relative aspect-square rounded-lg border overflow-hidden bg-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`图片 ${i + 1}`}
                            className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-7 w-7 rounded-full shadow-lg"
                              onClick={() => removeImageUrl(i)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-md font-medium">
                            {i + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <TagPicker
              allTags={allTags}
              selectedTags={selectedTags}
              newTags={newTags}
              onToggleTag={toggleTag}
              onAddNewTag={(name) => setNewTags([...newTags, name])}
              onRemoveNewTag={(name) => setNewTags(newTags.filter((t) => t !== name))}
            />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="nsfw-toggle" className={cn("text-sm font-medium", isNsfw && "text-red-500")}>
                NSFW
              </Label>
              <Switch
                id="nsfw-toggle"
                checked={isNsfw}
                onCheckedChange={setIsNsfw}
                className="data-[state=checked]:bg-red-500"
              />
            </div>

            <div className="hidden lg:block">{submitButton}</div>
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur-sm border-t lg:hidden z-40">
          {submitButton}
        </div>
      </form>
    </Form>
  );
}
