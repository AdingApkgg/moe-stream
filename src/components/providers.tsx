"use client";

import { Component, useState, useEffect, useRef, type ReactNode, type ErrorInfo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import superjson from "superjson";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SiteConfigProvider } from "@/contexts/site-config";
import type { PublicSiteConfig } from "@/lib/site-config";
import dynamic from "next/dynamic";
import { AnalyticsScripts } from "@/components/analytics-scripts";
import { SocketProvider } from "@/components/socket-provider";
import { MotionProvider } from "@/components/motion";

const ParticleBackground = dynamic(() => import("@/components/effects/particle-background"), { ssr: false });

class EffectErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[ParticleBackground] Effect failed:", error, info);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

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

function safeReload() {
  const key = "chunk-error-reload";
  const last = sessionStorage.getItem(key);
  const now = Date.now();
  if (!last || now - Number(last) > 10_000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
}

// 注册 Service Worker + ChunkLoadError 自动恢复（仅生产环境）
function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    // 注册 Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);

          // 当新 SW 接管时，清除旧缓存并刷新
          registration.addEventListener("controllerchange", () => {
            window.location.reload();
          });
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }

    // 捕获运行时 ChunkLoadError（路由跳转、动态 import 等）
    const handleError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error)) {
        e.preventDefault();
        safeReload();
      }
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) {
        e.preventDefault();
        safeReload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}

function EntrySound({
  url,
  volume,
  mode,
  intervalHours,
}: {
  url: string;
  volume: number;
  mode: string;
  intervalHours: number;
}) {
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;

    const SESSION_KEY = "entry-sound-session";
    const LOCAL_KEY = "entry-sound-ts";

    const shouldSkip = () => {
      if (mode === "session") {
        return !!sessionStorage.getItem(SESSION_KEY);
      }
      const ts = localStorage.getItem(LOCAL_KEY);
      if (!ts) return false;
      if (mode === "once") return true;
      // interval
      return Date.now() - Number(ts) < intervalHours * 3600_000;
    };

    if (shouldSkip()) return;

    const tryPlay = () => {
      if (playedRef.current) return;
      playedRef.current = true;
      if (mode === "session") {
        sessionStorage.setItem(SESSION_KEY, "1");
      } else {
        localStorage.setItem(LOCAL_KEY, String(Date.now()));
      }
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
      cleanup();
    };

    const cleanup = () => {
      for (const evt of ["click", "keydown", "touchstart", "scroll"] as const) {
        document.removeEventListener(evt, tryPlay, true);
      }
    };

    for (const evt of ["click", "keydown", "touchstart", "scroll"] as const) {
      document.addEventListener(evt, tryPlay, { capture: true, once: true, passive: true });
    }

    return cleanup;
  }, [url, volume, mode, intervalHours]);

  return null;
}

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function Providers({ children, siteConfig }: { children: React.ReactNode; siteConfig: PublicSiteConfig }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteConfigProvider value={siteConfig}>
            <ServiceWorkerRegistration />
            {siteConfig.entrySoundUrl && (
              <EntrySound
                url={siteConfig.entrySoundUrl}
                volume={siteConfig.entrySoundVolume}
                mode={siteConfig.entrySoundMode}
                intervalHours={siteConfig.entrySoundIntervalHours}
              />
            )}
            {siteConfig.effectEnabled && siteConfig.effectType !== "none" && (
              <EffectErrorBoundary>
                <ParticleBackground
                  config={{
                    type: siteConfig.effectType as
                      | "sakura"
                      | "firefly"
                      | "snow"
                      | "stars"
                      | "aurora"
                      | "cyber"
                      | "none",
                    density: siteConfig.effectDensity,
                    speed: siteConfig.effectSpeed,
                    opacity: siteConfig.effectOpacity,
                    color: siteConfig.effectColor,
                  }}
                />
              </EffectErrorBoundary>
            )}
            <MotionProvider>
              <SocketProvider>{children}</SocketProvider>
            </MotionProvider>
            <Toaster richColors position="top-center" />
            <AnalyticsScripts config={siteConfig} />
          </SiteConfigProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
