"use client";

import { useEffect } from "react";

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to load chunk") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

export default function GlobalError({
  error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      const reloadKey = "chunk-error-reload";
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();

      if (!lastReload || now - Number(lastReload) > 10_000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
        return;
      }
    }
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>页面加载出错</h2>
        <p style={{ color: "#666", maxWidth: "24rem" }}>
          {isChunkLoadError(error)
            ? "网站已更新，正在加载新版本..."
            : "发生了意外错误，请尝试刷新页面。"}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "0.5rem 1.5rem",
            borderRadius: "0.375rem",
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          刷新页面
        </button>
      </body>
    </html>
  );
}
