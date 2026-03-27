import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3-client";
import { policyToStorageConfig } from "@/lib/storage-policy";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const storageKey = path.join("/");

    const file = await prisma.userFile.findFirst({
      where: { storageKey, status: "UPLOADED" },
      include: { storagePolicy: true },
    });

    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    const policy = file.storagePolicy;

    if (policy.provider !== "local") {
      const config = policyToStorageConfig(policy);
      const url = await getPresignedDownloadUrl(config, storageKey);
      return NextResponse.redirect(url);
    }

    const uploadDir = policy.uploadDir || "./uploads";
    const filePath = join(uploadDir, storageKey);

    let fileInfo: { size: number };
    try {
      const s = await stat(filePath);
      fileInfo = { size: s.size };
    } catch {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileInfo.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json({ error: "读取文件失败" }, { status: 500 });
  }
}
