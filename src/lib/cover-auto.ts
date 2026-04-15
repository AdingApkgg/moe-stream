import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { COVER_CONFIG } from "@/lib/cover-config";
import { generateCoverForVideo, generateBlurDataURL } from "@/lib/cover-generator";
import sharp from "sharp";
import { addToQueue, addToQueueBatch, processQueue, getPermFailedVideos } from "@/lib/cover-queue";
import { getServerConfig } from "@/lib/server-config";

import { pushCoverLog } from "@/lib/cover-queue";

function log(msg: string, ...args: unknown[]) {
  pushCoverLog("CoverWorker", msg, ...args);
}

// 封面目录只需创建一次
let coverDirReady = false;
let coverDirPath: string | null = null;

async function getCoverDir(): Promise<string> {
  if (coverDirPath) return coverDirPath;
  const config = await getServerConfig();
  coverDirPath = path.join(process.cwd(), config.uploadDir, "cover");
  return coverDirPath;
}

async function ensureCoverDir() {
  if (coverDirReady) return;
  const dir = await getCoverDir();
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  coverDirReady = true;
}

/**
 * 检查本地是否已存在封面文件
 * 优化: 使用 Promise.all 并行检查所有格式
 */
async function findExistingCover(videoId: string): Promise<string | null> {
  const coverDir = await getCoverDir();
  const checks = COVER_CONFIG.formats.map(async (format) => {
    const filePath = path.join(coverDir, `${videoId}.${format}`);
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 0) {
        return `/uploads/cover/${videoId}.${format}`;
      }
    } catch {
      // 文件不存在，继续
    }
    return null;
  });

  const results = await Promise.all(checks);
  return results.find((r) => r !== null) ?? null;
}

/**
 * 处理单个视频的封面生成
 * 导出供管理页面直接调用（同步模式）
 */
export async function processVideo(videoId: string): Promise<boolean> {
  log(`处理视频 ${videoId}`);
  await ensureCoverDir();

  // 先检查文件是否已存在（避免重复生成）
  const existing = await findExistingCover(videoId);
  if (existing) {
    log(`视频 ${videoId} 封面已存在: ${existing}，更新数据库`);
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: { coverUrl: existing },
      });
    } catch (e) {
      log(`更新数据库失败:`, e);
    }
    return true;
  }

  // 获取视频信息
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { videoUrl: true },
  });

  if (!video?.videoUrl) {
    log(`视频 ${videoId} 无 videoUrl，跳过`);
    return true;
  }

  log(`视频 ${videoId} URL: ${video.videoUrl.slice(0, 80)}...`);

  const siteCfg = await getServerConfig();
  const coverDir = await getCoverDir();
  const result = await generateCoverForVideo(video.videoUrl, videoId, coverDir, {
    width: siteCfg.coverEncoding.width,
    timeoutMs: COVER_CONFIG.timeout,
    maxRetries: COVER_CONFIG.maxRetries,
    retryDelayMs: COVER_CONFIG.retryDelay,
  });

  if (result) {
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          coverUrl: result.coverUrl,
          coverBlurHash: result.blurDataURL,
        },
      });
    } catch (e) {
      log(`更新数据库失败:`, e);
    }
    return true;
  }

  // ffmpeg 失败后尝试 CDN 缩略图回退
  const thumbResult = await tryCdnThumbnailFallback(video.videoUrl, videoId, coverDir);
  if (thumbResult) {
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          coverUrl: thumbResult.coverUrl,
          coverBlurHash: thumbResult.blurDataURL,
        },
      });
    } catch (e) {
      log(`更新数据库失败:`, e);
    }
    return true;
  }

  return false;
}

/**
 * CDN 缩略图回退：当 ffmpeg 提取帧失败时，尝试从 CDN 获取静态缩略图
 */
async function tryCdnThumbnailFallback(
  videoUrl: string,
  videoId: string,
  coverDir: string,
): Promise<{ coverUrl: string; blurDataURL: string | null } | null> {
  const enc = (await getServerConfig()).coverEncoding;
  const patterns: string[] = [];
  if (/\.m3u8(\?|$)/i.test(videoUrl)) {
    const base = videoUrl.replace(/\.m3u8(\?.*)?$/i, "");
    patterns.push(`${base}.jpg`, `${base}_thumb.jpg`, `${base}_poster.jpg`, `${base}.png`, `${base}.webp`);
  } else if (/\.webm(\?|$)/i.test(videoUrl)) {
    const base = videoUrl.replace(/\.webm(\?.*)?$/i, "");
    patterns.push(`${base}.jpg`, `${base}_thumb.jpg`, `${base}.png`);
  } else {
    const base = videoUrl.replace(/\.mp4(\?.*)?$/i, "");
    patterns.push(`${base}_thumb.jpg`, `${base}.jpg`, `${base}_poster.jpg`);
  }

  for (const thumbUrl of patterns) {
    try {
      const response = await fetch(thumbUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1000) continue;

      const jpgPath = path.join(coverDir, `${videoId}.jpg`);
      const avifPath = path.join(coverDir, `${videoId}.avif`);

      // 保存为 JPEG + 尝试 AVIF
      await sharp(buffer)
        .resize(enc.width, undefined, { withoutEnlargement: true })
        .jpeg({ quality: enc.jpegQuality, mozjpeg: true })
        .toFile(jpgPath);

      let coverUrl = `/uploads/cover/${videoId}.jpg`;
      try {
        await sharp(buffer)
          .resize(enc.width, undefined, { withoutEnlargement: true })
          .avif({ quality: enc.avifQuality, effort: enc.avifEffort })
          .toFile(avifPath);
        coverUrl = `/uploads/cover/${videoId}.avif`;
      } catch {
        /* AVIF 失败则用 JPEG */
      }

      const blurDataURL = await generateBlurDataURL(jpgPath);
      log(`CDN 缩略图回退成功: ${videoId} <- ${thumbUrl}`);
      return { coverUrl, blurDataURL };
    } catch {
      continue;
    }
  }

  log(`CDN 缩略图回退失败: ${videoId}，无可用缩略图`);
  return null;
}

// ========== Worker 生命周期 ==========

let workerStarted = false;

/**
 * 启动封面生成 Worker
 * 由 instrumentation.ts 在服务器启动时调用
 */
export function startCoverWorker() {
  if (workerStarted) return;
  workerStarted = true;

  log("启动封面生成 worker...");
  // 预创建目录，避免每个任务都检查
  void ensureCoverDir();
  void processQueue(processVideo);
}

// ========== 补全调度 ==========

let backfillTimer: NodeJS.Timeout | null = null;

async function tryAcquireBackfillLock(): Promise<boolean> {
  try {
    const result = await redis.set("cover:backfill:lock", "1", "EX", COVER_CONFIG.backfillLockTtlSeconds, "NX");
    return result === "OK";
  } catch {
    return false;
  }
}

async function backfillMissingCovers(): Promise<void> {
  const locked = await tryAcquireBackfillLock();
  if (!locked) return;

  const [videos, failedIds] = await Promise.all([
    prisma.video.findMany({
      where: {
        OR: [{ coverUrl: null }, { coverUrl: "" }],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: COVER_CONFIG.backfillBatchSize,
    }),
    getPermFailedVideos(),
  ]);

  const failedSet = new Set(failedIds);
  const eligible = videos.filter((v) => !failedSet.has(v.id));

  if (failedSet.size > 0 && eligible.length < videos.length) {
    log(`补全: 跳过 ${videos.length - eligible.length} 个永久失败的视频`);
  }

  if (eligible.length > 0) {
    log(`补全: 找到 ${eligible.length} 个缺少封面的视频`);
    const count = await addToQueueBatch(eligible.map((v) => v.id));
    log(`补全: 成功入队 ${count} 个视频`);
  }
}

/**
 * 启动定时补全调度器
 * 由 instrumentation.ts 在服务器启动时调用
 */
export function startBackfillScheduler() {
  if (backfillTimer) return;

  void backfillMissingCovers();
  backfillTimer = setInterval(() => {
    void backfillMissingCovers();
  }, COVER_CONFIG.backfillIntervalMs);
}

// ========== 公共 API ==========

/**
 * 将视频加入封面生成队列
 * 供 tRPC mutation 和 API route 调用
 */
export async function enqueueCoverForVideo(videoId: string, coverUrl?: string | null): Promise<void> {
  if (coverUrl) return;
  if (process.env.NODE_ENV === "development") return;
  await addToQueue(videoId);
}

/**
 * 手动设置封面：从 base64 图片数据生成封面文件并写库
 */
export async function setCoverManually(
  videoId: string,
  imageBuffer: Buffer,
): Promise<{ coverUrl: string; blurDataURL: string | null }> {
  await ensureCoverDir();
  const coverDir = await getCoverDir();
  const enc = (await getServerConfig()).coverEncoding;

  const jpgPath = path.join(coverDir, `${videoId}.jpg`);
  const avifPath = path.join(coverDir, `${videoId}.avif`);
  const webpPath = path.join(coverDir, `${videoId}.webp`);

  // 并行生成三种格式 + blurDataURL
  const src = sharp(imageBuffer).resize(enc.width, undefined, { withoutEnlargement: true });

  const [, , , blurDataURL] = await Promise.all([
    src.clone().jpeg({ quality: enc.jpegQuality, mozjpeg: true }).toFile(jpgPath),
    src
      .clone()
      .avif({ quality: enc.avifQuality, effort: enc.avifEffort })
      .toFile(avifPath)
      .catch(() => null),
    src
      .clone()
      .webp({ quality: enc.webpQuality })
      .toFile(webpPath)
      .catch(() => null),
    generateBlurDataURL(imageBuffer),
  ]);

  // AVIF 优先
  let coverUrl = `/uploads/cover/${videoId}.jpg`;
  try {
    const avifStat = await fs.stat(avifPath);
    if (avifStat.size > 0) coverUrl = `/uploads/cover/${videoId}.avif`;
  } catch {
    /* 用 jpg */
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { coverUrl, coverBlurHash: blurDataURL },
  });

  log(`手动设置封面成功: ${videoId} -> ${coverUrl}`);
  return { coverUrl, blurDataURL };
}
