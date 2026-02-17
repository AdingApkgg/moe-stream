"use client";

import { useState } from "react";
import Image from "next/image";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Globe, ExternalLink, Send, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast-with-sound";

interface SerializedLink {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  description: string | null;
  sort: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LinksClientProps {
  links: SerializedLink[];
}

export function LinksClient({ links }: LinksClientProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logo, setLogo] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.site.submitFriendLink.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setSubmitted(true);
      setName("");
      setUrl("");
      setLogo("");
      setDescription("");
    },
    onError: (error) => {
      toast.error(error.message || "提交失败");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("请填写站点名称");
      return;
    }
    if (!url.trim()) {
      toast.error("请填写站点地址");
      return;
    }
    submitMutation.mutate({
      name: name.trim(),
      url: url.trim(),
      logo: logo.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="container py-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-8">
        <Link2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">友情链接</h1>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed bg-muted/30 mb-10">
          <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">暂无友情链接</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden ring-1 ring-border/50 group-hover:ring-primary/30 transition-colors">
                    {link.logo ? (
                      <Image
                        src={link.logo}
                        alt={link.name}
                        width={56}
                        height={56}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <Globe className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {link.name}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {link.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* 友链申请表单 */}
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">申请友链</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            填写以下信息提交友链申请，管理员审核通过后将展示在页面上。
          </p>

          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="font-medium text-lg">申请已提交</p>
              <p className="text-sm text-muted-foreground mt-1">
                管理员将尽快审核，审核通过后会自动展示。
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSubmitted(false)}
              >
                继续提交
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="link-name">
                    站点名称 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="link-name"
                    placeholder="例如：我的博客"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-url">
                    站点地址 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="link-url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-logo">站点 Logo</Label>
                <Input
                  id="link-logo"
                  placeholder="https://example.com/logo.png（可选）"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-desc">站点描述</Label>
                <Textarea
                  id="link-desc"
                  placeholder="简短描述你的站点（可选，最多 200 字）"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  className="resize-none min-h-[80px]"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || !name.trim() || !url.trim()}
                >
                  {submitMutation.isPending ? "提交中..." : "提交申请"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
