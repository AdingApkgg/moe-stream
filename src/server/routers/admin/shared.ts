import sharp from "sharp";
import { nanoid } from "nanoid";

export async function processSticker(
  buffer: Buffer,
  prefix: string,
): Promise<{ data: Buffer; filename: string; width?: number; height?: number }> {
  const meta = await sharp(buffer).metadata();
  const isAnimated = (meta.pages ?? 1) > 1;

  let processed: Buffer;
  if (isAnimated) {
    processed = await sharp(buffer, { animated: true })
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } else {
    processed = await sharp(buffer)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  }

  const outMeta = await sharp(processed).metadata();
  const filename = `${prefix}-${Date.now()}-${nanoid(6)}.webp`;
  return { data: processed, filename, width: outMeta.width, height: outMeta.height };
}

const DEFAULT_BATCH_LIMIT = 10000;

export async function getAdminBatchLimit(prisma: typeof import("@/lib/prisma").prisma): Promise<number> {
  try {
    const config = await prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: { adminBatchLimit: true },
    });
    return config?.adminBatchLimit ?? DEFAULT_BATCH_LIMIT;
  } catch {
    return DEFAULT_BATCH_LIMIT;
  }
}
