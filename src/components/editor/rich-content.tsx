"use client";

import { Fragment, useCallback, useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { mdxProseClasses } from "@/components/mdx/mdx-components";
import { trpc } from "@/lib/trpc";
import NextImage from "next/image";
import {
  splitByShortcode,
  renderShortcode,
  renderBlockShortcode,
  type HiddenVisibility,
  type Segment,
} from "./shortcodes";

export interface RichContentProps {
  markdown: string;
  className?: string;
  /** 评论态：紧凑排版，去除标题级 prose 间距。*/
  compact?: boolean;
  /** 关闭贴图/快捷码解析（如管理员长文不需要嵌入站点私有控件）。*/
  withStickers?: boolean;
  /** [hidden] 块的可见性上下文；调用方根据 session / 是否评论过决定。*/
  hiddenVisibility?: HiddenVisibility;
}

/** 富文本统一渲染器：Markdown + @mention + 行内短代码 + 块级短代码（callout/hidden/details/gallery）。*/
export function RichContent({
  markdown,
  className,
  compact = false,
  withStickers = true,
  hiddenVisibility,
}: RichContentProps) {
  const segments = useMemo<Segment[]>(
    () => (withStickers ? splitByShortcode(markdown) : [{ type: "text", value: markdown }]),
    [markdown, withStickers],
  );

  const renderInner = useCallback(
    (md: string) => (
      <RichContent markdown={md} compact={compact} withStickers={withStickers} hiddenVisibility={hiddenVisibility} />
    ),
    [compact, withStickers, hiddenVisibility],
  );

  if (!markdown.trim()) return null;

  const onlyText = segments.every((s) => s.type === "text");
  if (onlyText) {
    return <MarkdownInner content={markdown} className={className} compact={compact} />;
  }

  return (
    <div className={cn("rich-content space-y-1", className)}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <MarkdownInner key={i} content={seg.value} compact={compact} inline />;
        }
        if (seg.type === "inline") {
          if (seg.kind === "sticker") {
            const [packSlug, stickerId] = seg.payload.split(":");
            return <StickerInline key={i} packSlug={packSlug} stickerId={stickerId} />;
          }
          return <Fragment key={i}>{renderShortcode(seg.kind, seg.payload)}</Fragment>;
        }
        // seg.type === "block"
        return (
          <Fragment key={i}>
            {renderBlockShortcode(seg.kind, {
              attrs: seg.attrs,
              inner: seg.inner,
              renderInner,
              visibility: hiddenVisibility,
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

interface MarkdownInnerProps {
  content: string;
  className?: string;
  compact?: boolean;
  /** inline=true 时不渲染段落外壳，用于贴图中夹的文本。*/
  inline?: boolean;
}

function MarkdownInner({ content, className, compact, inline }: MarkdownInnerProps) {
  const wrapperClass = compact ? cn("prose-comment", className) : cn(mdxProseClasses, className);

  return (
    <div className={wrapperClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("mention:")) {
              const userId = href.slice("mention:".length);
              return <MentionChip userId={userId}>{children}</MentionChip>;
            }
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer nofollow" : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt, ...rest }) => {
            const safeSrc = typeof src === "string" ? src : "";
            if (!safeSrc) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeSrc}
                alt={alt || ""}
                loading="lazy"
                className="rounded-lg max-w-full h-auto inline-block"
                {...rest}
              />
            );
          },
          ...(inline ? { p: ({ children }) => <Fragment>{children}</Fragment> } : {}),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MentionChip({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/user/${userId}`}
      className="inline-flex items-center px-1 rounded bg-primary/10 text-primary font-medium no-underline hover:bg-primary/20 transition-colors"
    >
      {children}
    </Link>
  );
}

function StickerInline({ packSlug, stickerId }: { packSlug: string; stickerId: string }) {
  const { data: packs } = trpc.sticker.listPacks.useQuery(undefined, { staleTime: Infinity });
  const sticker = useMemo(() => {
    if (!packs) return null;
    const pack = packs.find((p) => p.slug === packSlug);
    return pack?.stickers.find((s) => s.id === stickerId) ?? null;
  }, [packs, packSlug, stickerId]);

  if (!sticker) {
    return <span className="text-muted-foreground text-xs">[贴图]</span>;
  }

  return (
    <NextImage
      src={sticker.imageUrl}
      alt={sticker.name}
      width={120}
      height={120}
      className="inline-block align-bottom my-0.5 rounded"
      style={{ width: "120px", height: "auto" }}
      unoptimized
    />
  );
}
