import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import sharp from "sharp";
import { getServerConfig } from "@/lib/server-config";
import { shouldBypassImageCompress, UPLOAD_IMAGE_TYPES, type UploadImageType } from "@/lib/image-compress-config";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 允许的文件类型
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

function normalizeUploadType(type: string | null): UploadImageType {
  const t = type || "misc";
  return UPLOAD_IMAGE_TYPES.includes(t as UploadImageType) ? (t as UploadImageType) : "misc";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // avatar, cover, etc.
    const noCompress = formData.get("noCompress") === "true";

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    // 验证文件类型
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "不支持的文件类型，请上传 JPEG、PNG、GIF、WebP 或 AVIF 图片" },
        { status: 400 },
      );
    }

    // 检查大小限制
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    const siteCfg = await getServerConfig();
    const uploadType = normalizeUploadType(type);
    const uploadPath = join(siteCfg.uploadDir, uploadType);
    if (!existsSync(uploadPath)) {
      await mkdir(uploadPath, { recursive: true });
    }

    // 读取文件
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);
    const originalSize = inputBuffer.length;

    let outputBuffer: Buffer;
    let outputExt: string;
    let metadata: { width?: number; height?: number } = {};
    let compressionMode = "none";

    const profile = siteCfg.imageCompressProfiles[uploadType];
    const bypassCompress = shouldBypassImageCompress(
      siteCfg.imageCompressBypassRules,
      file.type,
      uploadType,
      originalSize,
    );

    const skipSharpPipeline =
      file.type === "image/gif" || noCompress || !siteCfg.imageCompressEnabled || !profile.enabled || bypassCompress;

    if (skipSharpPipeline) {
      outputBuffer = inputBuffer;
      outputExt = file.name.split(".").pop() || (file.type === "image/gif" ? "gif" : "jpg");
      compressionMode = "none";
    } else {
      try {
        // 获取原始图片信息
        const imageInfo = await sharp(inputBuffer).metadata();
        metadata = { width: imageInfo.width, height: imageInfo.height };

        // 使用 sharp 进行处理
        let sharpInstance = sharp(inputBuffer, { animated: false });

        // 根据类型调整尺寸
        if (uploadType === "avatar") {
          sharpInstance = sharpInstance.resize(profile.maxWidth, profile.maxHeight, {
            fit: "cover",
            position: "centre",
          });
        } else {
          sharpInstance = sharpInstance.resize(profile.maxWidth, profile.maxHeight, {
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        // 根据配置选择输出格式
        if (profile.format === "avif") {
          outputBuffer = await sharpInstance
            .avif({
              quality: profile.quality,
              lossless: profile.lossless,
              effort: 4,
            })
            .toBuffer();
          outputExt = "avif";
          compressionMode = profile.lossless ? "lossless" : "lossy";
        } else {
          outputBuffer = await sharpInstance
            .webp({
              quality: profile.quality,
              effort: 4,
              lossless: profile.lossless,
            })
            .toBuffer();
          outputExt = "webp";
          compressionMode = profile.lossless ? "lossless" : "lossy";
        }

        // 如果压缩后比原图大很多，回退到有损压缩
        if (profile.lossless && outputBuffer.length > originalSize * 1.5) {
          console.log(`无损压缩后体积过大，回退到有损压缩`);
          const fallbackQuality = Math.min(95, Math.max(50, Math.round(profile.quality * 0.85)));
          const resizeOpts =
            uploadType === "avatar"
              ? {
                  fit: "cover" as const,
                  position: "centre" as const,
                }
              : { fit: "inside" as const, withoutEnlargement: true as const };

          if (profile.format === "avif") {
            outputBuffer = await sharp(inputBuffer)
              .resize(profile.maxWidth, profile.maxHeight, resizeOpts)
              .avif({ quality: fallbackQuality, lossless: false, effort: 4 })
              .toBuffer();
          } else {
            outputBuffer = await sharp(inputBuffer)
              .resize(profile.maxWidth, profile.maxHeight, resizeOpts)
              .webp({ quality: fallbackQuality, effort: 4 })
              .toBuffer();
          }
          compressionMode = "lossy-fallback";
        }
      } catch (sharpError) {
        console.error("Sharp processing error:", sharpError);
        outputBuffer = inputBuffer;
        outputExt = file.name.split(".").pop() || "jpg";
        compressionMode = "error-fallback";
      }
    }

    // 生成文件名
    const filename = `${session.user.id}-${Date.now()}.${outputExt}`;
    const filepath = join(uploadPath, filename);

    // 保存文件
    await writeFile(filepath, outputBuffer);

    // 计算压缩率
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    // 返回访问 URL
    const url = `/uploads/${uploadType}/${filename}`;

    return NextResponse.json({
      url,
      success: true,
      originalSize,
      compressedSize,
      compressionRatio: `${compressionRatio}%`,
      format: outputExt,
      compressionMode,
      dimensions: metadata,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
