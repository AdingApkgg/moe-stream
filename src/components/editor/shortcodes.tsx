"use client";

import {
  Box,
  ExternalLink,
  ChevronDown,
  Lock,
  MessageSquare,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 站点私有短代码：
 *
 * 行内原子型（atomic）：
 *  - [bilibili:BVxxxxxxxxxx]            B 站视频
 *  - [bilibili:BVxxxxxxxxxx:2]          指定分 P
 *  - [youtube:VIDEO_ID]                  YouTube 视频
 *  - [netease:song:1234567]              网易云单曲
 *  - [netease:playlist:1234567]          网易云歌单
 *  - [live2d:model-slug]                 Live2D 模型卡
 *  - [sticker:pack-slug:sticker_id]      表情贴图
 *
 * 块级带内容（block，含内层 markdown）：
 *  - [callout type=info]...[/callout]   提示框 (info/warning/success/error)
 *  - [hidden cond=login]...[/hidden]    隐藏内容 (login/comment)
 *  - [details summary="..." open=true]...[/details]  折叠面板
 *  - [gallery]url1\nurl2\n[/gallery]    多图画廊
 */

export type InlineKind = "bilibili" | "youtube" | "netease" | "live2d" | "sticker";
export type BlockKind = "callout" | "hidden" | "details" | "gallery";

const INLINE_KINDS: InlineKind[] = ["bilibili", "youtube", "netease", "live2d", "sticker"];

/** 同时匹配所有 inline 短代码。*/
export const SHORTCODE_REGEX = new RegExp(`\\[(${INLINE_KINDS.join("|")}):([^\\]\\s]+)\\]`, "g");

export type Segment =
  | { type: "text"; value: string }
  | { type: "inline"; kind: InlineKind; payload: string }
  | { type: "block"; kind: BlockKind; attrs: Record<string, string>; inner: string };

const BLOCK_PATTERNS: Array<{
  kind: BlockKind;
  open: RegExp;
  close: RegExp;
  parseAttrs: (m: RegExpExecArray) => Record<string, string>;
}> = [
  {
    kind: "callout",
    open: /^\[callout\s+type=(info|warning|success|error)\]\s*$/m,
    close: /^\[\/callout\]\s*$/m,
    parseAttrs: (m) => ({ variant: m[1] }),
  },
  {
    kind: "hidden",
    open: /^\[hidden\s+cond=(login|comment)\]\s*$/m,
    close: /^\[\/hidden\]\s*$/m,
    parseAttrs: (m) => ({ condition: m[1] }),
  },
  {
    kind: "details",
    open: /^\[details\s+summary="([^"]*)"\s+open=(true|false)\]\s*$/m,
    close: /^\[\/details\]\s*$/m,
    parseAttrs: (m) => ({ summary: m[1], open: m[2] }),
  },
  {
    kind: "gallery",
    open: /^\[gallery\]\s*$/m,
    close: /^\[\/gallery\]\s*$/m,
    parseAttrs: () => ({}),
  },
];

/** 同时切分 block + inline 短代码。块优先，块外才走 inline 匹配。*/
export function splitByShortcode(input: string): Segment[] {
  const blockSegments = splitBlocks(input);
  return blockSegments.flatMap((seg) => (seg.type === "text" ? splitInlineInText(seg.value) : [seg]));
}

function splitBlocks(input: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const remaining = input.slice(cursor);
    let earliest: { pattern: (typeof BLOCK_PATTERNS)[number]; openMatch: RegExpExecArray; absStart: number } | null =
      null;

    for (const p of BLOCK_PATTERNS) {
      const m = p.open.exec(remaining);
      if (!m) continue;
      const absStart = cursor + m.index;
      if (!earliest || absStart < earliest.absStart) {
        earliest = { pattern: p, openMatch: m, absStart };
      }
    }

    if (!earliest) {
      if (cursor < input.length) segments.push({ type: "text", value: input.slice(cursor) });
      break;
    }

    const openEnd = earliest.absStart + earliest.openMatch[0].length;
    const closeMatch = earliest.pattern.close.exec(input.slice(openEnd));
    if (!closeMatch) {
      if (earliest.absStart > cursor) segments.push({ type: "text", value: input.slice(cursor, earliest.absStart) });
      segments.push({ type: "text", value: earliest.openMatch[0] });
      cursor = openEnd;
      continue;
    }

    if (earliest.absStart > cursor) segments.push({ type: "text", value: input.slice(cursor, earliest.absStart) });

    const closeAbsStart = openEnd + closeMatch.index;
    const inner = input.slice(openEnd, closeAbsStart).replace(/^\n+|\n+$/g, "");
    segments.push({
      type: "block",
      kind: earliest.pattern.kind,
      attrs: earliest.pattern.parseAttrs(earliest.openMatch),
      inner,
    });
    cursor = closeAbsStart + closeMatch[0].length;
  }

  return segments;
}

function splitInlineInText(input: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  SHORTCODE_REGEX.lastIndex = 0;
  for (const m of input.matchAll(SHORTCODE_REGEX)) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ type: "text", value: input.slice(last, idx) });
    segments.push({ type: "inline", kind: m[1] as InlineKind, payload: m[2] });
    last = idx + m[0].length;
  }
  if (last < input.length) segments.push({ type: "text", value: input.slice(last) });
  return segments;
}

/* =========================== 渲染入口 =========================== */

/** 行内短代码渲染入口。sticker 由调用方处理（依赖 tRPC 数据）。*/
export function renderShortcode(kind: InlineKind, payload: string): React.ReactNode {
  switch (kind) {
    case "bilibili":
      return <BilibiliEmbed payload={payload} />;
    case "youtube":
      return <YoutubeEmbed payload={payload} />;
    case "netease":
      return <NeteaseEmbed payload={payload} />;
    case "live2d":
      return <Live2DCard payload={payload} />;
    default:
      return null;
  }
}

export interface BlockRenderProps {
  attrs: Record<string, string>;
  inner: string;
  /** 递归渲染内层 markdown，由 RichContent 注入。*/
  renderInner: (markdown: string) => React.ReactNode;
  /** 隐藏内容可见性上下文 */
  visibility?: HiddenVisibility;
}

export interface HiddenVisibility {
  loggedIn?: boolean;
  hasCommented?: boolean;
}

export function renderBlockShortcode(kind: BlockKind, props: BlockRenderProps): React.ReactNode {
  switch (kind) {
    case "callout":
      return <CalloutBlock {...props} />;
    case "hidden":
      return <HiddenBlock {...props} />;
    case "details":
      return <DetailsBlock {...props} />;
    case "gallery":
      return <GalleryBlock {...props} />;
    default:
      return null;
  }
}

/* ---------------- B 站 ---------------- */
function BilibiliEmbed({ payload }: { payload: string }) {
  const [bvid, pageRaw] = payload.split(":");
  const page = Number.parseInt(pageRaw ?? "1", 10) || 1;
  if (!/^BV[a-zA-Z0-9]{10}$/.test(bvid)) {
    return <ShortcodeError label={`无效 B 站 ID: ${bvid}`} />;
  }
  const src = `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&high_quality=1&danmaku=0`;
  return (
    <EmbedFrame title={`B站视频 ${bvid}`} src={src} aspect="16/9">
      <ExternalLinkChip href={`https://www.bilibili.com/video/${bvid}`} label="在 B 站打开" />
    </EmbedFrame>
  );
}

/* ---------------- YouTube ---------------- */
function YoutubeEmbed({ payload }: { payload: string }) {
  const videoId = payload.split(":")[0];
  if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
    return <ShortcodeError label={`无效 YouTube ID: ${videoId}`} />;
  }
  const src = `https://www.youtube-nocookie.com/embed/${videoId}`;
  return (
    <EmbedFrame title={`YouTube ${videoId}`} src={src} aspect="16/9">
      <ExternalLinkChip href={`https://www.youtube.com/watch?v=${videoId}`} label="在 YouTube 打开" />
    </EmbedFrame>
  );
}

/* ---------------- 网易云 ---------------- */
function NeteaseEmbed({ payload }: { payload: string }) {
  const [variant, id] = payload.includes(":") ? payload.split(":") : ["song", payload];
  if (!/^\d+$/.test(id ?? "")) {
    return <ShortcodeError label={`无效网易云 ID: ${id}`} />;
  }
  const type = variant === "playlist" ? 0 : variant === "program" ? 1 : variant === "radio" ? 3 : 2;
  const height = type === 0 || type === 3 ? 450 : 86;
  const src = `https://music.163.com/outchain/player?type=${type}&id=${id}&auto=0&height=${height - 20}`;
  return (
    <div className="my-3 not-prose">
      <iframe
        src={src}
        width="100%"
        height={height}
        className="rounded-lg border bg-card"
        frameBorder={0}
        title={`网易云${variant === "playlist" ? "歌单" : "音乐"} ${id}`}
        loading="lazy"
      />
    </div>
  );
}

/* ---------------- Live2D ---------------- */
function Live2DCard({ payload }: { payload: string }) {
  const slug = payload.split(":")[0];
  return (
    <div className="my-3 not-prose flex items-center gap-3 rounded-lg border bg-card/50 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Box className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Live2D 模型</div>
        <div className="truncate text-xs text-muted-foreground">{slug}</div>
      </div>
      <a
        href={`/live2d/${slug}`}
        className="shrink-0 text-xs text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        加载
      </a>
    </div>
  );
}

/* ---------------- Callout ---------------- */
const CALLOUT_PRESET: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  info: { icon: Info, label: "提示", cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  warning: {
    icon: AlertTriangle,
    label: "注意",
    cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  success: {
    icon: CheckCircle2,
    label: "成功",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  error: { icon: XCircle, label: "错误", cls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
};

function CalloutBlock({ attrs, inner, renderInner }: BlockRenderProps) {
  const preset = CALLOUT_PRESET[attrs.variant ?? "info"] ?? CALLOUT_PRESET.info;
  const Icon = preset.icon;
  return (
    <div className={cn("my-3 not-prose rounded-lg border px-3 py-2", preset.cls)}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        <span>{preset.label}</span>
      </div>
      <div className="text-sm text-foreground">{renderInner(inner)}</div>
    </div>
  );
}

/* ---------------- Hidden ---------------- */
function HiddenBlock({ attrs, inner, renderInner, visibility }: BlockRenderProps) {
  const condition = (attrs.condition ?? "login") as "login" | "comment";
  const visible = condition === "login" ? !!visibility?.loggedIn : !!visibility?.hasCommented;

  if (!visible) {
    const tip = condition === "login" ? "登录后可见此内容" : "评论后可见此内容";
    const Icon = condition === "login" ? Lock : MessageSquare;
    return (
      <div className="my-3 not-prose flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {tip}
      </div>
    );
  }
  return (
    <div className="my-3 not-prose rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="text-sm">{renderInner(inner)}</div>
    </div>
  );
}

/* ---------------- Details ---------------- */
function DetailsBlock({ attrs, inner, renderInner }: BlockRenderProps) {
  const [open, setOpen] = useState(attrs.open !== "false");
  const summary = attrs.summary || "点击展开/收起";
  return (
    <div className="my-3 not-prose rounded-lg border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-accent/40"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
        <span className="flex-1">{summary}</span>
      </button>
      {open && <div className="border-t px-3 py-2 text-sm">{renderInner(inner)}</div>}
    </div>
  );
}

/* ---------------- Gallery ---------------- */
function GalleryBlock({ inner }: BlockRenderProps) {
  const urls = inner
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!urls.length) return null;
  return (
    <div className="my-3 not-prose grid grid-cols-2 sm:grid-cols-3 gap-2">
      {urls.map((src, i) => (
        <a
          key={i}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="aspect-square overflow-hidden rounded-md border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/* ---------------- 共用渲染件 ---------------- */
function EmbedFrame({
  title,
  src,
  aspect,
  children,
}: {
  title: string;
  src: string;
  aspect: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="my-3 not-prose">
      <div className="relative w-full overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: aspect }}>
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      {children && <div className="mt-1.5 flex justify-end">{children}</div>}
    </div>
  );
}

function ExternalLinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}

function ShortcodeError({ label }: { label: string }) {
  return <span className="inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">{label}</span>;
}
