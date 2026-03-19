import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";

export interface StorageConfig {
  provider: string;
  endpoint: string | null;
  bucket: string | null;
  region: string | null;
  accessKey: string | null;
  secretKey: string | null;
  customDomain: string | null;
  pathPrefix: string | null;
}

export async function getStorageConfig(): Promise<StorageConfig> {
  const config = await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select: {
      storageProvider: true,
      storageEndpoint: true,
      storageBucket: true,
      storageRegion: true,
      storageAccessKey: true,
      storageSecretKey: true,
      storageCustomDomain: true,
      storagePathPrefix: true,
    },
  });

  return {
    provider: config?.storageProvider ?? "local",
    endpoint: config?.storageEndpoint ?? null,
    bucket: config?.storageBucket ?? null,
    region: config?.storageRegion ?? null,
    accessKey: config?.storageAccessKey ?? null,
    secretKey: config?.storageSecretKey ?? null,
    customDomain: config?.storageCustomDomain ?? null,
    pathPrefix: config?.storagePathPrefix ?? null,
  };
}

export function createS3Client(config: StorageConfig): S3Client {
  if (!config.accessKey || !config.secretKey) {
    throw new Error("对象存储 Access Key 和 Secret Key 未配置");
  }

  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    region: config.region || "auto",
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = config.provider === "minio";
  }

  return new S3Client(clientConfig);
}

function resolveKey(config: StorageConfig, key: string): string {
  const prefix = config.pathPrefix?.replace(/\/+$/, "");
  return prefix ? `${prefix}/${key}` : key;
}

export async function uploadToS3(
  config: StorageConfig,
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType = "application/octet-stream",
): Promise<void> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket!,
      Key: fullKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  client.destroy();
}

export async function deleteFromS3(
  config: StorageConfig,
  key: string,
): Promise<void> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket!,
      Key: fullKey,
    }),
  );
  client.destroy();
}

export async function getPresignedDownloadUrl(
  config: StorageConfig,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket!,
      Key: fullKey,
    }),
    { expiresIn },
  );
  client.destroy();

  if (config.customDomain) {
    const parsed = new URL(url);
    const custom = new URL(config.customDomain);
    parsed.protocol = custom.protocol;
    parsed.host = custom.host;
    return parsed.toString();
  }

  return url;
}

export async function downloadFromS3(
  config: StorageConfig,
  key: string,
): Promise<Buffer> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  try {
    const resp = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket!,
        Key: fullKey,
      }),
    );

    if (!resp.Body) throw new Error("响应体为空");

    const chunks: Uint8Array[] = [];
    const reader = (resp.Body as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    client.destroy();
  }
}

export async function headObject(
  config: StorageConfig,
  key: string,
): Promise<{ size: number } | null> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  try {
    const resp = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket!,
        Key: fullKey,
      }),
    );
    return { size: resp.ContentLength ?? 0 };
  } catch {
    return null;
  } finally {
    client.destroy();
  }
}

export async function getPresignedUploadUrl(
  config: StorageConfig,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket!,
      Key: fullKey,
      ContentType: contentType,
    }),
    { expiresIn },
  );
  client.destroy();
  return url;
}

export async function createMultipartUpload(
  config: StorageConfig,
  key: string,
  contentType: string,
): Promise<string> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  const resp = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket!,
      Key: fullKey,
      ContentType: contentType,
    }),
  );
  client.destroy();

  if (!resp.UploadId) throw new Error("Failed to create multipart upload");
  return resp.UploadId;
}

export async function getPresignedPartUrls(
  config: StorageConfig,
  key: string,
  uploadId: string,
  partCount: number,
  expiresIn = 3600,
): Promise<{ partNumber: number; url: string }[]> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  const parts: { partNumber: number; url: string }[] = [];
  for (let i = 1; i <= partCount; i++) {
    const url = await getSignedUrl(
      client,
      new UploadPartCommand({
        Bucket: config.bucket!,
        Key: fullKey,
        UploadId: uploadId,
        PartNumber: i,
      }),
      { expiresIn },
    );
    parts.push({ partNumber: i, url });
  }

  client.destroy();
  return parts;
}

export async function completeMultipartUpload(
  config: StorageConfig,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket!,
      Key: fullKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag,
        })),
      },
    }),
  );
  client.destroy();
}

export async function abortMultipartUpload(
  config: StorageConfig,
  key: string,
  uploadId: string,
): Promise<void> {
  const client = createS3Client(config);
  const fullKey = resolveKey(config, key);

  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: config.bucket!,
      Key: fullKey,
      UploadId: uploadId,
    }),
  );
  client.destroy();
}

/** Build the public-facing URL for a stored object */
export function getPublicUrl(config: StorageConfig, key: string): string {
  const fullKey = resolveKey(config, key);
  if (config.customDomain) {
    const base = config.customDomain.replace(/\/+$/, "");
    return `${base}/${fullKey}`;
  }
  if (config.endpoint && config.bucket) {
    return `${config.endpoint.replace(/\/+$/, "")}/${config.bucket}/${fullKey}`;
  }
  return `/${fullKey}`;
}
