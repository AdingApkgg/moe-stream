/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次，用于初始化后台任务
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
const isServerless = !!process.env.VERCEL || !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const ts = () => new Date().toISOString();

/**
 * 确保 SiteConfig 单例行存在，并预热所有配置缓存到 Redis。
 * 从根本上杜绝重启后因 DB 行不存在 / 缓存冷启动导致回退到 TypeScript 默认值的问题。
 */
async function ensureAndWarmConfig() {
  const { prisma } = await import("@/lib/prisma");
  const { invalidateCache } = await import("@/lib/redis");

  // 1. 使用 invalidateCache（含世代计数器）彻底失效旧缓存，
  //    即使 Redis 在此刻短暂不可用，世代不一致也能防止旧数据被采用
  await Promise.all([
    invalidateCache("site:config"),
    invalidateCache("server:config"),
    invalidateCache("oauth:config"),
  ]);
  console.log(`[${ts()}][Instrumentation] 已失效所有配置缓存（含世代计数器）`);

  // 2. 确保 SiteConfig 单例行存在（使用 Prisma @default 值兜底）
  await prisma.siteConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  console.log(`[${ts()}][Instrumentation] SiteConfig 单例行已确认存在`);

  // 3. 预热配置缓存——启动期间 DB 一定可用（否则上面 upsert 已失败），
  //    写入 Redis 后第一个请求直接命中缓存，避免冷启动回退默认值
  try {
    const { warmPublicSiteConfig } = await import("@/lib/site-config");
    await warmPublicSiteConfig();
    console.log(`[${ts()}][Instrumentation] 公开配置缓存预热完成`);
  } catch (e) {
    console.error(`[${ts()}][Instrumentation] 公开配置缓存预热失败`, e);
  }

  try {
    const { warmServerConfig } = await import("@/lib/server-config");
    await warmServerConfig();
    console.log(`[${ts()}][Instrumentation] 服务端配置缓存预热完成`);
  } catch (e) {
    console.error(`[${ts()}][Instrumentation] 服务端配置缓存预热失败`, e);
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "development") {
    await ensureAndWarmConfig();

    if (isServerless) {
      console.log(`[${ts()}][Instrumentation] Serverless 环境，跳过后台常驻任务`);
      return;
    }

    const { startCoverWorker, startBackfillScheduler } = await import("@/lib/cover-auto");

    console.log(`[${ts()}][Instrumentation] 启动封面生成后台服务...`);

    startCoverWorker();
    startBackfillScheduler();

    console.log(`[${ts()}][Instrumentation] 封面生成后台服务已启动`);

    const { startBackupScheduler } = await import("@/lib/backup");
    console.log(`[${ts()}][Instrumentation] 启动数据备份调度器...`);
    await startBackupScheduler();
    console.log(`[${ts()}][Instrumentation] 数据备份调度器已启动`);

    const { startTronMonitor } = await import("@/lib/tron-monitor");
    console.log(`[${ts()}][Instrumentation] 启动 USDT 支付监听...`);
    startTronMonitor();
    console.log(`[${ts()}][Instrumentation] USDT 支付监听已启动`);
  }
}
