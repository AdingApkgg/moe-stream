import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Lock,
  Trash2,
  XCircle,
  GripVertical,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MdSerializerState {
  write: (text: string) => void;
  closeBlock: (node: unknown) => void;
  renderContent: (node: unknown) => void;
  ensureNewLine: () => void;
}

/* ============================================================
 * Callout（提示框）  4 个 variant: info / warning / success / error
 * Markdown 块语法：
 *   [callout type=info]
 *   …markdown content…
 *   [/callout]
 * HTML（HTML 解析路径用）：<div data-callout data-variant="info">…</div>
 * ============================================================ */
export type CalloutVariant = "info" | "warning" | "success" | "error";

const CALLOUT_VARIANTS: CalloutVariant[] = ["info", "warning", "success", "error"];

const CALLOUT_PRESET: Record<
  CalloutVariant,
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  info: {
    icon: Info,
    label: "提示",
    cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
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
  error: {
    icon: XCircle,
    label: "错误",
    cls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (el) => (el.getAttribute("data-variant") || "info") as CalloutVariant,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": "",
        "data-variant": node.attrs.variant,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { variant: CalloutVariant } }) {
          state.write(`[callout type=${node.attrs.variant}]\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`[/callout]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function CalloutView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) || "info";
  const preset = CALLOUT_PRESET[variant] ?? CALLOUT_PRESET.info;
  const Icon = preset.icon;

  return (
    <NodeViewWrapper as="div" className={cn("my-3 rounded-lg border px-3 py-2", preset.cls)}>
      <div className="mb-1 flex items-center justify-between gap-2" contentEditable={false}>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Icon className="h-3.5 w-3.5" />
          <span>{preset.label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {CALLOUT_VARIANTS.map((v) => {
            const VIcon = CALLOUT_PRESET[v].icon;
            return (
              <button
                key={v}
                type="button"
                onClick={() => updateAttributes({ variant: v })}
                className={cn(
                  "rounded p-1 hover:bg-background/50",
                  v === variant ? "ring-1 ring-current" : "opacity-60",
                )}
                title={CALLOUT_PRESET[v].label}
              >
                <VIcon className="h-3 w-3" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={deleteNode}
            className="ml-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <NodeViewContent className="text-sm text-foreground" />
    </NodeViewWrapper>
  );
}

/* ============================================================
 * HiddenContent（隐藏内容）
 * Markdown 块语法：
 *   [hidden cond=login]…[/hidden]
 *   [hidden cond=comment]…[/hidden]
 * ============================================================ */
export type HiddenCondition = "login" | "comment";
const HIDDEN_CONDITIONS: HiddenCondition[] = ["login", "comment"];

export const HiddenContent = Node.create({
  name: "hiddenContent",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      condition: {
        default: "login",
        parseHTML: (el) => (el.getAttribute("data-cond") || "login") as HiddenCondition,
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-hidden]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-hidden": "",
        "data-cond": node.attrs.condition,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HiddenContentView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { condition: HiddenCondition } }) {
          state.write(`[hidden cond=${node.attrs.condition}]\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`[/hidden]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function HiddenContentView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const cond = (node.attrs.condition as HiddenCondition) || "login";
  const tip = cond === "login" ? "登录后可见" : "评论后可见";

  return (
    <NodeViewWrapper as="div" className="my-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2" contentEditable={false}>
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Lock className="h-3.5 w-3.5" />
          <span>{tip}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {HIDDEN_CONDITIONS.map((c) => {
            const Icon = c === "login" ? Lock : MessageSquare;
            return (
              <button
                key={c}
                type="button"
                onClick={() => updateAttributes({ condition: c })}
                className={cn("rounded p-1 hover:bg-background/50", c === cond ? "ring-1 ring-current" : "opacity-60")}
                title={c === "login" ? "登录可见" : "评论可见"}
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={deleteNode}
            className="ml-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <NodeViewContent className="text-sm" />
    </NodeViewWrapper>
  );
}

/* ============================================================
 * Details（折叠面板）
 * Markdown 块语法：
 *   [details summary="点击展开" open=true]
 *   …content…
 *   [/details]
 * ============================================================ */
export const Details = Node.create({
  name: "details",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => el.getAttribute("data-open") !== "false",
      },
      summary: {
        default: "点击展开/收起",
        parseHTML: (el) => el.getAttribute("data-summary") || "点击展开/收起",
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-details]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-details": "",
        "data-open": String(node.attrs.open),
        "data-summary": node.attrs.summary,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DetailsView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { open: boolean; summary: string } }) {
          const summary = String(node.attrs.summary || "").replace(/"/g, "'");
          state.write(`[details summary="${summary}" open=${node.attrs.open ? "true" : "false"}]\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`[/details]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function DetailsView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const open = !!node.attrs.open;
  const summary = (node.attrs.summary as string) || "点击展开/收起";

  return (
    <NodeViewWrapper as="div" className="my-3 rounded-lg border bg-card/50">
      <div className="flex items-center gap-1 px-2 py-1.5" contentEditable={false}>
        <button
          type="button"
          onClick={() => updateAttributes({ open: !open })}
          className="rounded p-1 hover:bg-accent text-muted-foreground"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
        </button>
        <input
          type="text"
          value={summary}
          onChange={(e) => updateAttributes({ summary: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
          placeholder="折叠标题"
        />
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="删除"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="border-t px-3 py-2">
          <NodeViewContent className="text-sm" />
        </div>
      )}
      {!open && (
        <div className="hidden">
          {/* 必须保留 NodeViewContent，否则内容会丢；用 hidden 让用户视觉上感受折叠 */}
          <NodeViewContent />
        </div>
      )}
    </NodeViewWrapper>
  );
}

/* ============================================================
 * Gallery（多图画廊）— atomic，images 存在 attrs 里
 * Markdown 块语法：
 *   [gallery]
 *   url1
 *   url2
 *   [/gallery]
 * ============================================================ */
export const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [] as string[],
        parseHTML: (el) => {
          const raw = el.getAttribute("data-images") || "";
          return raw.split("|").filter(Boolean);
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-gallery]",
        getAttrs: (el) => ({
          images: ((el as HTMLElement).getAttribute("data-images") || "").split("|").filter(Boolean),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-gallery": "",
        "data-images": (node.attrs.images as string[]).join("|"),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MdSerializerState, node: { attrs: { images: string[] } }) {
          state.write(`[gallery]\n${(node.attrs.images || []).join("\n")}\n[/gallery]`);
          state.closeBlock(node);
        },
        parse: { setup: () => {} },
      },
    };
  },
});

function GalleryView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const images: string[] = node.attrs.images || [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(images.join("\n"));

  return (
    <NodeViewWrapper as="div" className={cn("my-3", selected && "ring-2 ring-primary rounded-lg p-1")}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3 w-3" />
          <span>画廊 · {images.length} 张</span>
        </div>
        <div className="flex items-center gap-0.5" contentEditable={false}>
          <button
            type="button"
            onClick={() => {
              setDraft(images.join("\n"));
              setEditing((v) => !v);
            }}
            className="rounded px-1.5 py-0.5 text-xs hover:bg-accent"
          >
            {editing ? "完成" : "编辑列表"}
          </button>
          <button
            type="button"
            onClick={deleteNode}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {editing ? (
        <div className="space-y-2" contentEditable={false}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const urls = draft
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean);
              updateAttributes({ images: urls });
            }}
            rows={Math.max(3, draft.split(/\n/).length)}
            className="w-full rounded-md border bg-background p-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="每行一个图片地址…"
          />
        </div>
      ) : images.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div key={i} className="aspect-square overflow-hidden rounded-md border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          画廊为空，点击「编辑列表」添加图片
        </div>
      )}
    </NodeViewWrapper>
  );
}
