import type { CloudProvider, CloudFileInfo, DownloadResult } from "./index";

const ONEDRIVE_SHARE_REGEX =
  /1drv\.ms|onedrive\.live\.com|sharepoint\.com/;

export class OneDriveProvider implements CloudProvider {
  id = "onedrive";
  name = "OneDrive";

  async parseShareUrl(url: string): Promise<CloudFileInfo | null> {
    if (!ONEDRIVE_SHARE_REGEX.test(url)) return null;

    return {
      name: "onedrive-file",
      downloadUrl: url,
    };
  }

  async downloadStream(
    fileInfo: CloudFileInfo,
    accessToken?: string,
  ): Promise<DownloadResult> {
    // With OAuth: use Graph API for reliable download
    if (accessToken && fileInfo.fileId) {
      return this.downloadWithApi(fileInfo.fileId, accessToken);
    }

    // Without OAuth (or no fileId): try resolving share link directly
    return this.downloadFromShareLink(fileInfo);
  }

  private async downloadWithApi(fileId: string, token: string): Promise<DownloadResult> {
    const metaResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!metaResp.ok) throw new Error(`获取文件信息失败: ${metaResp.status}`);

    const meta = (await metaResp.json()) as {
      name: string;
      size: number;
      file?: { mimeType: string };
      "@microsoft.graph.downloadUrl"?: string;
    };

    const downloadUrl = meta["@microsoft.graph.downloadUrl"];
    if (!downloadUrl) throw new Error("无法获取下载链接");

    const downloadResp = await fetch(downloadUrl);
    if (!downloadResp.ok) throw new Error(`下载失败: ${downloadResp.status}`);
    if (!downloadResp.body) throw new Error("响应体为空");

    return {
      stream: downloadResp.body,
      size: meta.size,
      mimeType: meta.file?.mimeType || "application/octet-stream",
      filename: meta.name,
    };
  }

  /**
   * Download from an OneDrive/SharePoint share link without OAuth.
   * OneDrive share links can be converted to a direct download by using
   * the Graph API shares endpoint with base64-encoded sharing URL, or
   * by appending download=1 to certain link formats.
   */
  private async downloadFromShareLink(fileInfo: CloudFileInfo): Promise<DownloadResult> {
    const shareUrl = fileInfo.downloadUrl || "";
    if (!shareUrl) throw new Error("缺少分享链接");

    // Method 1: Try the public Graph shares API (no auth required for public links)
    // Encode the share URL to a sharing token: base64url("u!" + url)
    const encodedUrl = "u!" + Buffer.from(shareUrl).toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const graphResp = await fetch(
      `https://api.onedrive.com/v1.0/shares/${encodedUrl}/root/content`,
      { redirect: "manual" },
    );

    // The API returns a 302 redirect to the actual download URL
    if (graphResp.status === 302) {
      const redirectUrl = graphResp.headers.get("location");
      if (redirectUrl) {
        const downloadResp = await fetch(redirectUrl);
        if (downloadResp.ok && downloadResp.body) {
          return {
            stream: downloadResp.body,
            size: Number(downloadResp.headers.get("content-length")) || undefined,
            mimeType: downloadResp.headers.get("content-type") || "application/octet-stream",
            filename: extractFilenameFromResponse(downloadResp) || fileInfo.name,
          };
        }
      }
    }

    // Method 2: Try following the share link directly (some formats work)
    const directResp = await fetch(shareUrl, { redirect: "follow" });
    if (!directResp.ok) {
      throw new Error(`OneDrive 下载失败 (${directResp.status})。文件可能未公开分享，请授权 Microsoft 账号后重试。`);
    }
    if (!directResp.body) throw new Error("响应体为空");

    // Check if we got HTML instead of a file (login page)
    const contentType = directResp.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error("该 OneDrive 文件可能未设置为公开分享，无法直接下载。请将文件设为「拥有链接的任何人」可访问，或在上方授权 Microsoft 账号后重试。");
    }

    return {
      stream: directResp.body,
      size: Number(directResp.headers.get("content-length")) || undefined,
      mimeType: contentType || "application/octet-stream",
      filename: extractFilenameFromResponse(directResp) || fileInfo.name,
    };
  }
}

function extractFilenameFromResponse(resp: Response): string | null {
  const header = resp.headers.get("content-disposition");
  if (!header) return null;
  return decodeFilenameFromHeader(header);
}

function decodeFilenameFromHeader(header: string): string {
  const utf8Match = header.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const match = header.match(/filename=["']?([^;"'\s]+)/i);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return "downloaded-file";
}
