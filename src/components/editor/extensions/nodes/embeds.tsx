import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Box, Film, Music2, PlaySquare, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- 公共：序列化 state 接口（tiptap-markdown 未导出） ---------------- */
interface MdSerializerState {
  write: (text: string) => void;
  closeBlock: (node: unknown) => void;
}

/* ============================================================
 * Bilibili 视频
 * Markdown:  [bilibili:BVxxxxxxxxxx]  /  [bilibili:BVxxxxxxxxxx:2]
 * HTML:      <div data-bilibili-embed data-bvid="..." data-page="..."></div>
 * ============================================================ */
export const BilibiliEmbed = Node.create({
  name: "bilibiliEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      bvid: { default: "" },
      page: { default: 1, parseHTML: (el) => Number(el.getAttribute("data-page") || 1) || 1 },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-bilibili-embed]",
        getAttrs: (el) => ({
          bvid: (el as HTMLElement).getAttribute("data-bvid") || "",
          page: Number((el as HTMLElement).getAttribute("data-page") || 1) || 1,
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-bilibili-embed": "",
        "data-bvid": node.attrs.bvid,
        "data-page": String(node.attrs.page ?? 1),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BilibiliView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { bvid: string; page: number } }) {
          const suffix = node.attrs.page > 1 ? `:${node.attrs.page}` : "";
          state.write(`[bilibili:${node.attrs.bvid}${suffix}]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function BilibiliView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const bvid = node.attrs.bvid as string;
  const page = (node.attrs.page as number) || 1;
  const valid = /^BV[a-zA-Z0-9]{10}$/.test(bvid);
  const src = valid ? `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&high_quality=1&danmaku=0` : "";

  return (
    <NodeViewWrapper as="div" className={cn("my-3", selected && "ring-2 ring-primary rounded-lg")}>
      <EmbedHeader
        icon={<Film className="h-3.5 w-3.5 text-pink-500" />}
        title={valid ? `B 站 · ${bvid}${page > 1 ? ` · P${page}` : ""}` : "B 站视频"}
        onEdit={() => {
          const next = window.prompt("BV 号", bvid);
          if (next == null) return;
          const newBvid = next.match(/BV[a-zA-Z0-9]{10}/)?.[0] || next.trim();
          const pageInput = window.prompt("分 P（默认 1）", String(page));
          updateAttributes({ bvid: newBvid, page: Number(pageInput || 1) || 1 });
        }}
        onDelete={deleteNode}
      />
      {valid ? (
        <div className="relative w-full overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe src={src} title={bvid} loading="lazy" allowFullScreen className="absolute inset-0 h-full w-full" />
        </div>
      ) : (
        <ErrorBox label={`无效 BV 号: ${bvid || "（空）"}`} />
      )}
    </NodeViewWrapper>
  );
}

/* ============================================================
 * YouTube
 * Markdown:  [youtube:VIDEO_ID]
 * ============================================================ */
export const PlaySquareEmbed = Node.create({
  name: "youtubeEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      videoId: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-youtube-embed]",
        getAttrs: (el) => ({
          videoId: (el as HTMLElement).getAttribute("data-video-id") || "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-youtube-embed": "",
        "data-video-id": node.attrs.videoId,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaySquareView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { videoId: string } }) {
          state.write(`[youtube:${node.attrs.videoId}]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function PlaySquareView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const id = node.attrs.videoId as string;
  const valid = /^[A-Za-z0-9_-]{6,15}$/.test(id);
  const src = valid ? `https://www.youtube-nocookie.com/embed/${id}` : "";

  return (
    <NodeViewWrapper as="div" className={cn("my-3", selected && "ring-2 ring-primary rounded-lg")}>
      <EmbedHeader
        icon={<PlaySquare className="h-3.5 w-3.5 text-red-500" />}
        title={valid ? `YouTube · ${id}` : "YouTube"}
        onEdit={() => {
          const next = window.prompt("YouTube 视频 ID 或链接", id);
          if (next == null) return;
          const m = next.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,15})/);
          updateAttributes({ videoId: m ? m[1] : next.trim() });
        }}
        onDelete={deleteNode}
      />
      {valid ? (
        <div className="relative w-full overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "16/9" }}>
          <iframe src={src} title={id} loading="lazy" allowFullScreen className="absolute inset-0 h-full w-full" />
        </div>
      ) : (
        <ErrorBox label={`无效 YouTube ID: ${id || "（空）"}`} />
      )}
    </NodeViewWrapper>
  );
}

/* ============================================================
 * 网易云音乐
 * Markdown:  [netease:song:ID]  /  [netease:playlist:ID]  /  [netease:radio:ID]
 * ============================================================ */
export const NeteaseEmbed = Node.create({
  name: "neteaseEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      variant: { default: "song" },
      mediaId: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-netease-embed]",
        getAttrs: (el) => ({
          variant: (el as HTMLElement).getAttribute("data-variant") || "song",
          mediaId: (el as HTMLElement).getAttribute("data-media-id") || "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-netease-embed": "",
        "data-variant": node.attrs.variant,
        "data-media-id": node.attrs.mediaId,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NeteaseView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { variant: string; mediaId: string } }) {
          state.write(`[netease:${node.attrs.variant}:${node.attrs.mediaId}]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function NeteaseView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const variant = (node.attrs.variant as string) || "song";
  const id = (node.attrs.mediaId as string) || "";
  const valid = /^\d+$/.test(id);
  const type = variant === "playlist" ? 0 : variant === "program" ? 1 : variant === "radio" ? 3 : 2;
  const height = type === 0 || type === 3 ? 450 : 86;
  const src = valid ? `https://music.163.com/outchain/player?type=${type}&id=${id}&auto=0&height=${height - 20}` : "";

  return (
    <NodeViewWrapper as="div" className={cn("my-3", selected && "ring-2 ring-primary rounded-lg")}>
      <EmbedHeader
        icon={<Music2 className="h-3.5 w-3.5 text-red-600" />}
        title={valid ? `网易云 · ${variant} · ${id}` : "网易云音乐"}
        onEdit={() => {
          const next = window.prompt("ID（歌单填 'playlist:数字'，电台 'radio:数字'）", `${variant}:${id}`);
          if (next == null) return;
          const [v, i] = next.includes(":") ? next.split(":") : ["song", next];
          updateAttributes({ variant: v.trim(), mediaId: i.trim() });
        }}
        onDelete={deleteNode}
      />
      {valid ? (
        <iframe
          src={src}
          width="100%"
          height={height}
          className="rounded-lg border bg-card"
          title={`网易云 ${variant} ${id}`}
          loading="lazy"
        />
      ) : (
        <ErrorBox label={`无效网易云 ID: ${id || "（空）"}`} />
      )}
    </NodeViewWrapper>
  );
}

/* ============================================================
 * Live2D 模型卡
 * Markdown:  [live2d:slug]
 * ============================================================ */
export const Live2DEmbed = Node.create({
  name: "live2dEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      slug: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-live2d-embed]",
        getAttrs: (el) => ({ slug: (el as HTMLElement).getAttribute("data-slug") || "" }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-live2d-embed": "",
        "data-slug": node.attrs.slug,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(Live2DView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { slug: string } }) {
          state.write(`[live2d:${node.attrs.slug}]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function Live2DView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const slug = (node.attrs.slug as string) || "";
  return (
    <NodeViewWrapper as="div" className={cn("my-3", selected && "ring-2 ring-primary rounded-lg")}>
      <EmbedHeader
        icon={<Box className="h-3.5 w-3.5 text-blue-500" />}
        title="Live2D 模型"
        onEdit={() => {
          const next = window.prompt("Live2D 模型 slug", slug);
          if (next == null) return;
          updateAttributes({ slug: next.trim() });
        }}
        onDelete={deleteNode}
      />
      <div className="flex items-center gap-3 rounded-lg border bg-card/50 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Box className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Live2D 模型</div>
          <div className="truncate text-xs text-muted-foreground">{slug || "（未填）"}</div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/* ---------------- 共享 UI 组件 ---------------- */
function EmbedHeader({
  icon,
  title,
  onEdit,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0" contentEditable={false}>
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label="编辑"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label="删除"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ErrorBox({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {label}
    </div>
  );
}
