import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { getProvider, type CloudProviderType } from "@/lib/cloud-providers";
import {
  resolvePolicy,
  generateStorageKey,
  policyToStorageConfig,
} from "@/lib/storage-policy";
import { uploadToS3 } from "@/lib/s3-client";

const QUEUE_KEY = "import:queue";
const LOG_KEY = "import:logs";
const LOG_MAX = 200;
const MAX_CONCURRENT = 2;
const POLL_TIMEOUT = 5;

function log(msg: string) {
  const ts = new Date().toISOString();
  const full = `[${ts}][ImportQueue] ${msg}`;
  console.log(full);
  redis.lpush(LOG_KEY, full).then(() => {
    redis.ltrim(LOG_KEY, 0, LOG_MAX - 1).catch(() => {});
  }).catch(() => {});
}

export async function enqueueImport(taskId: string): Promise<void> {
  await redis.lpush(QUEUE_KEY, taskId);
  log(`入队: ${taskId}`);
}

/**
 * Process a single import task: download from cloud provider
 * and write to storage (local or S3) using streaming.
 */
async function processTask(taskId: string): Promise<boolean> {
  const task = await prisma.importTask.findUnique({
    where: { id: taskId },
  });
  if (!task || task.status === "CANCELLED" || task.status === "COMPLETED") {
    return true;
  }

  await prisma.importTask.update({
    where: { id: taskId },
    data: { status: "DOWNLOADING", progress: 0, downloadedBytes: 0 },
  });

  try {
    const provider = getProvider(task.provider as CloudProviderType);

    // Get access token from Redis (stored during OAuth flow)
    let accessToken: string | undefined;
    if (task.provider !== "url" && task.provider !== "dropbox") {
      accessToken = await redis.get(`cloud:token:${task.userId}:${task.provider}`) ?? undefined;
      if (!accessToken) {
        throw new Error(`${provider.name} 授权已过期，请重新授权`);
      }
    }

    const fileInfo = {
      fileId: task.sourceFileId ?? undefined,
      name: task.sourceName,
      size: task.sourceSize ? Number(task.sourceSize) : undefined,
      mimeType: task.sourceMimeType ?? undefined,
      downloadUrl: task.sourceUrl,
    };

    const download = await provider.downloadStream(fileInfo, accessToken);

    const mimeType = download.mimeType;
    const filename = download.filename || task.sourceName;
    const totalSize = download.size ?? Number(task.sourceSize ?? 0);

    // Resolve storage policy
    const policy = await resolvePolicy(mimeType, totalSize || 1);
    const storageKey = generateStorageKey(task.userId, filename, mimeType);

    // Create UserFile record
    const userFile = await prisma.userFile.create({
      data: {
        userId: task.userId,
        storagePolicyId: policy.id,
        filename,
        storageKey,
        url: "",
        mimeType,
        size: BigInt(totalSize || 0),
        status: "UPLOADING",
      },
    });

    // Stream download and write to storage
    const reader = download.stream.getReader();
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;
    let lastProgressUpdate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      // Throttle progress updates to every 500ms
      const now = Date.now();
      if (now - lastProgressUpdate > 500) {
        const progress = totalSize > 0 ? Math.min(95, Math.round((downloadedBytes / totalSize) * 100)) : 0;
        await prisma.importTask.update({
          where: { id: taskId },
          data: { progress, downloadedBytes: BigInt(downloadedBytes) },
        });
        lastProgressUpdate = now;
      }
    }

    const fullBuffer = Buffer.concat(chunks);

    await prisma.importTask.update({
      where: { id: taskId },
      data: { status: "PROCESSING", progress: 95 },
    });

    // Write to storage
    if (policy.provider === "local") {
      const { writeFile, mkdir: mkdirAsync } = await import("fs/promises");
      const { join, dirname } = await import("path");
      const uploadDir = policy.uploadDir || "./uploads";
      const filePath = join(uploadDir, storageKey);
      await mkdirAsync(dirname(filePath), { recursive: true });
      await writeFile(filePath, fullBuffer);
    } else {
      const config = policyToStorageConfig(policy);
      await uploadToS3(config, storageKey, fullBuffer, mimeType);
    }

    // Build URL
    const url =
      policy.provider === "local"
        ? `/api/files/serve/${storageKey}`
        : (() => {
            const { getPublicUrl } = require("@/lib/s3-client");
            return getPublicUrl(policyToStorageConfig(policy), storageKey);
          })();

    // Finalize
    const actualSize = BigInt(fullBuffer.length);
    await prisma.$transaction([
      prisma.userFile.update({
        where: { id: userFile.id },
        data: {
          status: "UPLOADED",
          url,
          size: actualSize,
          uploadedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: task.userId },
        data: { storageUsed: { increment: actualSize } },
      }),
      prisma.importTask.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          progress: 100,
          downloadedBytes: actualSize,
          userFileId: userFile.id,
        },
      }),
    ]);

    log(`完成: ${taskId} → ${filename} (${fullBuffer.length} bytes)`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    log(`失败: ${taskId} — ${message}`);
    await prisma.importTask.update({
      where: { id: taskId },
      data: { status: "FAILED", error: message },
    });
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Start the import queue worker (run from instrumentation or a separate process) */
export async function processImportQueue(
  opts: { maxItems?: number } = {},
): Promise<{ processed: number; errors: number }> {
  const maxItems = opts.maxItems ?? Number.POSITIVE_INFINITY;
  let processed = 0;
  let errors = 0;

  log(`启动 ${MAX_CONCURRENT} 个 import worker`);

  const worker = async (id: number) => {
    while (processed < maxItems) {
      let result: [string, string] | null;
      try {
        result = await redis.brpop(QUEUE_KEY, POLL_TIMEOUT);
      } catch {
        await sleep(5000);
        continue;
      }
      if (!result) continue;

      const taskId = result[1];
      log(`Worker ${id} 取到任务: ${taskId}`);
      const ok = await processTask(taskId);
      processed++;
      if (!ok) errors++;
    }
  };

  await Promise.all(
    Array.from({ length: MAX_CONCURRENT }, (_, i) => worker(i)),
  );

  return { processed, errors };
}
