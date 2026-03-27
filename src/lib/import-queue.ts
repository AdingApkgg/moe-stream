import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { getProvider, type CloudProviderType } from "@/lib/cloud-providers";
import { resolvePolicy, generateStorageKey, policyToStorageConfig } from "@/lib/storage-policy";
import { getPublicUrl } from "@/lib/s3-client";
import type { StoragePolicy } from "@/generated/prisma/client";

const QUEUE_KEY = "import:queue";
const LOG_KEY = "import:logs";
const LOG_MAX = 200;
const MAX_CONCURRENT = 2;
const POLL_TIMEOUT = 5;

function log(msg: string) {
  const ts = new Date().toISOString();
  const full = `[${ts}][ImportQueue] ${msg}`;
  console.log(full);
  redis
    .lpush(LOG_KEY, full)
    .then(() => {
      redis.ltrim(LOG_KEY, 0, LOG_MAX - 1).catch(() => {});
    })
    .catch(() => {});
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
    const provider = await getProvider(task.provider as CloudProviderType);

    // Try to get access token from Redis (stored during OAuth flow).
    // If not available, providers will fallback to public share link download.
    let accessToken: string | undefined;
    if (task.provider !== "url" && task.provider !== "dropbox") {
      accessToken = (await redis.get(`cloud:token:${task.userId}:${task.provider}`)) ?? undefined;
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

    const policy = await resolvePolicy(mimeType, totalSize || 1);
    const storageKey = generateStorageKey(task.userId, filename, mimeType);

    let userFileId: string | undefined;

    try {
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
      userFileId = userFile.id;

      const downloadedBytes = await streamToStorage(download.stream, policy, storageKey, mimeType, taskId, totalSize);

      if (downloadedBytes < 0) {
        // Cancelled during download — clean up
        await cleanupStoredFile(policy, storageKey);
        await prisma.userFile.update({
          where: { id: userFile.id },
          data: { status: "FAILED" },
        });
        log(`已取消: ${taskId}`);
        return true;
      }

      await prisma.importTask.update({
        where: { id: taskId },
        data: { status: "PROCESSING", progress: 95 },
      });

      // Final cancellation check after storage write
      const finalCheck = await prisma.importTask.findUnique({
        where: { id: taskId },
        select: { status: true },
      });
      if (finalCheck?.status === "CANCELLED") {
        await cleanupStoredFile(policy, storageKey);
        await prisma.userFile.update({
          where: { id: userFile.id },
          data: { status: "FAILED" },
        });
        log(`已取消: ${taskId} (写入后清理)`);
        return true;
      }

      const url =
        policy.provider === "local"
          ? `/api/files/serve/${storageKey}`
          : getPublicUrl(policyToStorageConfig(policy), storageKey);

      const actualSize = BigInt(downloadedBytes);

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

      log(`完成: ${taskId} → ${filename} (${downloadedBytes} bytes)`);
      return true;
    } catch (err) {
      // Inner catch: clean up the UserFile if it was already created (Bug 3 fix)
      if (userFileId) {
        await prisma.userFile
          .update({
            where: { id: userFileId },
            data: { status: "FAILED" },
          })
          .catch(() => {});
      }
      throw err; // Re-throw for outer catch
    }
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

/**
 * Stream the ReadableStream to local disk or S3 without buffering the entire file.
 * Returns total bytes written, or -1 if the task was cancelled mid-download.
 */
async function streamToStorage(
  stream: ReadableStream<Uint8Array>,
  policy: StoragePolicy,
  storageKey: string,
  mimeType: string,
  taskId: string,
  totalSize: number,
): Promise<number> {
  const reader = stream.getReader();
  let downloadedBytes = 0;
  let lastProgressUpdate = 0;

  if (policy.provider === "local") {
    const { createWriteStream } = await import("fs");
    const { mkdir: mkdirAsync } = await import("fs/promises");
    const { join, dirname } = await import("path");
    const uploadDir = policy.uploadDir || "./uploads";
    const filePath = join(uploadDir, storageKey);
    await mkdirAsync(dirname(filePath), { recursive: true });

    const ws = createWriteStream(filePath);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Backpressure-aware write
        if (!ws.write(value)) {
          await new Promise<void>((r) => ws.once("drain", r));
        }
        downloadedBytes += value.length;

        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          const cancelled = await checkCancellation(taskId);
          if (cancelled) {
            reader.cancel();
            ws.end();
            return -1;
          }

          const progress = totalSize > 0 ? Math.min(95, Math.round((downloadedBytes / totalSize) * 100)) : 0;
          await prisma.importTask.update({
            where: { id: taskId },
            data: { progress, downloadedBytes: BigInt(downloadedBytes) },
          });
          lastProgressUpdate = now;
        }
      }
    } finally {
      ws.end();
      await new Promise<void>((r) => ws.once("finish", r));
    }
  } else {
    // S3: use multipart upload for streaming
    const { createMultipartUpload, uploadPart, completeMultipartUpload } = await import("@/lib/s3-client");
    const config = policyToStorageConfig(policy);
    const uploadId = await createMultipartUpload(config, storageKey, mimeType);

    const S3_PART_SIZE = 10 * 1024 * 1024; // 10 MB per part
    let partNumber = 1;
    const parts: { partNumber: number; etag: string }[] = [];
    let buf = Buffer.alloc(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf = Buffer.concat([buf, value]);
        downloadedBytes += value.length;

        while (buf.length >= S3_PART_SIZE) {
          const slice = buf.subarray(0, S3_PART_SIZE);
          buf = buf.subarray(S3_PART_SIZE);
          const etag = await uploadPart(config, storageKey, uploadId, partNumber, slice);
          parts.push({ partNumber, etag });
          partNumber++;
        }

        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          const cancelled = await checkCancellation(taskId);
          if (cancelled) {
            reader.cancel();
            return -1;
          }

          const progress = totalSize > 0 ? Math.min(95, Math.round((downloadedBytes / totalSize) * 100)) : 0;
          await prisma.importTask.update({
            where: { id: taskId },
            data: { progress, downloadedBytes: BigInt(downloadedBytes) },
          });
          lastProgressUpdate = now;
        }
      }

      // Flush remaining buffer as last part
      if (buf.length > 0) {
        const etag = await uploadPart(config, storageKey, uploadId, partNumber, buf);
        parts.push({ partNumber, etag });
      }

      await completeMultipartUpload(config, storageKey, uploadId, parts);
    } catch (err) {
      // Abort multipart upload on failure
      try {
        const { abortMultipartUpload } = await import("@/lib/s3-client");
        await abortMultipartUpload(config, storageKey, uploadId);
      } catch {
        /* best-effort */
      }
      throw err;
    }
  }

  return downloadedBytes;
}

async function checkCancellation(taskId: string): Promise<boolean> {
  const current = await prisma.importTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });
  return current?.status === "CANCELLED";
}

async function cleanupStoredFile(policy: StoragePolicy, storageKey: string): Promise<void> {
  try {
    if (policy.provider === "local") {
      const { unlink } = await import("fs/promises");
      const { join } = await import("path");
      const uploadDir = policy.uploadDir || "./uploads";
      await unlink(join(uploadDir, storageKey)).catch(() => {});
    } else {
      const { deleteFromS3 } = await import("@/lib/s3-client");
      await deleteFromS3(policyToStorageConfig(policy), storageKey);
    }
  } catch {
    /* best-effort cleanup */
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

  await Promise.all(Array.from({ length: MAX_CONCURRENT }, (_, i) => worker(i)));

  return { processed, errors };
}
