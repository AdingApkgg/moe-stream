export const COVER_CONFIG = {
  /** 最终封面宽度 */
  width: 1280,
  /** 采样帧分析宽度（较大 = 更精准但更慢） */
  sampleWidth: 640,
  /** 输出格式优先级 */
  formats: ["avif", "webp", "jpg"] as const,
  /** 默认采样点（秒），会被动态采样覆盖 */
  samplePoints: [1, 3, 5, 10] as const,
  /** 动态采样数量 */
  sampleCount: 4,
  /** 最大并发 worker 数 */
  maxConcurrency: 2,
  /** 单次 ffmpeg 超时（ms） */
  timeout: 30000,
  /** ffprobe 超时（ms） */
  probeTimeout: 10000,
  /** 生成失败重试次数 */
  maxRetries: 2,
  /** 重试间隔（ms） */
  retryDelay: 1000,
  /** Redis lock TTL（秒） */
  lockTtlSeconds: 180,
  /** Redis 队列名 */
  queueName: "cover:queue",
  /** 进度追踪 key */
  progressKey: "cover:progress",
  /** 定时补全间隔（ms）*/
  backfillIntervalMs: 10 * 60 * 1000,
  /** 每次补全处理数 */
  backfillBatchSize: 50,
  /** 补全锁 TTL（秒） */
  backfillLockTtlSeconds: 300,
} as const;
