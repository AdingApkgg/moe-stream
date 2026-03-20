import type { CloudProvider, CloudFileInfo, DownloadResult } from "./index";

const DROPBOX_REGEX = /dropbox\.com/;

export class DropboxProvider implements CloudProvider {
  id = "dropbox";
  name = "Dropbox";

  async parseShareUrl(url: string): Promise<CloudFileInfo | null> {
    if (!DROPBOX_REGEX.test(url)) return null;

    // Convert share URL to direct download by replacing dl=0 with dl=1
    let downloadUrl = url.replace(/[?&]dl=0/, "?dl=1");
    if (!downloadUrl.includes("dl=1")) {
      downloadUrl += (downloadUrl.includes("?") ? "&" : "?") + "dl=1";
    }

    const filename = url.split("/").pop()?.split("?")[0] || "dropbox-file";

    return {
      name: decodeURIComponent(filename),
      downloadUrl,
    };
  }

  async downloadStream(
    fileInfo: CloudFileInfo,
    _accessToken?: string,
  ): Promise<DownloadResult> {
    const url = fileInfo.downloadUrl;
    if (!url) throw new Error("缺少下载链接");

    const resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);
    if (!resp.body) throw new Error("响应体为空");

    const contentDisposition = resp.headers.get("content-disposition");
    const filename = contentDisposition
      ? decodeFilenameFromHeader(contentDisposition)
      : fileInfo.name;

    return {
      stream: resp.body,
      size: Number(resp.headers.get("content-length")) || undefined,
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
