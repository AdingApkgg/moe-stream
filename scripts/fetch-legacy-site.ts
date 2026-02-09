#!/usr/bin/env npx tsx
/**
 * 旧站视频抓取脚本
 * 从 tv.mikiacg.org/index.php/category/Video/ 抓取视频数据并导出为批量导入格式
 *
 * 数据结构对应关系：
 *   - 分类页「找到 N 篇」= N 篇文章（archives），每篇 1 个详情页
 *   - 1 篇文章 = 1 个作者合集，合集中可含多集（episodes）
 *   - 仅从分类列表区域 .joe_archive 内取链接，不抓取侧栏/搜索框等
 *
 * 运行方式: npx tsx scripts/fetch-legacy-site.ts
 * 可选参数:
 *   --max-pages=N      最大抓取页数（默认 5，按每页约 12 篇，27 篇共 3 页）
 *   --concurrency=N    并发数（默认 8）
 *   --timeout=N        请求超时秒数（默认 20）
 *   --single=URL       只抓取单个页面（调试用）
 */

import * as cheerio from "cheerio";
import { writeFileSync } from "fs";

// ─── 配置 ────────────────────────────────────────────────

const BASE_URL = "https://tv.mikiacg.org";
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

// 从命令行参数解析配置
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    maxPages: 5,
    concurrency: 8,
    timeout: 20_000,
    single: "",
  };
  for (const arg of args) {
    const [key, val] = arg.split("=");
    if (key === "--max-pages") config.maxPages = Number(val);
    else if (key === "--concurrency") config.concurrency = Number(val);
    else if (key === "--timeout") config.timeout = Number(val) * 1000;
    else if (key === "--single") config.single = val;
  }
  return config;
}

// ─── 类型 ────────────────────────────────────────────────

interface Episode {
  num: number;
  title: string;
  videoUrl: string;
}

interface Download {
  name: string;
  url: string;
  password?: string;
}

interface VideoInfo {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  videoUrl: string;
  tags: string[];
  keywords: string[];
  episodes: Episode[];
  downloads: Download[];
  authorIntro: string;
  pageUrl: string;
  error?: string;
}

// ─── 并发控制 ────────────────────────────────────────────

async function poolAll<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onDone?: (result: T, index: number, total: number) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  let done = 0;

  async function run() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
      done++;
      onDone?.(results[i], done, tasks.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => run()));
  return results;
}

// ─── 带重试的 fetch ──────────────────────────────────────

async function fetchWithRetry(
  url: string,
  timeout: number,
  retries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await sleep(500 * attempt);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        headers: HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries - 1) throw e;
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── 从标题提取作者 ──────────────────────────────────────

function extractAuthor(title: string): string {
  const patterns = [
    /【[^】]+】\s*([^「（【\n]+?)\s*[「（]/,
    /【[^】]+】\s*([^-–\n]+?)\s*[-–]\s*第?\d/,
    /【[^】]+】\s*([A-Za-z0-9_\-\s]+?)(?:\s*$|\s*[-–])/,
    /【[^】]+】\s*([^\s「【\-（]+)/,
  ];
  for (const re of patterns) {
    const m = title.match(re);
    if (m) {
      const author = m[1].trim();
      if (author.length >= 2 && author.length <= 50) return author;
    }
  }
  return "未分类";
}

// ─── 获取分类列表页的文章链接（仅主列表区域，避免侧栏/搜索） ─────

const CATEGORY_PATH = "/index.php/category/Video";

/** 仅从 .joe_archive 主列表内取 archives 链接，保证数量与「找到 N 篇」一致 */
async function getVideoLinksFromPage(
  page: number,
  timeout: number,
): Promise<{ links: string[]; totalFromPage: number | null }> {
  const url =
    page === 1
      ? `${BASE_URL}${CATEGORY_PATH}/`
      : `${BASE_URL}${CATEGORY_PATH}/${page}/`;

  const html = await fetchWithRetry(url, timeout);
  const $ = cheerio.load(html);

  // 解析「找到 27 篇」中的总数（仅第一页有）
  let totalFromPage: number | null = null;
  const totalMatch = $(".joe_archive__title-title").text().match(/找到\s*(\d+)\s*篇/);
  if (totalMatch) totalFromPage = parseInt(totalMatch[1], 10);

  const links: string[] = [];
  const seenIds = new Set<string>();

  $(".joe_archive a[href*='/archives/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/\/archives\/(\d+)\.html/.test(href)) return;
    const id = href.replace(/.*\/archives\/(\d+)\.html.*/, "$1");
    if (seenIds.has(id)) return;
    seenIds.add(id);
    links.push(href.startsWith("http") ? href : BASE_URL + href);
  });

  return { links, totalFromPage };
}

// ─── 解码 goto 跳转链接中的 base64 URL ──────────────────

function decodeGotoUrl(raw: string): string {
  const m = raw.match(/goto\?url=([A-Za-z0-9+/=]+)/);
  if (m) {
    try {
      return Buffer.from(m[1], "base64").toString("utf-8");
    } catch {
      /* ignore */
    }
  }
  return raw;
}

// ─── 从视频页面提取信息 ──────────────────────────────────

async function extractFromPage(
  pageUrl: string,
  timeout: number,
): Promise<VideoInfo> {
  const idMatch = pageUrl.match(/\/archives\/(\d+)\.html/);
  const videoId = idMatch?.[1] ?? String(pageUrl.length);

  const base: VideoInfo = {
    id: videoId,
    title: "",
    author: "",
    description: "",
    coverUrl: "",
    videoUrl: "",
    tags: [],
    keywords: [],
    episodes: [],
    downloads: [],
    authorIntro: "",
    pageUrl,
  };

  try {
    const html = await fetchWithRetry(pageUrl, timeout);
    const $ = cheerio.load(html);

    // ── 先解析 Joe.CONTENT 脚本块（结构化数据源） ──
    const scriptContent = $("script")
      .toArray()
      .map((el) => $(el).html() ?? "")
      .join("\n");

    // Joe.CONTENT.cover — 最可靠的封面来源
    const joeContentCover =
      scriptContent.match(/Joe\.CONTENT\.cover\s*=\s*`([^`]*)`/)?.[1] ?? "";

    // Joe.CONTENT.fields — JSON 结构化字段
    let fieldsAbstract = "";
    let fieldsKeywords = "";
    let fieldsVideo = "";
    const fieldsMatch = scriptContent.match(
      /Joe\.CONTENT\.fields\s*=\s*(\{[\s\S]*?\});/,
    );
    if (fieldsMatch) {
      try {
        const fields = JSON.parse(fieldsMatch[1]);
        fieldsAbstract = fields.abstract ?? fields.description ?? "";
        fieldsKeywords = fields.keywords ?? "";
        fieldsVideo = fields.video ?? "";
      } catch {
        /* JSON 解析失败，忽略 */
      }
    }

    // ── 标题 ──
    const title = (
      $("h1.joe_detail__title").text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").text().trim() ||
      ""
    ).replace(/\s*[-|]\s*咪咔映阁.*$/, "");

    if (!title) return { ...base, error: "无标题" };

    // ── 描述（优先 fields.abstract，比 meta description 更干净） ──
    const description =
      fieldsAbstract ||
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      "";

    // ── 关键词 ──
    const keywords: string[] = fieldsKeywords
      ? fieldsKeywords
          .split(/[,，]/)
          .map((k: string) => k.trim())
          .filter(Boolean)
      : [];

    // ── 标签 ──
    const tags: string[] = [];
    $(".article-tags a").each((_, el) => {
      const text = $(el).text().replace(/^#\s*/, "").trim();
      if (text && !tags.includes(text)) tags.push(text);
    });

    // ── 封面（优先 Joe.CONTENT.cover，再 og:image） ──
    const coverUrl =
      joeContentCover ||
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $(".joe_detail__thumb").attr("src") ||
      "";

    // ── 下载链接（从 <joe-cloud> 元素） ──
    const downloads: Download[] = [];
    $("joe-cloud").each((_, el) => {
      const $el = $(el);
      const name = $el.attr("title") ?? "下载";
      const rawUrl = $el.attr("url") ?? "";
      const password = $el.attr("password") || undefined;
      if (rawUrl) {
        downloads.push({
          name,
          url: decodeGotoUrl(rawUrl),
          password: password || undefined,
        });
      }
    });

    // ── 作者介绍（从页面文章体内提取） ──
    let authorIntro = "";
    // Joe 主题的 tabs-pane 会渲染成 HTML，查找含"作者介绍"标签的内容区
    const articleHtml = $("article.joe_detail__article").html() ?? "";
    const authorIntroMatch = articleHtml.match(
      /label="作者介绍"\}([\s\S]*?)\{\/tabs-pane\}/,
    );
    if (authorIntroMatch) {
      // 清理 HTML/短代码，保留纯文本
      authorIntro = authorIntroMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\{[^}]+\}/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    // ── 剧集（核心：多层兜底） ──
    const episodes: Episode[] = [];

    // 方式 1：从剧集列表 <a class="switch-video" video-url="..." data-original-title="...">第N集</a>
    $("a.switch-video[video-url]").each((_, el) => {
      const $el = $(el);
      const url = $el.attr("video-url") ?? "";
      const subTitle = $el.attr("data-original-title")?.trim() ?? "";
      const epText = $el.text().trim();
      const numMatch = epText.match(/第(\d+)集/);
      if (!url || !numMatch) return;

      const num = Number(numMatch[1]);
      if (num > 0 && !episodes.some((e) => e.num === num)) {
        episodes.push({
          num,
          title: subTitle || `第${num}集`,
          videoUrl: url,
        });
      }
    });

    // 方式 2：从 Joe.CONTENT.fields.video（Markdown 链接 [第N集--标题](url)）
    if (episodes.length === 0 && fieldsVideo) {
      // 匹配 [第N集--副标题](url) 或 [短片--副标题](url)
      const mdRe =
        /\[(?:第(\d+)集|([^\]]+?))(?:--([^\]]*))?\]\((https?:\/\/[^)]+)\)/g;
      let m: RegExpExecArray | null;
      let autoNum = 0;
      while ((m = mdRe.exec(fieldsVideo)) !== null) {
        autoNum++;
        const num = m[1] ? Number(m[1]) : autoNum;
        const prefix = m[2] ?? "";
        const subtitle = m[3]?.trim() ?? "";
        const url = m[4];

        const epTitle = subtitle
          ? prefix
            ? `${prefix} - ${subtitle}`
            : subtitle
          : prefix || `第${num}集`;

        if (!episodes.some((e) => e.num === num)) {
          episodes.push({ num, title: epTitle, videoUrl: url });
        }
      }
    }

    // 方式 3：兜底 — DPlayer 初始化 URL 或页面内唯一视频
    if (episodes.length === 0) {
      const dplayerVideo = $(".dplayer-video source").attr("src") ?? "";
      if (dplayerVideo) {
        episodes.push({ num: 1, title: "正片", videoUrl: dplayerVideo });
      }
    }

    episodes.sort((a, b) => a.num - b.num);

    return {
      id: videoId,
      title,
      author: extractAuthor(title),
      description,
      coverUrl,
      videoUrl: episodes[0]?.videoUrl ?? "",
      tags,
      keywords,
      episodes,
      downloads,
      authorIntro,
      pageUrl,
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── 生成批量导入文本 ────────────────────────────────────

function generateImportText(videos: VideoInfo[]): {
  text: string;
  count: number;
} {
  const valid = videos.filter(
    (v) => v.title && !v.error && (v.videoUrl || v.episodes.length > 0),
  );

  // 按作者分组
  const grouped = new Map<string, VideoInfo[]>();
  for (const v of valid) {
    const author = v.author || "未分类";
    if (!grouped.has(author)) grouped.set(author, []);
    grouped.get(author)!.push(v);
  }

  const lines: string[] = [];
  let count = 0;

  for (const [author, vids] of [...grouped.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    // ── 作者头部：共享字段只输出一次（作者即合集） ──
    lines.push(`作者：${author}`);

    // 取第一个视频的共享字段作为合集级数据
    const ref = vids[0];

    if (ref.coverUrl) lines.push(`封面：${ref.coverUrl}`);

    // 合并 tags + keywords 去重
    const allTags = [...ref.tags];
    for (const kw of ref.keywords) {
      if (!allTags.includes(kw)) allTags.push(kw);
    }
    if (allTags.length) lines.push(`标签：${allTags.join(",")}`);

    // 描述：优先用作者介绍（更丰富），退而用摘要
    const seriesDesc = ref.authorIntro || ref.description;
    if (seriesDesc) lines.push(`描述：${seriesDesc}`);

    if (ref.downloads.length) {
      const dlStr = ref.downloads
        .map((d) => {
          let s = `${d.name}|${d.url}`;
          if (d.password) s += `|${d.password}`;
          return s;
        })
        .join("; ");
      lines.push(`下载：${dlStr}`);
    }

    lines.push(""); // 空行分隔头部与剧集

    // ── 剧集：每集仅标题 + 视频 ──
    for (const v of vids) {
      const writeEpisode = (ep: Episode) => {
        lines.push(`标题：${v.title} - ${ep.title}`);
        lines.push(`视频：${ep.videoUrl}`);
        lines.push("");
        count++;
      };

      if (v.episodes.length > 1) {
        for (const ep of v.episodes.filter((e) => e.videoUrl)) {
          writeEpisode(ep);
        }
      } else if (v.episodes.length === 1) {
        writeEpisode(v.episodes[0]);
      } else if (v.videoUrl) {
        lines.push(`标题：${v.title}`);
        lines.push(`视频：${v.videoUrl}`);
        lines.push("");
        count++;
      }
    }
  }

  return { text: lines.join("\n"), count };
}

// ─── 主流程 ──────────────────────────────────────────────

async function main() {
  const config = parseArgs();
  const startTime = performance.now();

  // 单页调试模式
  if (config.single) {
    console.log(`单页调试: ${config.single}`);
    const info = await extractFromPage(config.single, config.timeout);
    console.log(`标题: ${info.title}`);
    console.log(`作者: ${info.author}`);
    console.log(`描述: ${info.description.slice(0, 80)}${info.description.length > 80 ? "..." : ""}`);
    console.log(`封面: ${info.coverUrl}`);
    console.log(`标签: ${info.tags.join(", ") || "（无）"}`);
    console.log(`关键词: ${info.keywords.join(", ") || "（无）"}`);
    console.log(`下载: ${info.downloads.length ? info.downloads.map((d) => `${d.name}: ${d.url}`).join("; ") : "（无）"}`);
    console.log(`作者介绍: ${info.authorIntro ? info.authorIntro.slice(0, 80) + "..." : "（无）"}`);
    console.log(`剧集数: ${info.episodes.length}`);
    if (info.episodes.length > 0) {
      console.log("前 3 集:");
      for (const ep of info.episodes.slice(0, 3)) {
        console.log(`  ${ep.num}. ${ep.title} → ${ep.videoUrl.slice(-50)}`);
      }
      if (info.episodes.length > 3) {
        console.log("后 2 集:");
        for (const ep of info.episodes.slice(-2)) {
          console.log(`  ${ep.num}. ${ep.title} → ${ep.videoUrl.slice(-50)}`);
        }
      }
    }
    if (info.error) console.log(`错误: ${info.error}`);
    return;
  }

  console.log(`开始抓取 ${BASE_URL}/index.php/category/Video/`);
  console.log(
    `最大页数: ${config.maxPages}, 并发数: ${config.concurrency}`,
  );
  console.log("─".repeat(50));

  // 1) 仅从分类主列表 .joe_archive 获取文章链接（串行翻页）
  const allLinks = new Set<string>();
  let expectedTotal: number | null = null;

  for (let page = 1; page <= config.maxPages; page++) {
    process.stdout.write(`获取第 ${page} 页...`);
    try {
      const { links, totalFromPage } = await getVideoLinksFromPage(page, config.timeout);
      if (totalFromPage != null) expectedTotal = totalFromPage;
      if (links.length === 0) {
        console.log(" 无更多内容，停止");
        break;
      }
      for (const l of links) allLinks.add(l);
      console.log(` 本页 ${links.length} 篇${expectedTotal != null ? `（分类共 ${expectedTotal} 篇）` : ""}`);
      if (expectedTotal != null && allLinks.size >= expectedTotal) {
        console.log(` 已收齐 ${expectedTotal} 篇，停止翻页`);
        break;
      }
    } catch (e) {
      console.log(` 失败: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  const uniqueLinks = [...allLinks];
  console.log(`\n共 ${uniqueLinks.length} 篇文章（每篇 = 1 个作者合集，可含多集）`);
  console.log("─".repeat(50));

  // 2) 并发抓取详情页
  const tasks = uniqueLinks.map(
    (link) => () => extractFromPage(link, config.timeout),
  );

  const videos = await poolAll(tasks, config.concurrency, (result, done, total) => {
    const status = result.error
      ? `✗ ${result.error}`
      : result.videoUrl || result.episodes.length > 0
        ? "✓"
        : "✗ 无视频";
    const name = result.title ? result.title.slice(0, 30) : "未知";
    console.log(`[${done}/${total}] ${name} ${status}`);
  });

  console.log("─".repeat(50));

  // 3) 统计
  const validCount = videos.filter((v) => v.title && !v.error).length;
  const noVideoCount = videos.filter(
    (v) => v.title && !v.error && !v.videoUrl && v.episodes.length === 0,
  ).length;
  const errorCount = videos.filter((v) => v.error).length;
  const totalEpisodes = videos
    .filter((v) => v.title && !v.error)
    .reduce(
      (sum, v) =>
        sum +
        (v.episodes.length > 1
          ? v.episodes.filter((e) => e.videoUrl).length
          : v.videoUrl
            ? 1
            : 0),
      0,
    );

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

  console.log(`抓取完成 (${elapsed}s):`);
  console.log(`  文章数: ${validCount}（每篇 1 个作者合集）`);
  console.log(`  总集数: ${totalEpisodes}`);
  console.log(`  无视频: ${noVideoCount}`);
  console.log(`  失败数: ${errorCount}`);

  // 4) 生成导入文本并保存
  const { text: importText, count: videoCount } = generateImportText(videos);
  const timestamp = new Date()
    .toISOString()
    .replace(/[T:]/g, "_")
    .slice(0, 19);
  const outputFile = `legacy_import_${timestamp}.md`;

  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const header = `# 旧站视频导入数据\n\n抓取时间: ${now}\n文章数: ${validCount}, 导出视频条数: ${videoCount}\n\n---\n\n`;

  writeFileSync(outputFile, header + importText, "utf-8");
  console.log(`\n已保存到: ${outputFile}`);
  console.log(`导出视频数: ${videoCount}`);
}

main().catch((e) => {
  console.error("致命错误:", e);
  process.exit(1);
});
