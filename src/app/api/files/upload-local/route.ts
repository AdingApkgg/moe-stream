import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { prisma } from "@/lib/prisma";
import { completeUpload } from "@/lib/storage-policy";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const fileId = new URL(request.url).searchParams.get("fileId");
    if (!fileId) {
      return NextResponse.json({ error: "缺少 fileId" }, { status: 400 });
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const actualSize = file.size;
    const maxFileSize = Number(record.storagePolicy.maxFileSize);
    if (actualSize > maxFileSize) {
      const maxMB = (maxFileSize / (1024 * 1024)).toFixed(0);
      return NextResponse.json({ error: `文件大小超过限制 (最大 ${maxMB} MB)` }, { status: 400 });
    }

    const uploadDir = record.storagePolicy.uploadDir || "./uploads";
    const filePath = join(uploadDir, record.storageKey);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    await completeUpload({
      fileId: record.id,
      userId: session.user.id,
      actualSize,
    });

    const updated = await prisma.userFile.findUnique({ where: { id: fileId } });

    return NextResponse.json({
      success: true,
      url: updated?.url,
      filename: updated?.filename,
    });
  } catch (error) {
    console.error("Local upload error:", error);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
