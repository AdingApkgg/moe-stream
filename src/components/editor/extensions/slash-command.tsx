import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { SLASH_ITEMS, SlashMenu, type SlashItem, type SlashMenuRef } from "../slash-menu";

/** Notion 式斜杠命令：在空行/段尾输入 "/" 弹出可搜索菜单。*/
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }: { query: string }) => filterItems(query),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Parameters<SlashItem["command"]>[0];
          range: Parameters<SlashItem["command"]>[1];
          props: SlashItem;
        }) => {
          props.command(editor, range);
        },
        render: () => {
          let component: ReactRenderer<SlashMenuRef, SuggestionProps<SlashItem>> | null = null;
          let popupEl: HTMLDivElement | null = null;

          const place = (rect: () => DOMRect | null) => {
            if (!popupEl) return;
            const r = rect();
            if (!r) return;
            const top = r.bottom + 6 + window.scrollY;
            const left = Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - 304));
            popupEl.style.top = `${top}px`;
            popupEl.style.left = `${left}px`;
          };

          return {
            onStart(props: SuggestionProps<SlashItem>) {
              component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              if (!props.clientRect) return;
              popupEl = document.createElement("div");
              popupEl.style.position = "absolute";
              popupEl.style.zIndex = "9999";
              popupEl.appendChild(component.element);
              document.body.appendChild(popupEl);
              place(props.clientRect);
            },
            onUpdate(props: SuggestionProps<SlashItem>) {
              component?.updateProps(props);
              if (props.clientRect) place(props.clientRect);
            },
            onKeyDown(props) {
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
      } as Partial<SuggestionOptions<SlashItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((it) => {
    if (it.title.toLowerCase().includes(q)) return true;
    return it.keywords.some((k) => k.toLowerCase().includes(q));
  });
}
