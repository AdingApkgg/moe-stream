import { getServerConfig } from "@/lib/server-config";

const INDEXNOW_ENDPOINTS = [
  { name: "IndexNow", url: "https://api.indexnow.org/indexnow" },
  { name: "Yandex", url: "https://yandex.com/indexnow" },
];

const REQUEST_TIMEOUT = 5000;

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 提交 URL 到 IndexNow（优化实时性）
 */
export async function submitToIndexNow(urls: string | string[]): Promise<boolean> {
  const config = await getServerConfig();
  const key = config.indexNowKey;

  if (!key) {
    return false;
  }

  const urlList = Array.isArray(urls) ? urls : [urls];

  if (urlList.length === 0) {
    return false;
  }

  const firstUrl = new URL(urlList[0]);
  const host = firstUrl.host;

  const payload = JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList,
  });

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
  };

  try {
    await Promise.any(
      INDEXNOW_ENDPOINTS.map(async (endpoint) => {
        const response = await fetchWithTimeout(
          endpoint.url,
          { method: "POST", headers, body: payload },
          REQUEST_TIMEOUT,
        );

        if (response.ok || response.status === 202) {
          console.log(`IndexNow: ${endpoint.name} 提交成功，${urlList.length} 个 URL`);
          return true;
        }
        throw new Error(`${endpoint.name}: ${response.status}`);
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function submitVideoToIndexNow(videoId: string): Promise<boolean> {
  const config = await getServerConfig();
  const appUrl = config.siteUrl;
  if (!appUrl) return false;

  const videoUrl = `${appUrl}/video/${videoId}`;
  return submitToIndexNow(videoUrl);
}

export async function submitVideosToIndexNow(videoIds: string[]): Promise<{ success: number; failed: number }> {
  const config = await getServerConfig();
  const appUrl = config.siteUrl;
  if (!appUrl || !config.indexNowKey) {
    return { success: 0, failed: videoIds.length };
  }

  const urls = videoIds.map((id) => `${appUrl}/video/${id}`);

  const batchSize = 10000;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const result = await submitToIndexNow(batch);
    if (result) {
      success += batch.length;
    } else {
      failed += batch.length;
    }
  }

  return { success, failed };
}

export async function submitGameToIndexNow(gameId: string): Promise<boolean> {
  const config = await getServerConfig();
  const appUrl = config.siteUrl;
  if (!appUrl) return false;

  const gameUrl = `${appUrl}/game/${gameId}`;
  return submitToIndexNow(gameUrl);
}

export async function submitGamesToIndexNow(gameIds: string[]): Promise<{ success: number; failed: number }> {
  const config = await getServerConfig();
  const appUrl = config.siteUrl;
  if (!appUrl || !config.indexNowKey) {
    return { success: 0, failed: gameIds.length };
  }

  const urls = gameIds.map((id) => `${appUrl}/game/${id}`);

  const batchSize = 10000;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const result = await submitToIndexNow(batch);
    if (result) {
      success += batch.length;
    } else {
      failed += batch.length;
    }
  }

  return { success, failed };
}

export async function submitSitePages(): Promise<boolean> {
  const config = await getServerConfig();
  const appUrl = config.siteUrl;
  if (!appUrl) return false;

  const pages = [appUrl, `${appUrl}/tags`, `${appUrl}/search`];

  return submitToIndexNow(pages);
}
