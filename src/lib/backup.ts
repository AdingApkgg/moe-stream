import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import {
  getStorageConfig,
  uploadToS3,
  deleteFromS3,
  downloadFromS3,
  type StorageConfig,
} from "@/lib/s3-client";
import type { BackupType } from "@/generated/prisma/client";

const execAsync = promisify(exec);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const TEMP_DIR = path.join(process.cwd(), ".backup-tmp");

function log(msg: string, ...args: unknown[]) {
  const ts = new Date().toISOString();
  console.log(`[${ts}][Backup] ${msg}`, ...args);
}

async function ensureTempDir() {
  await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
}

async function cleanTempDir() {
  await fs.rm(TEMP_DIR, { recursive: true, force: true }).catch(() => {});
}

const PG_SEARCH_PATHS = [
  "", // system PATH
  "/opt/homebrew/opt/postgresql@18/bin/",
  "/opt/homebrew/opt/postgresql@17/bin/",
  "/opt/homebrew/opt/postgresql@16/bin/",
  "/opt/homebrew/opt/libpq/bin/",
  "/usr/local/opt/postgresql@18/bin/",
  "/usr/local/opt/postgresql@17/bin/",
  "/usr/local/opt/postgresql@16/bin/",
  "/usr/lib/postgresql/17/bin/",
  "/usr/lib/postgresql/16/bin/",
];

let pgBinPrefix: string | null = null;

async function findPgBin(name: string): Promise<string> {
  if (pgBinPrefix !== null) return `${pgBinPrefix}${name}`;

  for (const prefix of PG_SEARCH_PATHS) {
    try {
      const bin = `${prefix}${name}`;
      await execAsync(`"${bin}" --version`, { timeout: 5_000 });
      pgBinPrefix = prefix;
      log(`找到 PostgreSQL 工具: ${bin}`);
      return bin;
    } catch {
      // continue
    }
  }
  throw new Error(
    `未找到 ${name}，请安装 PostgreSQL 客户端工具或将其加入 PATH`,
  );
}

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "").split("?")[0],
  };
}

async function dumpDatabase(outputPath: string): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL 未配置");

  const pgDump = await findPgBin("pg_dump");
  const db = parseDatabaseUrl(dbUrl);
  const env = { ...process.env, PGPASSWORD: db.password };

  const cmd = [
    `"${pgDump}"`,
    `-h ${db.host}`,
    `-p ${db.port}`,
    `-U ${db.user}`,
    `--format=custom`,
    `--compress=6`,
    `--no-owner`,
    `--no-privileges`,
    `-f "${outputPath}"`,
    db.database,
  ].join(" ");

  await execAsync(cmd, { env, timeout: 300_000 });
}

async function packUploads(outputPath: string): Promise<void> {
  const uploadsDir = path.resolve(process.cwd(), UPLOAD_DIR);
  try {
    await fs.access(uploadsDir);
  } catch {
    log("uploads 目录不存在，跳过");
    return;
  }
  await execAsync(
    `tar -czf "${outputPath}" -C "${path.dirname(uploadsDir)}" "${path.basename(uploadsDir)}"`,
    { timeout: 600_000 },
  );
}

async function packConfig(outputPath: string): Promise<void> {
  const cwd = process.cwd();
  const envFiles: string[] = [];
  const candidates = [".env", ".env.local", ".env.production", ".env.development"];
  for (const name of candidates) {
    try {
      await fs.access(path.join(cwd, name));
      envFiles.push(name);
    } catch {
      // skip
    }
  }
  if (envFiles.length === 0) {
    log("未找到配置文件，跳过");
    return;
  }
  const fileArgs = envFiles.map((f) => `"${f}"`).join(" ");
  await execAsync(`tar -czf "${outputPath}" -C "${cwd}" ${fileArgs}`, {
    timeout: 30_000,
  });
}

async function mergeArchives(
  files: string[],
  outputPath: string,
): Promise<void> {
  const existing = [];
  for (const f of files) {
    try {
      await fs.access(f);
      existing.push(f);
    } catch {
      // skip
    }
  }

  if (existing.length === 0) {
    throw new Error("没有可合并的文件");
  }

  if (existing.length === 1) {
    await fs.copyFile(existing[0], outputPath);
    return;
  }

  const fileArgs = existing.map((f) => `"${path.basename(f)}"`).join(" ");
  await execAsync(
    `tar -czf "${outputPath}" -C "${TEMP_DIR}" ${fileArgs}`,
    { timeout: 600_000 },
  );
}

export interface CreateBackupOptions {
  type: BackupType;
  includeDatabase?: boolean;
  includeUploads?: boolean;
  includeConfig?: boolean;
}

export async function createBackup(
  options: CreateBackupOptions,
): Promise<string> {
  const {
    type,
    includeDatabase = true,
    includeUploads = true,
    includeConfig = true,
  } = options;

  const storageConfig = await getStorageConfig();
  if (storageConfig.provider === "local") {
    throw new Error("请先在系统设置中配置对象存储");
  }
  if (!storageConfig.bucket) {
    throw new Error("对象存储桶名称未配置");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.tar.gz`;
  const storagePath = `backups/${filename}`;

  const record = await prisma.backupRecord.create({
    data: {
      filename,
      type,
      status: "RUNNING",
      storagePath,
      includes: { database: includeDatabase, uploads: includeUploads, config: includeConfig },
    },
  });

  try {
    await ensureTempDir();
    const parts: string[] = [];

    if (includeDatabase) {
      log("正在导出数据库...");
      const dbPath = path.join(TEMP_DIR, "database.dump");
      await dumpDatabase(dbPath);
      parts.push(dbPath);
      log("数据库导出完成");
    }

    if (includeUploads) {
      log("正在打包 uploads 目录...");
      const uploadsPath = path.join(TEMP_DIR, "uploads.tar.gz");
      await packUploads(uploadsPath);
      parts.push(uploadsPath);
      log("uploads 目录打包完成");
    }

    if (includeConfig) {
      log("正在打包配置文件...");
      const configPath = path.join(TEMP_DIR, "config.tar.gz");
      await packConfig(configPath);
      parts.push(configPath);
      log("配置文件打包完成");
    }

    const finalPath = path.join(TEMP_DIR, filename);
    await mergeArchives(parts, finalPath);

    const stat = await fs.stat(finalPath);
    const fileBuffer = await fs.readFile(finalPath);

    log(`正在上传至对象存储... (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    await uploadToS3(storageConfig, storagePath, fileBuffer, "application/gzip");
    log("上传完成");

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: "COMPLETED",
        size: BigInt(stat.size),
        completedAt: new Date(),
      },
    });

    return record.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("备份失败:", message);
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: "FAILED", errorMessage: message },
    });
    throw err;
  } finally {
    await cleanTempDir();
  }
}

export async function cleanOldBackups(retentionDays: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expired = await prisma.backupRecord.findMany({
    where: {
      createdAt: { lt: cutoff },
      status: "COMPLETED",
    },
  });

  if (expired.length === 0) return 0;

  let storageConfig: StorageConfig | null = null;
  try {
    storageConfig = await getStorageConfig();
  } catch {
    // ignore
  }

  let deleted = 0;
  for (const record of expired) {
    try {
      if (record.storagePath && storageConfig && storageConfig.provider !== "local") {
        await deleteFromS3(storageConfig, record.storagePath);
      }
      await prisma.backupRecord.delete({ where: { id: record.id } });
      deleted++;
    } catch (err) {
      log(`清理备份 ${record.filename} 失败:`, err instanceof Error ? err.message : err);
    }
  }

  if (deleted > 0) {
    log(`已清理 ${deleted} 个过期备份`);
  }
  return deleted;
}

export async function deleteBackupById(id: string): Promise<void> {
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) throw new Error("备份记录不存在");

  if (record.storagePath && record.status === "COMPLETED") {
    try {
      const storageConfig = await getStorageConfig();
      if (storageConfig.provider !== "local") {
        await deleteFromS3(storageConfig, record.storagePath);
      }
    } catch (err) {
      log(`删除存储文件失败:`, err instanceof Error ? err.message : err);
    }
  }

  await prisma.backupRecord.delete({ where: { id } });
}

// ==================== 恢复备份 ====================

async function restoreDatabase(dumpPath: string): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL 未配置");

  const pgRestore = await findPgBin("pg_restore");
  const db = parseDatabaseUrl(dbUrl);
  const env = { ...process.env, PGPASSWORD: db.password };

  const cmd = [
    `"${pgRestore}"`,
    `-h ${db.host}`,
    `-p ${db.port}`,
    `-U ${db.user}`,
    `--dbname=${db.database}`,
    `--clean`,
    `--if-exists`,
    `--no-owner`,
    `--no-privileges`,
    `--single-transaction`,
    `"${dumpPath}"`,
  ].join(" ");

  await execAsync(cmd, { env, timeout: 600_000 });
}

async function restoreUploads(archivePath: string): Promise<void> {
  const uploadsDir = path.resolve(process.cwd(), UPLOAD_DIR);
  const parentDir = path.dirname(uploadsDir);
  await fs.mkdir(parentDir, { recursive: true }).catch(() => {});
  await execAsync(`tar -xzf "${archivePath}" -C "${parentDir}"`, {
    timeout: 600_000,
  });
}

async function restoreConfig(archivePath: string): Promise<void> {
  const cwd = process.cwd();
  await execAsync(`tar -xzf "${archivePath}" -C "${cwd}"`, {
    timeout: 30_000,
  });
}

export interface RestoreResult {
  database: boolean;
  uploads: boolean;
  config: boolean;
  errors: string[];
}

export async function restoreBackupById(id: string): Promise<RestoreResult> {
  const record = await prisma.backupRecord.findUnique({ where: { id } });
  if (!record) throw new Error("备份记录不存在");
  if (record.status !== "COMPLETED") throw new Error("备份尚未完成，无法恢复");
  if (!record.storagePath) throw new Error("备份存储路径不存在");

  const storageConfig = await getStorageConfig();
  if (storageConfig.provider === "local") {
    throw new Error("本地存储不支持恢复功能");
  }

  const includes = (record.includes as { database?: boolean; uploads?: boolean; config?: boolean }) ?? {};
  const result: RestoreResult = { database: false, uploads: false, config: false, errors: [] };

  try {
    await ensureTempDir();

    log(`正在从对象存储下载备份 ${record.filename}...`);
    const fileBuffer = await downloadFromS3(storageConfig, record.storagePath);
    const archivePath = path.join(TEMP_DIR, record.filename);
    await fs.writeFile(archivePath, fileBuffer);
    log(`下载完成 (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // 判断备份结构：多文件合并包 vs 单文件
    const hasMultipleParts = Object.values(includes).filter(Boolean).length > 1;

    if (hasMultipleParts) {
      // 先解压外层 tar.gz 得到 database.dump / uploads.tar.gz / config.tar.gz
      await execAsync(`tar -xzf "${archivePath}" -C "${TEMP_DIR}"`, { timeout: 600_000 });
    }

    if (includes.database) {
      const dbPath = hasMultipleParts
        ? path.join(TEMP_DIR, "database.dump")
        : archivePath;
      try {
        await fs.access(dbPath);
        log("正在恢复数据库...");
        await restoreDatabase(dbPath);
        result.database = true;
        log("数据库恢复完成");
      } catch (err) {
        const msg = `数据库恢复失败: ${err instanceof Error ? err.message : err}`;
        log(msg);
        result.errors.push(msg);
      }
    }

    if (includes.uploads) {
      const uploadsArchive = hasMultipleParts
        ? path.join(TEMP_DIR, "uploads.tar.gz")
        : archivePath;
      try {
        await fs.access(uploadsArchive);
        log("正在恢复 uploads 目录...");
        await restoreUploads(uploadsArchive);
        result.uploads = true;
        log("uploads 目录恢复完成");
      } catch (err) {
        const msg = `uploads 恢复失败: ${err instanceof Error ? err.message : err}`;
        log(msg);
        result.errors.push(msg);
      }
    }

    if (includes.config) {
      const configArchive = hasMultipleParts
        ? path.join(TEMP_DIR, "config.tar.gz")
        : archivePath;
      try {
        await fs.access(configArchive);
        log("正在恢复配置文件...");
        await restoreConfig(configArchive);
        result.config = true;
        log("配置文件恢复完成");
      } catch (err) {
        const msg = `配置文件恢复失败: ${err instanceof Error ? err.message : err}`;
        log(msg);
        result.errors.push(msg);
      }
    }

    log("恢复操作完成", result);
    return result;
  } finally {
    await cleanTempDir();
  }
}

// ==================== 定时调度 ====================

let backupTimer: ReturnType<typeof setInterval> | null = null;

async function runScheduledBackup() {
  try {
    const config = await prisma.siteConfig.findUnique({
      where: { id: "default" },
      select: {
        backupEnabled: true,
        backupRetentionDays: true,
        backupIncludeUploads: true,
        backupIncludeConfig: true,
        storageProvider: true,
      },
    });

    if (!config?.backupEnabled || config.storageProvider === "local") return;

    log("开始自动备份...");
    await createBackup({
      type: "AUTO",
      includeDatabase: true,
      includeUploads: config.backupIncludeUploads,
      includeConfig: config.backupIncludeConfig,
    });

    await cleanOldBackups(config.backupRetentionDays);
    log("自动备份完成");
  } catch (err) {
    log("自动备份失败:", err instanceof Error ? err.message : err);
  }
}

export async function startBackupScheduler() {
  if (backupTimer) return;

  const config = await prisma.siteConfig
    .findUnique({
      where: { id: "default" },
      select: { backupEnabled: true, backupIntervalHours: true },
    })
    .catch(() => null);

  if (!config?.backupEnabled) {
    log("自动备份未启用");
    return;
  }

  const intervalMs = (config.backupIntervalHours || 24) * 60 * 60 * 1000;
  log(`自动备份已启用，间隔 ${config.backupIntervalHours} 小时`);

  backupTimer = setInterval(() => {
    void runScheduledBackup();
  }, intervalMs);
}

export function restartBackupScheduler() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  void startBackupScheduler();
}
