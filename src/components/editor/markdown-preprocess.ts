/**
 * Markdown ⇄ Tiptap 在 setContent / getMarkdown 之外的"自定义块"转换。
 *
 * 流程：
 *   1. 加载 markdown → 调用 expandShortcodes() 把 [bilibili:xx]、[callout type=info]...[/callout]
 *      转换成 <div data-* > … </div> 形态的 HTML 字符串
 *   2. 把替换后的 markdown 喂给 tiptap-markdown，它会将其中的 HTML 透传，再被 Tiptap
 *      节点的 parseHTML() 识别成对应 Node
 *
 * 反向（保存）流程由各 Node 的 addStorage().markdown.serialize 直接产出短代码字符串。
 */

/* 行内原子型短代码 → HTML */
const INLINE_PATTERNS: Array<{
  regex: RegExp;
  toHtml: (groups: RegExpExecArray) => string;
}> = [
  {
    // [bilibili:BVxx]  或  [bilibili:BVxx:2]
    regex: /\[bilibili:(BV[a-zA-Z0-9]{10})(?::(\d+))?\]/g,
    toHtml: (m) => `<div data-bilibili-embed data-bvid="${m[1]}" data-page="${m[2] || 1}"></div>`,
  },
  {
    regex: /\[youtube:([A-Za-z0-9_-]{6,15})\]/g,
    toHtml: (m) => `<div data-youtube-embed data-video-id="${m[1]}"></div>`,
  },
  {
    regex: /\[netease:(song|playlist|program|radio):(\d+)\]/g,
    toHtml: (m) => `<div data-netease-embed data-variant="${m[1]}" data-media-id="${m[2]}"></div>`,
  },
  {
    regex: /\[live2d:([a-zA-Z0-9_-]+)\]/g,
    toHtml: (m) => `<div data-live2d-embed data-slug="${m[1]}"></div>`,
  },
];

/* 块级带内容的短代码 → HTML（含内层 markdown，注意空行使 tiptap-markdown 把内部当 markdown 解析） */
const BLOCK_PATTERNS: Array<{
  open: RegExp;
  close: RegExp;
  build: (groups: RegExpExecArray, inner: string) => string;
}> = [
  {
    open: /^\[callout\s+type=(info|warning|success|error)\]\s*$/m,
    close: /^\[\/callout\]\s*$/m,
    build: (m, inner) => `<div data-callout data-variant="${m[1]}">\n\n${inner}\n\n</div>`,
  },
  {
    open: /^\[hidden\s+cond=(login|comment)\]\s*$/m,
    close: /^\[\/hidden\]\s*$/m,
    build: (m, inner) => `<div data-hidden data-cond="${m[1]}">\n\n${inner}\n\n</div>`,
  },
  {
    open: /^\[details\s+summary="([^"]*)"\s+open=(true|false)\]\s*$/m,
    close: /^\[\/details\]\s*$/m,
    build: (m, inner) =>
      `<div data-details data-summary="${escapeAttr(m[1])}" data-open="${m[2]}">\n\n${inner}\n\n</div>`,
  },
  {
    open: /^\[gallery\]\s*$/m,
    close: /^\[\/gallery\]\s*$/m,
    build: (_m, inner) => {
      const urls = inner
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      return `<div data-gallery data-images="${urls.join("|")}"></div>`;
    },
  },
];

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 把所有短代码（inline + block）展开为带 data-* 属性的 HTML，供 Tiptap parseHTML 识别。*/
export function expandShortcodes(markdown: string): string {
  let out = expandBlocks(markdown);
  for (const p of INLINE_PATTERNS) {
    out = out.replace(p.regex, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      return p.toHtml(m);
    });
  }
  return out;
}

function expandBlocks(input: string): string {
  let working = input;
  let changed = true;
  let safety = 0;
  while (changed && safety++ < 50) {
    changed = false;
    for (const p of BLOCK_PATTERNS) {
      const openMatch = p.open.exec(working);
      if (!openMatch) continue;
      // 从 open 之后找最近的 close
      const startIdx = openMatch.index + openMatch[0].length;
      const rest = working.slice(startIdx);
      const closeMatch = p.close.exec(rest);
      if (!closeMatch) continue;
      const closeAbsStart = startIdx + closeMatch.index;
      const inner = working.slice(startIdx, closeAbsStart).replace(/^\n+|\n+$/g, "");
      const replacement = p.build(openMatch, inner);
      working = working.slice(0, openMatch.index) + replacement + working.slice(closeAbsStart + closeMatch[0].length);
      changed = true;
      break; // 重新扫一轮，保证嵌套块都展开
    }
  }
  return working;
}
