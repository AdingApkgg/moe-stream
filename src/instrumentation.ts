/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次，用于初始化后台任务
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // 仅在 Node.js 运行时 + 非开发环境启动（排除 Edge Runtime 和 dev server）
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "development") {
    // 清除站点配置缓存，确保重启/部署后从数据库重新加载最新配置
    const { deleteCache } = await import("@/lib/redis");
    await Promise.all([
      deleteCache("site:config"),
      deleteCache("server:config"),
    ]);
    console.log(
      `[${new Date().toISOString()}][Instrumentation] 已清除站点配置缓存`
    );

    const { startCoverWorker, startBackfillScheduler } = await import(
      "@/lib/cover-auto"
    );

    console.log(
      `[${new Date().toISOString()}][Instrumentation] 启动封面生成后台服务...`
    );

    // 启动封面队列 Worker
    startCoverWorker();

    // 启动定时补全调度器
    startBackfillScheduler();

    console.log(
      `[${new Date().toISOString()}][Instrumentation] 封面生成后台服务已启动`
    );

    // 启动数据备份调度器
    const { startBackupScheduler } = await import("@/lib/backup");
    console.log(
      `[${new Date().toISOString()}][Instrumentation] 启动数据备份调度器...`
    );
    await startBackupScheduler();
    console.log(
      `[${new Date().toISOString()}][Instrumentation] 数据备份调度器已启动`
    );

    // 启动 TRC20 USDT 支付监听
    const { startTronMonitor } = await import("@/lib/tron-monitor");
    console.log(
      `[${new Date().toISOString()}][Instrumentation] 启动 USDT 支付监听...`
    );
    startTronMonitor();
    console.log(
      `[${new Date().toISOString()}][Instrumentation] USDT 支付监听已启动`
    );
  }
}
