import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Markdown } from "tiptap-markdown";
import { createMention, type MentionFetcher } from "./mention";
import { SlashCommand } from "./slash-command";
import { BilibiliEmbed, PlaySquareEmbed, NeteaseEmbed, Live2DEmbed } from "./nodes/embeds";
import { Callout, HiddenContent, Details, Gallery } from "./nodes/blocks";
import { PasteUrlEmbed } from "./paste-url";

export type EditorVariant = "comment" | "post" | "doc";

export interface BuildExtensionsOptions {
  /** comment: 仅行内格式 / post: 段落级 / doc: 全功能（含媒体、块、斜杠命令） */
  variant?: EditorVariant;
  placeholder?: string;
  /** 字符数上限（CharacterCount limit） */
  maxLength?: number;
  /** 传入则启用 @mention，传 null 显式关闭 */
  mentionFetcher?: MentionFetcher | null;
}

export function buildExtensions({
  variant = "post",
  placeholder = "",
  maxLength,
  mentionFetcher,
}: BuildExtensionsOptions = {}) {
  const allowBlocks = variant !== "comment";
  // 媒体节点与斜杠命令仅在 post/doc 启用；comment 保持轻量
  const enableRichBlocks = allowBlocks;

  return [
    StarterKit.configure({
      heading: allowBlocks ? { levels: [1, 2, 3] } : false,
      horizontalRule: allowBlocks ? {} : false,
      codeBlock: allowBlocks ? {} : false,
      // 评论变体保留行内代码、列表、引用
      blockquote: {},
      bulletList: {},
      orderedList: {},
      listItem: {},
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto", "mention"],
      HTMLAttributes: {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      },
    }),
    Image.configure({
      inline: false,
      HTMLAttributes: {
        class: "rounded-lg max-w-full h-auto my-2",
        loading: "lazy",
      },
    }),
    Placeholder.configure({ placeholder }),
    CharacterCount.configure(maxLength != null ? { limit: maxLength } : {}),
    Markdown.configure({
      // 启用 HTML 让 expandShortcodes() 产出的 <div data-*> 可被 Tiptap parseHTML 接管
      html: enableRichBlocks,
      breaks: true,
      tightLists: true,
      bulletListMarker: "-",
      linkify: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    ...(mentionFetcher ? [createMention(mentionFetcher)] : []),
    ...(enableRichBlocks
      ? [
          SlashCommand,
          PasteUrlEmbed,
          BilibiliEmbed,
          PlaySquareEmbed,
          NeteaseEmbed,
          Live2DEmbed,
          Callout,
          HiddenContent,
          Details,
          Gallery,
        ]
      : []),
  ];
}
