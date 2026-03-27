/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次，用于初始化后台任务
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
const isServerless = !!process.env.VERCEL || !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "development") {
    const { deleteCache } = await import("@/lib/redis");
    await Promise.all([deleteCache("site:config"), deleteCache("server:config")]);
    console.log(`[${new Date().toISOString()}][Instrumentation] 已清除站点配置缓存`);

    if (isServerless) {
      console.log(`[${new Date().toISOString()}][Instrumentation] Serverless 环境，跳过后台常驻任务`);
      return;
    }

    const { startCoverWorker, startBackfillScheduler } = await import("@/lib/cover-auto");

    console.log(`[${new Date().toISOString()}][Instrumentation] 启动封面生成后台服务...`);

    startCoverWorker();
    startBackfillScheduler();

    console.log(`[${new Date().toISOString()}][Instrumentation] 封面生成后台服务已启动`);

    const { startBackupScheduler } = await import("@/lib/backup");
    console.log(`[${new Date().toISOString()}][Instrumentation] 启动数据备份调度器...`);
    await startBackupScheduler();
    console.log(`[${new Date().toISOString()}][Instrumentation] 数据备份调度器已启动`);

    const { startTronMonitor } = await import("@/lib/tron-monitor");
    console.log(`[${new Date().toISOString()}][Instrumentation] 启动 USDT 支付监听...`);
    startTronMonitor();
    console.log(`[${new Date().toISOString()}][Instrumentation] USDT 支付监听已启动`);
  }
}
