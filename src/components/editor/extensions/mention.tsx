import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { MentionList, type MentionListRef, type MentionItem } from "../mention-list";

export type MentionFetcher = (query: string) => Promise<MentionItem[]>;

interface MarkdownSerializerState {
  write: (text: string) => void;
}

interface MentionAttrs {
  id: string;
  label?: string | null;
}

/**
 * 构造一个带 React 弹层 + Markdown 序列化的 @mention 扩展。
 * 序列化格式：`[@nickname](mention:userId)`，是合法 Markdown 链接，
 * 在 <RichContent /> 内会被识别为 MentionChip。
 */
export function createMention(fetcher: MentionFetcher) {
  return Mention.extend({
    addStorage() {
      return {
        ...this.parent?.(),
        markdown: {
          serialize(state: MarkdownSerializerState, node: { attrs: MentionAttrs }) {
            const label = node.attrs.label ?? node.attrs.id;
            state.write(`[@${label}](mention:${node.attrs.id})`);
          },
          parse: { setup: () => {} },
        },
      };
    },
  }).configure({
    HTMLAttributes: {
      class: "mention inline-flex items-center px-1 rounded bg-primary/10 text-primary text-[0.95em] font-medium",
      "data-mention": "",
    },
    suggestion: {
      char: "@",
      items: ({ query }: { query: string }) => fetcher(query),
      render: () => {
        let component: ReactRenderer<MentionListRef, SuggestionProps<MentionItem>> | null = null;
        let popupEl: HTMLDivElement | null = null;

        const updatePos = (rect: () => DOMRect | null) => {
          if (!popupEl) return;
          const r = rect();
          if (!r) return;
          popupEl.style.top = `${r.bottom + 6 + window.scrollY}px`;
          popupEl.style.left = `${r.left + window.scrollX}px`;
        };

        return {
          onStart(props: SuggestionProps<MentionItem>) {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });
            if (!props.clientRect) return;
            popupEl = document.createElement("div");
            popupEl.style.position = "absolute";
            popupEl.style.zIndex = "9999";
            popupEl.appendChild(component.element);
            document.body.appendChild(popupEl);
            updatePos(props.clientRect);
          },
          onUpdate(props: SuggestionProps<MentionItem>) {
            component?.updateProps(props);
            if (props.clientRect) updatePos(props.clientRect);
          },
          onKeyDown(props: SuggestionKeyDownProps) {
            if (props.event.key === "Escape") {
              popupEl?.remove();
              popupEl = null;
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit() {
            popupEl?.remove();
            popupEl = null;
            component?.destroy();
            component = null;
          },
        };
      },
    },
  });
}
