"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Minus,
  Image as ImageIcon,
  Film,
  PlaySquare,
  Music2,
  Box,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";

export interface SlashItem {
  /** 命令 key，必须唯一 */
  key: string;
  /** 显示标题 */
  title: string;
  /** 副标题/帮助文本 */
  description?: string;
  /** 分组名 */
  group: "基础" | "媒体" | "块" | "其他";
  /** 搜索关键词（中英文皆可） */
  keywords: string[];
  /** 图标 */
  icon: React.ComponentType<{ className?: string }>;
  /** 执行命令；range 是 "/" 至光标的范围，会被 commandActions 清掉。*/
  command: (editor: Editor, range: Range) => void;
}

/** 内置斜杠命令清单 */
export const SLASH_ITEMS: SlashItem[] = [
  {
    key: "h1",
    title: "一级标题",
    group: "基础",
    keywords: ["h1", "heading1", "title", "标题"],
    icon: Heading1,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 1 }).run(),
  },
  {
    key: "h2",
    title: "二级标题",
    group: "基础",
    keywords: ["h2", "heading2", "subtitle", "标题"],
    icon: Heading2,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run(),
  },
  {
    key: "h3",
    title: "三级标题",
    group: "基础",
    keywords: ["h3", "heading3", "标题"],
    icon: Heading3,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 3 }).run(),
  },
  {
    key: "ul",
    title: "无序列表",
    group: "基础",
    keywords: ["ul", "bullet", "列表"],
    icon: List,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    key: "ol",
    title: "有序列表",
    group: "基础",
    keywords: ["ol", "number", "ordered", "列表", "编号"],
    icon: ListOrdered,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    key: "quote",
    title: "引用",
    group: "基础",
    keywords: ["quote", "blockquote", "引用"],
    icon: Quote,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    key: "codeblock",
    title: "代码块",
    group: "基础",
    keywords: ["code", "pre", "代码"],
    icon: SquareCode,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    key: "hr",
    title: "分割线",
    group: "基础",
    keywords: ["hr", "divider", "rule", "分割"],
    icon: Minus,
    command: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    key: "image",
    title: "图片",
    description: "插入网络图片地址",
    group: "媒体",
    keywords: ["image", "img", "picture", "图片", "图像"],
    icon: ImageIcon,
    command: (e, r) => {
      const url = window.prompt("图片地址", "https://");
      if (!url) return;
      e.chain().focus().deleteRange(r).setImage({ src: url }).run();
    },
  },
  {
    key: "bilibili",
    title: "B 站视频",
    description: "粘贴 BV 号或视频链接",
    group: "媒体",
    keywords: ["bilibili", "bili", "b站", "视频"],
    icon: Film,
    command: (e, r) => {
      const input = window.prompt("B 站视频 BV 号或链接", "BV");
      if (!input) return;
      const bvid = input.match(/BV[a-zA-Z0-9]{10}/)?.[0] || input.trim();
      e.chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: "bilibiliEmbed", attrs: { bvid, page: 1 } })
        .run();
    },
  },
  {
    key: "youtube",
    title: "YouTube",
    description: "粘贴视频 ID 或链接",
    group: "媒体",
    keywords: ["youtube", "yt", "视频"],
    icon: PlaySquare,
    command: (e, r) => {
      const input = window.prompt("YouTube 视频 ID 或链接", "");
      if (!input) return;
      const m = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,15})/);
      const videoId = m ? m[1] : input.trim();
      e.chain().focus().deleteRange(r).insertContent({ type: "youtubeEmbed", attrs: { videoId } }).run();
    },
  },
  {
    key: "netease",
    title: "网易云音乐",
    description: "歌曲或歌单 ID",
    group: "媒体",
    keywords: ["netease", "music", "网易云", "音乐"],
    icon: Music2,
    command: (e, r) => {
      const input = window.prompt("网易云 ID（歌曲填数字，歌单填 'playlist:数字'）", "");
      if (!input) return;
      const [variant, id] = input.includes(":") ? input.split(":") : ["song", input];
      e.chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: "neteaseEmbed", attrs: { variant, mediaId: id.trim() } })
        .run();
    },
  },
  {
    key: "live2d",
    title: "Live2D 模型",
    group: "媒体",
    keywords: ["live2d", "模型"],
    icon: Box,
    command: (e, r) => {
      const slug = window.prompt("Live2D 模型 slug", "");
      if (!slug) return;
      e.chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: "live2dEmbed", attrs: { slug: slug.trim() } })
        .run();
    },
  },
  {
    key: "gallery",
    title: "多图画廊",
    description: "网格排布的多图",
    group: "媒体",
    keywords: ["gallery", "album", "画廊", "图集", "相册"],
    icon: LayoutGrid,
    command: (e, r) => {
      const raw = window.prompt("图片地址（每行一个）", "");
      if (!raw) return;
      const urls = raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!urls.length) return;
      e.chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: "gallery", attrs: { images: urls } })
        .run();
    },
  },
  {
    key: "callout-info",
    title: "提示框",
    description: "信息类提示",
    group: "块",
    keywords: ["callout", "info", "tip", "提示", "提示框"],
    icon: Info,
    command: (e, r) => insertCalloutBlock(e, r, "info"),
  },
  {
    key: "callout-warning",
    title: "警告框",
    group: "块",
    keywords: ["callout", "warning", "warn", "警告"],
    icon: AlertTriangle,
    command: (e, r) => insertCalloutBlock(e, r, "warning"),
  },
  {
    key: "callout-success",
    title: "成功框",
    group: "块",
    keywords: ["callout", "success", "成功"],
    icon: CheckCircle2,
    command: (e, r) => insertCalloutBlock(e, r, "success"),
  },
  {
    key: "callout-error",
    title: "错误框",
    group: "块",
    keywords: ["callout", "error", "danger", "错误"],
    icon: XCircle,
    command: (e, r) => insertCalloutBlock(e, r, "error"),
  },
  {
    key: "hidden-login",
    title: "登录可见",
    description: "仅登录用户可见的隐藏内容",
    group: "块",
    keywords: ["hidden", "login", "登录", "可见"],
    icon: Lock,
    command: (e, r) => insertHiddenBlock(e, r, "login"),
  },
  {
    key: "hidden-comment",
    title: "评论可见",
    description: "评论过本文/视频才可见",
    group: "块",
    keywords: ["hidden", "comment", "评论", "可见"],
    icon: Lock,
    command: (e, r) => insertHiddenBlock(e, r, "comment"),
  },
  {
    key: "details",
    title: "折叠面板",
    description: "可展开/收起的内容",
    group: "块",
    keywords: ["details", "accordion", "collapse", "折叠", "面板"],
    icon: ChevronRight,
    command: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({
          type: "details",
          attrs: { open: true, summary: "点击展开/收起" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },
];

function insertCalloutBlock(editor: Editor, range: Range, variant: "info" | "warning" | "success" | "error") {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: "callout",
      attrs: { variant },
      content: [{ type: "paragraph" }],
    })
    .run();
}

function insertHiddenBlock(editor: Editor, range: Range, condition: "login" | "comment") {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: "hiddenContent",
      attrs: { condition },
      content: [{ type: "paragraph" }],
    })
    .run();
}

export interface SlashMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

type Props = SuggestionProps<SlashItem>;

export const SlashMenu = forwardRef<SlashMenuRef, Props>(function SlashMenu(props, ref) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [props.items]);

  const grouped = useMemo(() => {
    const buckets = new Map<SlashItem["group"], SlashItem[]>();
    for (const it of props.items) {
      const arr = buckets.get(it.group) ?? [];
      arr.push(it);
      buckets.set(it.group, arr);
    }
    // 维持原始 group 顺序：基础 > 媒体 > 块 > 其他
    const order: SlashItem["group"][] = ["基础", "媒体", "块", "其他"];
    return order.flatMap((g) => {
      const arr = buckets.get(g);
      return arr?.length ? [{ group: g, items: arr }] : [];
    });
  }, [props.items]);

  const flat = grouped.flatMap((g) => g.items);

  const runItem = (idx: number) => {
    const item = flat[idx];
    if (!item) return;
    props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + flat.length - 1) % Math.max(flat.length, 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % Math.max(flat.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        runItem(selected);
        return true;
      }
      return false;
    },
  }));

  if (!flat.length) {
    return (
      <div className="w-72 rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">无匹配命令</div>
    );
  }

  let runningIndex = 0;
  return (
    <div className="w-72 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
      {grouped.map(({ group, items }) => (
        <div key={group} className="py-0.5">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{group}</div>
          {items.map((item) => {
            const idx = runningIndex++;
            const active = idx === selected;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => runItem(idx)}
                onMouseEnter={() => setSelected(idx)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  active ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background text-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{item.title}</div>
                  {item.description && <div className="truncate text-xs text-muted-foreground">{item.description}</div>}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
