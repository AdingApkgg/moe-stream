import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/files/upload-chunk?fileId=xxx&index=N
 *
 * Receives a single chunk for local storage resumable upload.
 * Chunks are stored as temporary files under {uploadDir}/.chunks/{fileId}/{index}.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const indexStr = searchParams.get("index");

    if (!fileId || indexStr == null) {
      return NextResponse.json({ error: "缺少 fileId 或 index" }, { status: 400 });
    }

    const index = parseInt(indexStr, 10);
    if (Number.isNaN(index) || index < 0) {
      return NextResponse.json({ error: "index 无效" }, { status: 400 });
    }

    const record = await prisma.userFile.findUnique({
      where: { id: fileId },
      include: { storagePolicy: true },
    });

    if (!record) {
      return NextResponse.json({ error: "文件记录不存在" }, { status: 404 });
    }
    if (record.userId !== session.user.id) {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }
    if (record.status !== "UPLOADING") {
      return NextResponse.json({ error: "文件状态异常" }, { status: 400 });
    }
    if (record.storagePolicy.provider !== "local") {
      return NextResponse.json({ error: "该文件不使用本地存储" }, { status: 400 });
    }
    if (record.totalChunks == null || index >= record.totalChunks) {
      return NextResponse.json({ error: "分片索引超出范围" }, { status: 400 });
    }

    const formData = await request.formData();
    const chunk = formData.get("chunk") as File | null;
    if (!chunk) {
      return NextResponse.json({ error: "请提供分片数据" }, { status: 400 });
    }

    const uploadDir = record.storagePolicy.uploadDir || "./uploads";
    const chunkDir = join(uploadDir, ".chunks", fileId);
    const chunkPath = join(chunkDir, String(index));

    if (!existsSync(chunkDir)) {
      await mkdir(chunkDir, { recursive: true });
    }

    const bytes = await chunk.arrayBuffer();
    await writeFile(chunkPath, Buffer.from(bytes));

    const existing = (record.uploadedChunks as { index: number }[] | null) ?? [];
    if (!existing.some((c) => c.index === index)) {
      existing.push({ index });
      await prisma.userFile.update({
        where: { id: fileId },
        data: { uploadedChunks: existing },
      });
    }

    return NextResponse.json({ success: true, index });
  } catch (error) {
    console.error("Chunk upload error:", error);
    return NextResponse.json({ error: "分片上传失败" }, { status: 500 });
  }
}
