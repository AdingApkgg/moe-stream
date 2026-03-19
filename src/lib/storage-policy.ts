import { prisma } from "@/lib/prisma";
import type { StoragePolicy } from "@/generated/prisma/client";
import type { StorageConfig } from "@/lib/s3-client";
import {
  getPresignedUploadUrl as s3PresignedPut,
  createMultipartUpload as s3CreateMultipart,
  getPresignedPartUrls as s3PresignedParts,
  completeMultipartUpload as s3CompleteMultipart,
  deleteFromS3,
  headObject,
  getPublicUrl as s3PublicUrl,
} from "@/lib/s3-client";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB
const PART_SIZE = 10 * 1024 * 1024; // 10 MB per part

export function policyToStorageConfig(policy: StoragePolicy): StorageConfig {
  return {
    provider: policy.provider,
    endpoint: policy.endpoint,
    bucket: policy.bucket,
    region: policy.region,
    accessKey: policy.accessKey,
    secretKey: policy.secretKey,
    customDomain: policy.customDomain,
    pathPrefix: policy.pathPrefix,
  };
}

interface RouteRule {
  mimePattern: string;
  policyId: string;
}

function mimeMatches(pattern: string, mime: string): boolean {
  if (pattern === "*" || pattern === "*/*") return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return mime.startsWith(prefix + "/");
  }
  return pattern === mime;
}

/**
 * Resolve which StoragePolicy to use for a given file upload.
 * Checks route rules from SiteConfig, then falls back to default policy.
 */
export async function resolvePolicy(
  mimeType: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _size: number,
): Promise<StoragePolicy> {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select: {
      fileStorageRouteRules: true,
      fileDefaultPolicyId: true,
    },
  });

  const rules = (siteConfig?.fileStorageRouteRules as RouteRule[] | null) ?? [];
  for (const rule of rules) {
    if (mimeMatches(rule.mimePattern, mimeType)) {
      const policy = await prisma.storagePolicy.findUnique({
        where: { id: rule.policyId },
      });
      if (policy && policy.enabled) return policy;
    }
  }

  if (siteConfig?.fileDefaultPolicyId) {
    const policy = await prisma.storagePolicy.findUnique({
      where: { id: siteConfig.fileDefaultPolicyId },
    });
    if (policy && policy.enabled) return policy;
  }

  const defaultPolicy = await prisma.storagePolicy.findFirst({
    where: { isDefault: true, enabled: true },
  });
  if (defaultPolicy) return defaultPolicy;

  const anyPolicy = await prisma.storagePolicy.findFirst({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
  });
  if (anyPolicy) return anyPolicy;

  throw new Error("没有可用的存储策略，请在后台配置至少一个存储策略");
}

/** Generate the storage key for a user file */
export function generateStorageKey(
  userId: string,
  filename: string,
  mimeType: string,
): string {
  const ext = filename.includes(".") ? filename.split(".").pop()! : "bin";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  const category = mimeType.split("/")[0] || "file";
  const id = crypto.randomUUID();
  return `user-files/${userId}/${category}/${id}.${safeExt}`;
}

export interface InitUploadResult {
  fileId: string;
  method: "PUT" | "POST";
  uploadUrl?: string;
  uploadId?: string;
  parts?: { partNumber: number; url: string }[];
  isLocal: boolean;
}

/**
 * Initialize an upload: creates a UserFile record in UPLOADING state
 * and returns presigned URLs (or local upload endpoint info).
 */
export async function initUpload(opts: {
  userId: string;
  filename: string;
  size: number;
  mimeType: string;
  contentType?: string;
  contentId?: string;
}): Promise<InitUploadResult> {
  const policy = await resolvePolicy(opts.mimeType, opts.size);

  if (policy.allowedTypes.length > 0) {
    const allowed = policy.allowedTypes.some((t: string) => mimeMatches(t, opts.mimeType));
    if (!allowed) {
      throw new Error(`该存储策略不允许上传 ${opts.mimeType} 类型的文件`);
    }
  }

  if (BigInt(opts.size) > policy.maxFileSize) {
    const maxMB = Number(policy.maxFileSize) / (1024 * 1024);
    throw new Error(`文件大小超过限制 (最大 ${maxMB.toFixed(0)} MB)`);
  }

  const storageKey = generateStorageKey(opts.userId, opts.filename, opts.mimeType);

  const file = await prisma.userFile.create({
    data: {
      userId: opts.userId,
      storagePolicyId: policy.id,
      filename: opts.filename,
      storageKey,
      url: "",
      mimeType: opts.mimeType,
      size: BigInt(opts.size),
      contentType: opts.contentType || null,
      contentId: opts.contentId || null,
      status: "UPLOADING",
    },
  });

  if (policy.provider === "local") {
    return {
      fileId: file.id,
      method: "POST",
      uploadUrl: `/api/files/upload-local?fileId=${file.id}`,
      isLocal: true,
    };
  }

  const config = policyToStorageConfig(policy);

  if (opts.size <= MULTIPART_THRESHOLD) {
    const uploadUrl = await s3PresignedPut(config, storageKey, opts.mimeType);
    return {
      fileId: file.id,
      method: "PUT",
      uploadUrl,
      isLocal: false,
    };
  }

  const uploadId = await s3CreateMultipart(config, storageKey, opts.mimeType);
  const partCount = Math.ceil(opts.size / PART_SIZE);
  const parts = await s3PresignedParts(config, storageKey, uploadId, partCount);

  return {
    fileId: file.id,
    method: "PUT",
    uploadId,
    parts,
    isLocal: false,
  };
}

/**
 * Complete an upload: verify the file exists in storage and update status.
 */
export async function completeUpload(opts: {
  fileId: string;
  userId: string;
  uploadId?: string;
  parts?: { partNumber: number; etag: string }[];
  /** Actual bytes written (local uploads). Overrides the declared size for accurate quota tracking. */
  actualSize?: number;
}): Promise<void> {
  const file = await prisma.userFile.findUnique({
    where: { id: opts.fileId },
    include: { storagePolicy: true },
  });

  if (!file) throw new Error("文件记录不存在");
  if (file.userId !== opts.userId) throw new Error("无权操作此文件");
  if (file.status !== "UPLOADING") throw new Error("文件状态不正确");

  const policy = file.storagePolicy;
  let verifiedSize = file.size;

  if (policy.provider !== "local") {
    const config = policyToStorageConfig(policy);

    if (opts.uploadId && opts.parts) {
      await s3CompleteMultipart(config, file.storageKey, opts.uploadId, opts.parts);
    }

    const head = await headObject(config, file.storageKey);
    if (!head) throw new Error("文件在存储中未找到，上传可能失败");
    verifiedSize = BigInt(head.size);
  } else if (opts.actualSize !== undefined) {
    verifiedSize = BigInt(opts.actualSize);
  }

  const url =
    policy.provider === "local"
      ? `/api/files/serve/${file.storageKey}`
      : s3PublicUrl(policyToStorageConfig(policy), file.storageKey);

  await prisma.$transaction([
    prisma.userFile.update({
      where: { id: opts.fileId },
      data: {
        status: "UPLOADED",
        url,
        size: verifiedSize,
        uploadedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: opts.userId },
      data: {
        storageUsed: { increment: verifiedSize },
      },
    }),
  ]);
}

/** Delete a file from storage and mark as DELETED */
export async function deleteUserFile(fileId: string, userId: string): Promise<void> {
  const file = await prisma.userFile.findUnique({
    where: { id: fileId },
    include: { storagePolicy: true },
  });

  if (!file) throw new Error("文件不存在");
  if (file.userId !== userId) throw new Error("无权操作此文件");
  if (file.status === "DELETED") return;

  const policy = file.storagePolicy;

  try {
    if (policy.provider === "local") {
      const { unlink } = await import("fs/promises");
      const { join } = await import("path");
      const dir = policy.uploadDir || "./uploads";
      await unlink(join(dir, file.storageKey)).catch(() => {});
    } else {
      await deleteFromS3(policyToStorageConfig(policy), file.storageKey);
    }
  } catch (err) {
    console.error("Failed to delete file from storage:", err);
  }

  const wasUploaded = file.status === "UPLOADED";

  await prisma.$transaction([
    prisma.userFile.update({
      where: { id: fileId },
      data: { status: "DELETED" },
    }),
    ...(wasUploaded
      ? [
          prisma.user.update({
            where: { id: userId },
            data: { storageUsed: { decrement: file.size } },
          }),
        ]
      : []),
  ]);
}
