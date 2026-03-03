/**
 * 封面图片代理和缓存 API
 * 
 * 功能：
 * 1. 代理外部图片（解决 CORS 问题）
 * 2. 本地缓存图片（减少重复请求）
 * 3. 自动从视频生成封面（使用 ffmpeg）
 * 
 * 使用方式：
 * - /api/cover/https://example.com/image.jpg - 代理外部图片
 * - /api/cover/video/123456 - 自动生成视频封面
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { enqueueCoverForVideo } from "@/lib/cover-auto";
import { getServerConfig } from "@/lib/server-config";

const CACHE_DIR = path.join(process.cwd(), "public", "cache", "covers");

// 延迟初始化：仅首次调用时创建目录
let cacheDirPromise: Promise<void> | null = null;
function ensureCacheDir(): Promise<void> {
  if (!cacheDirPromise) {
    cacheDirPromise = fs.mkdir(CACHE_DIR, { recursive: true }).then(() => {}).catch(() => {});
  }
  return cacheDirPromise;
}

let coverDirPromise: Promise<string> | null = null;
async function getCoverDir() {
  if (!coverDirPromise) {
    coverDirPromise = (async () => {
      const config = await getServerConfig();
      const dir = path.join(process.cwd(), config.uploadDir, "cover");
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      return dir;
    })();
  }
  return coverDirPromise;
}

function getCacheFileName(url: string): string {
  const hash = crypto.createHash("md5").update(url).digest("hex");
  const ext = getExtension(url);
  return `${hash}${ext}`;
}

function getExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore
  }
  return ".jpg";
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
  };
  return types[ext] || "image/jpeg";
}

function getPreferredFormat(acceptHeader: string | null): { ext: string; contentType: string }[] {
  const formats: { ext: string; contentType: string; priority: number }[] = [];
  
  if (acceptHeader?.includes("image/avif")) {
    formats.push({ ext: ".avif", contentType: "image/avif", priority: 1 });
  }
  if (acceptHeader?.includes("image/webp")) {
    formats.push({ ext: ".webp", contentType: "image/webp", priority: 2 });
  }
  formats.push({ ext: ".jpg", contentType: "image/jpeg", priority: 3 });
  
  return formats.sort((a, b) => a.priority - b.priority);
}

/**
 * 并行尝试常见 CDN 缩略图 URL 模式，返回第一个成功的结果
 * 支持 .mp4 和 .m3u8 两种 URL 格式
 */
async function tryFetchThumbnailFromCDN(videoUrl: string): Promise<Buffer | null> {
  const thumbPatterns: string[] = [];

  if (/\.m3u8$/i.test(videoUrl)) {
    const base = videoUrl.replace(/\.m3u8$/i, "");
    thumbPatterns.push(
      `${base}.jpg`,
      `${base}_thumb.jpg`,
      `${base}_poster.jpg`,
      `${base}.png`,
      `${base}.webp`,
    );
  } else {
    thumbPatterns.push(
      videoUrl.replace(/\.mp4$/i, "_thumb.jpg"),
      videoUrl.replace(/\.mp4$/i, ".jpg"),
      videoUrl.replace(/\.mp4$/i, "_poster.jpg"),
      `${videoUrl}?x-oss-process=video/snapshot,t_1000,m_fast`,
    );
  }

  const fetchOne = async (thumbUrl: string): Promise<Buffer> => {
    const response = await fetch(thumbUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("not ok");
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error("not image");
    return Buffer.from(await response.arrayBuffer());
  };

  try {
    return await Promise.any(thumbPatterns.map(fetchOne));
  } catch {
    return null;
  }
}

/**
 * 读取本地文件并返回 Response（处理 /uploads/ 开头的本地路径）
 */
async function serveLocalFile(localPath: string): Promise<Response | null> {
  try {
    const data = await fs.readFile(localPath);
    const ext = path.extname(localPath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": getContentType(ext),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  
  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // 处理视频封面请求：/api/cover/video/123456
  if (pathSegments[0] === "video" && pathSegments[1]) {
    const videoId = pathSegments[1];
    
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { coverUrl: true, videoUrl: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // coverUrl 已存在：按类型分发
    if (video.coverUrl) {
      // 本地路径：直接读取文件
      if (video.coverUrl.startsWith("/uploads/") || video.coverUrl.startsWith("/api/cover/")) {
        const localPath = video.coverUrl.startsWith("/uploads/")
          ? path.join(process.cwd(), video.coverUrl.slice(1))
          : null;
        if (localPath) {
          const resp = await serveLocalFile(localPath);
          if (resp) return resp;
        }
      } else {
        // 外部 URL：缓存代理
        await ensureCacheDir();
        const cacheFile = path.join(CACHE_DIR, getCacheFileName(video.coverUrl));
        
        try {
          const cached = await fs.readFile(cacheFile);
          const ext = path.extname(cacheFile);
          return new Response(new Uint8Array(cached), {
            headers: {
              "Content-Type": getContentType(ext),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          // 缓存不存在
        }

        try {
          const response = await fetch(video.coverUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.writeFile(cacheFile, buffer).catch(() => {});

            const contentType = response.headers.get("content-type") || "image/jpeg";
            return new Response(new Uint8Array(arrayBuffer), {
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          }
        } catch {
          // 继续尝试本地文件
        }
      }
    }

    // 尝试本地已生成的封面文件（按客户端支持的格式优先级）
    const coverDir = await getCoverDir();
    const acceptHeader = request.headers.get("accept");
    const preferredFormats = getPreferredFormat(acceptHeader);

    for (const format of preferredFormats) {
      const coverFilePath = path.join(coverDir, `${videoId}${format.ext}`);
      try {
        const cached = await fs.readFile(coverFilePath);
        return new Response(new Uint8Array(cached), {
          headers: {
            "Content-Type": format.contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Vary": "Accept",
          },
        });
      } catch {
        // 尝试下一个格式
      }
    }

    // 尝试从 CDN 获取缩略图（并行请求，快速返回）
    const cdnThumbnail = await tryFetchThumbnailFromCDN(video.videoUrl);
    if (cdnThumbnail) {
      const cdnCoverPath = path.join(coverDir, `${videoId}.jpg`);
      await fs.writeFile(cdnCoverPath, cdnThumbnail).catch(() => {});
      
      return new Response(new Uint8Array(cdnThumbnail), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept",
        },
      });
    }

    // 加入队列异步生成
    await enqueueCoverForVideo(videoId);

    return NextResponse.json(
      { status: "queued" },
      {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "5",
        },
      }
    );
  }

  // 代理外部图片或本地 uploads
  const rawImageUrl = pathSegments.join("/");
  const imageUrl = decodeURIComponent(rawImageUrl);

  const normalizedLocalPath = imageUrl.startsWith("/")
    ? imageUrl.slice(1)
    : imageUrl;
  const config = await getServerConfig();
  const uploadsRoot = path.join(process.cwd(), config.uploadDir);
  const candidateLocalPath = path.join(process.cwd(), normalizedLocalPath);
  if (
    normalizedLocalPath.startsWith("uploads/") &&
    candidateLocalPath.startsWith(uploadsRoot)
  ) {
    const resp = await serveLocalFile(candidateLocalPath);
    if (resp) return resp;
    return NextResponse.json({ error: "Local image not found" }, { status: 404 });
  }
  
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  await ensureCacheDir();
  const cacheFile = path.join(CACHE_DIR, getCacheFileName(imageUrl));
  
  try {
    const cached = await fs.readFile(cacheFile);
    const ext = path.extname(cacheFile);
    return new Response(new Uint8Array(cached), {
      headers: {
        "Content-Type": getContentType(ext),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // 缓存不存在
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(cacheFile, buffer).catch(() => {});

    return new Response(new Uint8Array(arrayBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
