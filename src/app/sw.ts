/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// 不缓存的文件类型（视频、音频、大文件）
const EXCLUDED_EXTENSIONS = /\.(?:mp4|webm|mkv|avi|mov|wmv|flv|m4v|mp3|wav|ogg|flac|m4a|aac|zip|rar|7z|tar|gz|pdf)$/i;

// 不缓存的路径
const EXCLUDED_PATHS = /\/uploads\//i;

// Auth 相关路径 - 永不缓存
const AUTH_PATHS = /\/api\/auth\//i;

// 已知的运行时缓存名称，用于激活时清理旧缓存
const KNOWN_CACHES = new Set(["static-assets", "images", "fonts", "api", "pages", "js-css"]);

// 新 SW 激活时清理所有运行时缓存，确保部署后不引用旧 chunk
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => KNOWN_CACHES.has(name)).map((name) => caches.delete(name)))),
  );
});

const isSameOrigin = (url: URL) => url.origin === self.location.origin;

const serwist = new Serwist({
  precacheEntries: [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 视频、音频、大文件 - 不缓存，直接走网络
    {
      matcher: ({ url }) =>
        isSameOrigin(url) && (EXCLUDED_EXTENSIONS.test(url.pathname) || EXCLUDED_PATHS.test(url.pathname)),
      handler: new NetworkOnly(),
    },
    // Auth 相关 API - 永不缓存，确保 session 状态实时
    {
      matcher: ({ url }) => isSameOrigin(url) && AUTH_PATHS.test(url.pathname),
      handler: new NetworkOnly(),
    },
    // 静态资源 - 缓存优先（仅同源）
    {
      matcher: ({ url }) => isSameOrigin(url) && /^\/_next\/static\//.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "static-assets",
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          }),
        ],
      }),
    },
    // 图片 - 缓存优先（仅同源）
    {
      matcher: ({ url }) => isSameOrigin(url) && /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/i.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 字体 - 缓存优先（仅同源）
    {
      matcher: ({ url }) => isSameOrigin(url) && /\.(?:woff|woff2|ttf|otf|eot)$/i.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "fonts",
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          }),
        ],
      }),
    },
    // API 请求 - 网络优先（只缓存成功响应，仅同源）
    {
      matcher: ({ url }) => isSameOrigin(url) && /^\/api\//.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "api",
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 60 * 5, // 5 minutes
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // HTML 页面 - 网络优先（仅同源）
    {
      matcher: ({ request, url }) => isSameOrigin(url) && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24, // 1 day
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // JS/CSS 资源 - 旧缓存优先（仅同源）
    {
      matcher: ({ url }) => isSameOrigin(url) && /\.(?:js|css)$/i.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "js-css",
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 跨域请求和未匹配请求不会被 SW 拦截，直接由浏览器处理
  ],
});

serwist.addEventListeners();
