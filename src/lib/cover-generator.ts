import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
import { COVER_CONFIG } from "@/lib/cover-config";

export type CoverFormat = (typeof COVER_CONFIG.formats)[number];

// ========== 结构化日志 ==========

import { pushCoverLog } from "@/lib/cover-queue";

function log(tag: string, msg: string, ...args: unknown[]) {
  pushCoverLog(tag, msg, ...args);
}

// ========== ffmpeg / ffprobe ==========

type FfmpegResult = { ok: boolean; stderr: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

/**
 * 获取用于限制远程 URL 流分析开销的 ffmpeg 参数
 * HLS 流需要更大的分析窗口和协议白名单
 */
function getStreamHints(videoUrl?: string): string[] {
  const hls = videoUrl && isHlsUrl(videoUrl);
  return [
    "-analyzeduration",
    String(hls ? COVER_CONFIG.analyzeDuration * 3 : COVER_CONFIG.analyzeDuration),
    "-probesize",
    String(hls ? COVER_CONFIG.probeSize * 3 : COVER_CONFIG.probeSize),
  ];
}

/**
 * 获取远程 URL 的 HTTP 头和协议参数
 * 对 HLS 流添加协议白名单，对所有远程 URL 添加 User-Agent
 */
function getRemoteInputArgs(videoUrl: string): string[] {
  const args: string[] = [];
  if (/^https?:\/\//i.test(videoUrl)) {
    args.push("-headers", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n");
  }
  if (isHlsUrl(videoUrl)) {
    args.push("-protocol_whitelist", "file,http,https,tcp,tls,crypto");
  }
  return args;
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<FfmpegResult> {
  return new Promise((resolve) => {
    log("ffmpeg", `执行: ffmpeg ${args.slice(0, 10).join(" ")}...`);
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        log("ffmpeg", `超时 (${timeoutMs}ms)，终止进程`);
        proc.kill("SIGKILL");
      }
    }, timeoutMs);

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      settled = true;
      clearTimeout(timer);
      if (code !== 0) log("ffmpeg", `退出码: ${code}, 错误: ${stderr.slice(-200)}`);
      resolve({ ok: code === 0, stderr });
    });

    proc.on("error", (err) => {
      settled = true;
      clearTimeout(timer);
      log("ffmpeg", `启动失败: ${String(err)}`);
      resolve({ ok: false, stderr: String(err) });
    });
  });
}

/**
 * 使用 ffprobe 获取视频时长（秒）
 * 添加了 -analyzeduration / -probesize 限制远程 URL 的探测开销
 */
export function getVideoDuration(videoUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const hls = isHlsUrl(videoUrl);
    const args = [
      ...getStreamHints(videoUrl),
      ...getRemoteInputArgs(videoUrl),
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoUrl,
    ];
    const probeTimeout = hls ? COVER_CONFIG.probeTimeout * 3 : COVER_CONFIG.probeTimeout;
    log("ffprobe", `获取视频时长: ${videoUrl.slice(0, 80)}...`);
    const proc = spawn("ffprobe", args);
    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        log("ffprobe", `超时 (${probeTimeout}ms)，使用默认采样点`);
        resolve(null);
      }
    }, probeTimeout);

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve(null);
        return;
      }
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration) || duration <= 0) {
        resolve(null);
        return;
      }
      log("ffprobe", `视频时长: ${duration.toFixed(1)}s`);
      resolve(duration);
    });
    proc.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * 根据视频时长动态计算采样点
 */
export function computeSamplePoints(duration: number | null, count: number): number[] {
  const fallback = [...COVER_CONFIG.samplePoints];
  if (!duration || duration <= 0) return fallback;

  // 极短视频 (<3s): 在有限范围内均匀采样
  if (duration < 3) {
    const pts = [duration * 0.3, duration * 0.5, duration * 0.7];
    return pts.slice(0, count).map((t) => Math.round(t * 10) / 10);
  }

  // 短视频 (<10s): 从 0.5s 到 duration-0.5s 均匀分布
  if (duration < 10) {
    const start = 0.5;
    const end = duration - 0.5;
    const step = count > 1 ? (end - start) / (count - 1) : 0;
    return Array.from({ length: count }, (_, i) => Math.round((start + i * step) * 10) / 10);
  }

  // 正常/长视频: 从 5% 到 75% 区间均匀分布
  const start = duration * 0.05;
  const end = duration * 0.75;
  const step = count > 1 ? (end - start) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => Math.round((start + i * step) * 10) / 10);
}

// ========== 帧提取与分析 ==========

async function extractFrame(
  videoUrl: string,
  timeSec: number,
  outputPath: string,
  width: number,
  timeoutMs: number,
): Promise<boolean> {
  const hls = isHlsUrl(videoUrl);
  const args = [
    "-ss",
    String(timeSec),
    ...getStreamHints(videoUrl),
    ...getRemoteInputArgs(videoUrl),
    "-i",
    videoUrl,
    "-vframes",
    "1",
    "-vf",
    `scale=${width}:-2`,
    "-q:v",
    "2",
    "-y",
    outputPath,
  ];
  const effectiveTimeout = hls ? Math.max(timeoutMs, 45000) : timeoutMs;
  const result = await runFfmpeg(args, effectiveTimeout);
  return result.ok;
}

/**
 * 分析帧质量：亮度、对比度、锐度、饱和度
 * 评分公式: brightness * 0.3 + contrast * 0.25 + sharpness * 0.25 + saturation * 0.2
 */
async function analyzeFrame(filePath: string): Promise<{
  brightness: number;
  contrast: number;
  sharpness: number;
  saturation: number;
  score: number;
  valid: boolean;
}> {
  const analysisWidth = COVER_CONFIG.analysisWidth;
  const resized = sharp(filePath).resize(analysisWidth, undefined, {
    withoutEnlargement: true,
    fastShrinkOnLoad: true,
  });

  const [stats, sharpnessRaw] = await Promise.all([
    resized.clone().stats(),
    resized
      .clone()
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      })
      .stats()
      .then((s) => s.channels[0]?.stdev ?? 0)
      .catch(() => 0),
  ]);

  const channels = stats.channels;
  const red = channels[0];
  const green = channels[1];
  const blue = channels[2];

  const mean = red && green && blue ? (red.mean + green.mean + blue.mean) / 3 : (channels[0]?.mean ?? 0);
  const stddev = red && green && blue ? (red.stdev + green.stdev + blue.stdev) / 3 : (channels[0]?.stdev ?? 0);

  const finalSharpness = sharpnessRaw || stddev;

  // HSV 饱和度近似：利用 RGB 通道均值计算
  const maxCh = red && green && blue ? Math.max(red.mean, green.mean, blue.mean) : 0;
  const minCh = red && green && blue ? Math.min(red.mean, green.mean, blue.mean) : 0;
  const rawSaturation = maxCh > 0 ? (maxCh - minCh) / maxCh : 0;

  const tooDark = mean < 10;
  const tooBright = mean > 245;
  const valid = !tooDark && !tooBright;

  const brightness = 1 - Math.min(1, Math.abs(mean - 128) / 128);
  const contrast = Math.min(1, stddev / 64);
  const sharpness = Math.min(1, finalSharpness / 50);
  const saturation = Math.min(1, rawSaturation);

  const score = brightness * 0.3 + contrast * 0.25 + sharpness * 0.25 + saturation * 0.2;

  return { brightness, contrast, sharpness, saturation, score, valid };
}

// ========== 智能选帧 ==========

export interface BestFrameResult {
  timeSec: number;
  framePath: string;
  tempDir: string;
  score: number;
}

/**
 * 智能选帧：串行提取采样帧 + 质量分析
 * 返回最佳帧的路径和临时目录（调用者负责清理 tempDir）
 *
 * 优化:
 * - 串行提取 + 交错延迟，避免并发请求冲击 CDN
 * - 早停机制：得分足够高时跳过剩余采样点
 * - ffprobe 超时后立即回退到默认采样点（不阻塞）
 * - ffmpeg 添加 -analyzeduration / -probesize 限制流分析
 * - 帧分析在低分辨率下进行（analysisWidth）
 */
export async function selectBestFrame(
  videoUrl: string,
  options?: {
    samplePoints?: number[];
    width?: number;
    timeoutMs?: number;
  },
): Promise<BestFrameResult | null> {
  const width = options?.width ?? COVER_CONFIG.width;
  const timeoutMs = options?.timeoutMs ?? COVER_CONFIG.timeout;

  // 获取视频时长 → 动态采样点（超时自动回退到固定采样点）
  let samplePoints = options?.samplePoints;
  if (!samplePoints || samplePoints.length === 0) {
    const duration = await getVideoDuration(videoUrl);
    samplePoints = computeSamplePoints(duration, COVER_CONFIG.sampleCount);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cover-frames-"));
  log("CoverGen", `采样点: [${samplePoints.map((t) => t.toFixed(1)).join(", ")}]s, 宽度: ${width}px`);

  try {
    // 串行提取采样帧（避免并发请求冲击 CDN 导致 Connection reset）
    // 每帧之间交错 300ms，并支持早停（得分 >= 0.7 即可跳过剩余帧）
    const EARLY_STOP_SCORE = 0.8;
    const STAGGER_DELAY_MS = 300;

    type FrameResult = { timeSec: number; framePath: string; analysis: Awaited<ReturnType<typeof analyzeFrame>> };
    const frameResults: (FrameResult | null)[] = [];
    let best: { timeSec: number; framePath: string; score: number } | null = null;

    for (let i = 0; i < samplePoints.length; i++) {
      const timeSec = samplePoints[i];
      const framePath = path.join(tempDir, `frame-${timeSec}.jpg`);

      // 交错延迟（首帧不等待）
      if (i > 0) await sleep(STAGGER_DELAY_MS);

      const ok = await extractFrame(videoUrl, timeSec, framePath, width, Math.min(timeoutMs, 15000));
      if (!ok) {
        frameResults.push(null);
        continue;
      }

      try {
        const analysis = await analyzeFrame(framePath);
        log(
          "CoverGen",
          `帧 @${timeSec}s: 亮度=${analysis.brightness.toFixed(2)} 对比=${analysis.contrast.toFixed(2)} 锐度=${analysis.sharpness.toFixed(2)} 饱和=${analysis.saturation.toFixed(2)} 总分=${analysis.score.toFixed(3)} ${analysis.valid ? "✓" : "✗"}`,
        );
        frameResults.push({ timeSec, framePath, analysis });

        // 更新最佳帧
        if (analysis.valid && (!best || analysis.score > best.score)) {
          best = { timeSec, framePath, score: analysis.score };
        }

        // 早停：得分足够高，跳过剩余采样点
        if (analysis.valid && analysis.score >= EARLY_STOP_SCORE) {
          log("CoverGen", `早停: @${timeSec}s 得分 ${analysis.score.toFixed(3)} >= ${EARLY_STOP_SCORE}`);
          break;
        }
      } catch {
        frameResults.push(null);
      }
    }

    // 兜底：如果没有有效帧，使用任何成功提取的帧
    if (!best) {
      for (const result of frameResults) {
        if (!result) continue;
        if (!best || result.analysis.score > best.score) {
          best = { timeSec: result.timeSec, framePath: result.framePath, score: result.analysis.score };
        }
      }
    }

    if (!best) {
      log("CoverGen", "所有采样帧提取失败");
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return null;
    }

    log("CoverGen", `最佳帧: @${best.timeSec}s (得分: ${best.score.toFixed(3)})`);
    return { timeSec: best.timeSec, framePath: best.framePath, tempDir, score: best.score };
  } catch (err) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

// ========== sharp 格式转换 ==========

/**
 * 使用 sharp 将 JPG 帧转换为目标格式
 * 比二次调用 ffmpeg 快得多
 *
 * 编码参数已从 cover-config 集中管理
 */
export async function convertFrameToCover(
  framePath: string,
  outputPath: string,
  format: CoverFormat,
  width?: number,
): Promise<boolean> {
  try {
    let pipeline = sharp(framePath);

    if (width) {
      pipeline = pipeline.resize(width, undefined, { withoutEnlargement: true });
    }

    switch (format) {
      case "avif":
        await pipeline.avif({ quality: COVER_CONFIG.avifQuality, effort: COVER_CONFIG.avifEffort }).toFile(outputPath);
        break;
      case "webp":
        await pipeline.webp({ quality: COVER_CONFIG.webpQuality }).toFile(outputPath);
        break;
      case "jpg":
        await pipeline.jpeg({ quality: COVER_CONFIG.jpegQuality, mozjpeg: true }).toFile(outputPath);
        break;
      default:
        await pipeline.jpeg({ quality: 88 }).toFile(outputPath);
    }

    // 验证输出文件
    const stat = await fs.stat(outputPath);
    if (stat.size === 0) {
      await fs.unlink(outputPath).catch(() => {});
      return false;
    }

    log("CoverGen", `格式转换成功: ${format} (${(stat.size / 1024).toFixed(1)}KB)`);
    return true;
  } catch (err) {
    log("CoverGen", `格式转换失败 (${format}): ${String(err)}`);
    return false;
  }
}

// ========== blurDataURL 生成 ==========

/**
 * 从帧图片生成极小的模糊占位图 data URL
 * 用于 Next.js Image 的 blurDataURL prop，实现即时加载预览
 */
export async function generateBlurDataURL(input: string | Buffer): Promise<string | null> {
  try {
    const tiny = await sharp(input).resize(32, 18, { fit: "cover" }).blur(8).jpeg({ quality: 30 }).toBuffer();
    return `data:image/jpeg;base64,${tiny.toString("base64")}`;
  } catch {
    return null;
  }
}

// ========== 高级 API ==========

export interface GenerateCoverOptions {
  width?: number;
  samplePoints?: number[];
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface GenerateCoverResult {
  coverUrl: string;
  blurDataURL: string | null;
}

/**
 * 为视频生成封面（完整流程）
 *
 * 1. 智能选帧（串行提取 + 质量分析 + 早停）
 * 2. 并行生成 AVIF/WebP/JPEG 三种格式（确保所有浏览器都有最优格式）
 * 3. 生成 blurDataURL 占位图
 * 4. 返回最高优先级的成功格式作为 coverUrl
 */
export async function generateCoverForVideo(
  videoUrl: string,
  videoId: string,
  coverDir: string,
  options?: GenerateCoverOptions,
): Promise<GenerateCoverResult | null> {
  const maxRetries = options?.maxRetries ?? COVER_CONFIG.maxRetries;
  const retryDelayMs = options?.retryDelayMs ?? COVER_CONFIG.retryDelay;
  const startTime = Date.now();

  log("CoverGen", `开始生成封面: videoId=${videoId}`);

  const best = await selectBestFrame(videoUrl, {
    samplePoints: options?.samplePoints,
    width: options?.width ?? COVER_CONFIG.width,
    timeoutMs: options?.timeoutMs,
  });

  if (!best) {
    log("CoverGen", `选帧失败: videoId=${videoId}, 耗时=${Date.now() - startTime}ms`);
    return null;
  }

  try {
    // 并行生成所有格式 + blurDataURL
    const formatTasks = COVER_CONFIG.formats.map(async (format) => {
      const coverFileName = `${videoId}.${format}`;
      const coverFilePath = path.join(coverDir, coverFileName);

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const ok = await convertFrameToCover(best.framePath, coverFilePath, format);
        if (ok) return { format, coverFileName };
        if (attempt < maxRetries) await sleep(retryDelayMs);
      }
      return null;
    });

    const [blurDataURL, ...formatResults] = await Promise.all([generateBlurDataURL(best.framePath), ...formatTasks]);

    const successFormats = formatResults.filter((r): r is NonNullable<typeof r> => r !== null);
    const elapsed = Date.now() - startTime;

    if (successFormats.length === 0) {
      log("CoverGen", `✗ 封面生成失败: videoId=${videoId}, 所有格式失败, 耗时=${elapsed}ms`);
      return null;
    }

    // 返回最高优先级格式（formats 数组已按优先级排序）
    const primary = successFormats[0];
    log(
      "CoverGen",
      `✓ 封面生成成功: videoId=${videoId}, 格式=${successFormats.map((f) => f.format).join("+")}, 耗时=${elapsed}ms`,
    );

    return {
      coverUrl: `/uploads/cover/${primary.coverFileName}`,
      blurDataURL,
    };
  } finally {
    await fs.rm(best.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * 兼容旧版 API（供 generate-covers.ts 脚本使用）
 */
export async function retryGenerateCover(
  videoUrl: string,
  outputPath: string,
  format: CoverFormat,
  options?: GenerateCoverOptions,
): Promise<boolean> {
  const maxRetries = options?.maxRetries ?? COVER_CONFIG.maxRetries;
  const retryDelayMs = options?.retryDelayMs ?? COVER_CONFIG.retryDelay;

  // Step 1: 选帧（仅一次）
  const best = await selectBestFrame(videoUrl, {
    samplePoints: options?.samplePoints,
    width: options?.width ?? COVER_CONFIG.width,
    timeoutMs: options?.timeoutMs,
  });
  if (!best) return false;

  try {
    // Step 2: 格式转换（可重试）
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const ok = await convertFrameToCover(best.framePath, outputPath, format);
      if (ok) return true;
      if (attempt < maxRetries) await sleep(retryDelayMs);
    }
    return false;
  } finally {
    await fs.rm(best.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
