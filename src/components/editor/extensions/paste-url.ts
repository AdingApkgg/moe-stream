import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * 粘贴含 B 站 / YouTube URL 时自动转成对应的 NodeView。
 * 只处理"纯链接"粘贴（剪贴板中只有一条 URL），避免误改富文本粘贴。
 */
export const PasteUrlEmbed = Extension.create({
  name: "pasteUrlEmbed",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("pasteUrlEmbed"),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text) return false;
            if (/\s/.test(text)) return false; // 含空白说明不是单纯 URL
            const node = matchUrl(text);
            if (!node) return false;
            editor.chain().focus().insertContent(node).run();
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});

function matchUrl(
  url: string,
):
  | { type: "bilibiliEmbed"; attrs: { bvid: string; page: number } }
  | { type: "youtubeEmbed"; attrs: { videoId: string } }
  | null {
  // Bilibili: https://www.bilibili.com/video/BVxxxxxxxxxx  /  https://b23.tv/...
  const bv = url.match(/BV[a-zA-Z0-9]{10}/);
  if (bv && /bilibili\.com|b23\.tv/.test(url)) {
    const page = Number(url.match(/[?&]p=(\d+)/)?.[1] ?? 1) || 1;
    return { type: "bilibiliEmbed", attrs: { bvid: bv[0], page } };
  }
  // YouTube: youtu.be/<id>  /  youtube.com/watch?v=<id>  /  youtube.com/embed/<id>
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/);
  if (yt) return { type: "youtubeEmbed", attrs: { videoId: yt[1] } };
  return null;
}
