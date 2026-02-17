/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次，用于初始化后台任务
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // 仅在 Node.js 运行时 + 非开发环境启动（排除 Edge Runtime 和 dev server）
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "development") {
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
  }
}
