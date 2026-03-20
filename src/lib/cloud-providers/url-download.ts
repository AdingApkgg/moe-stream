import type { CloudProvider, CloudFileInfo, DownloadResult } from "./index";
import { isUrlSafe } from "./ssrf-guard";

export class UrlDownloadProvider implements CloudProvider {
  id = "url";
  name = "URL 下载";

  async parseShareUrl(url: string): Promise<CloudFileInfo | null> {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;

      if (!isUrlSafe(parsed)) return null;

      const pathname = parsed.pathname;
      const filename = pathname.split("/").pop() || "downloaded-file";

      let size: number | undefined;
      let mimeType: string | undefined;
      try {
        const head = await fetch(url, { method: "HEAD", redirect: "follow" });
        if (head.ok) {
          const cl = head.headers.get("content-length");
          if (cl) size = parseInt(cl, 10);
          mimeType = head.headers.get("content-type") || undefined;
        }
      } catch {
        // HEAD failed, proceed without size info
      }

      return {
        name: decodeURIComponent(filename),
        size,
        mimeType,
        downloadUrl: url,
      };
    } catch {
      return null;
    }
  }

  async downloadStream(fileInfo: CloudFileInfo): Promise<DownloadResult> {
    const url = fileInfo.downloadUrl;
    if (!url) throw new Error("缺少下载链接");

    try {
      const parsed = new URL(url);
      if (!isUrlSafe(parsed)) throw new Error("该 URL 不允许访问（内部地址）");
    } catch (e) {
      if (e instanceof Error && e.message.includes("不允许")) throw e;
      throw new Error("无效的 URL");
    }

    const resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);
    if (!resp.body) throw new Error("响应体为空");

    const contentDisposition = resp.headers.get("content-disposition");
    const filename = contentDisposition
      ? decodeFilenameFromHeader(contentDisposition)
      : fileInfo.name;

    return {
      stream: resp.body,
      size: Number(resp.headers.get("content-length")) || fileInfo.size || undefined,
      mimeType: resp.headers.get("content-type") || "application/octet-stream",
      filename,
    };
  }
}

function decodeFilenameFromHeader(header: string): string {
  const match = header.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\s]+)/i);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return "downloaded-file";
}
