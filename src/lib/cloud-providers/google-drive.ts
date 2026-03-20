import type { CloudProvider, CloudFileInfo, DownloadResult } from "./index";

const FILE_ID_REGEX = /\/d\/([a-zA-Z0-9_-]+)/;
const OPEN_ID_REGEX = /[?&]id=([a-zA-Z0-9_-]+)/;

export class GoogleDriveProvider implements CloudProvider {
  id = "google";
  name = "Google Drive";

  async parseShareUrl(url: string): Promise<CloudFileInfo | null> {
    let fileId: string | null = null;

    const dMatch = url.match(FILE_ID_REGEX);
    if (dMatch) fileId = dMatch[1];

    if (!fileId) {
      const idMatch = url.match(OPEN_ID_REGEX);
      if (idMatch) fileId = idMatch[1];
    }

    if (!fileId) return null;

    return {
      fileId,
      name: `google-drive-${fileId}`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  }

  async downloadStream(
    fileInfo: CloudFileInfo,
    accessToken?: string,
  ): Promise<DownloadResult> {
    if (!fileInfo.fileId) throw new Error("缺少文件 ID");

    // With OAuth token: use official API for full access
    if (accessToken) {
      return this.downloadWithApi(fileInfo.fileId, accessToken);
    }

    // Without token: fallback to public share link direct download
    return this.downloadPublic(fileInfo.fileId);
  }

  private async downloadWithApi(fileId: string, token: string): Promise<DownloadResult> {
    const metaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,size,mimeType`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!metaResp.ok) throw new Error(`获取文件信息失败: ${metaResp.status}`);

    const meta = (await metaResp.json()) as {
      name: string;
      size?: string;
      mimeType: string;
    };

    const downloadResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!downloadResp.ok) throw new Error(`下载失败: ${downloadResp.status}`);
    if (!downloadResp.body) throw new Error("响应体为空");

    return {
      stream: downloadResp.body,
      size: meta.size ? parseInt(meta.size, 10) : undefined,
      mimeType: meta.mimeType || "application/octet-stream",
      filename: meta.name,
    };
  }

  /**
   * Download a publicly shared Google Drive file without OAuth.
   * Uses the /uc?export=download endpoint. For large files Google may
   * require a confirmation token (virus scan warning); we handle that
   * by extracting the confirm token from cookies and retrying.
   */
  private async downloadPublic(fileId: string): Promise<DownloadResult> {
    const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    let resp = await fetch(baseUrl, { redirect: "follow" });

    // Google may respond with an HTML page for large files asking for confirmation.
    // Check for the confirm token in cookies or response body.
    if (resp.ok && resp.headers.get("content-type")?.includes("text/html")) {
      const html = await resp.text();

      // Extract confirm token from the HTML form
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
      if (confirmMatch) {
        const confirmUrl = `${baseUrl}&confirm=${confirmMatch[1]}`;
        resp = await fetch(confirmUrl, { redirect: "follow" });
      } else {
        // Try UUID-based confirm pattern
        const uuidMatch = html.match(/uuid=([a-f0-9-]+)/);
        if (uuidMatch) {
          const confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuidMatch[1]}`;
          resp = await fetch(confirmUrl, { redirect: "follow" });
        } else {
          throw new Error("该 Google Drive 文件可能未设置为公开分享，无法直接下载。请设置文件为「知道链接的任何人」可访问，或在上方授权 Google 账号后重试。");
        }
      }
    }

    if (!resp.ok) {
      throw new Error(`Google Drive 下载失败 (${resp.status})。文件可能未公开分享，请授权 Google 账号后重试。`);
    }
    if (!resp.body) throw new Error("响应体为空");

    const contentDisposition = resp.headers.get("content-disposition");
    const filename = contentDisposition
      ? decodeFilenameFromHeader(contentDisposition)
      : `google-drive-${fileId}`;

    return {
      stream: resp.body,
      size: Number(resp.headers.get("content-length")) || undefined,
      mimeType: resp.headers.get("content-type") || "application/octet-stream",
      filename,
    };
  }
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
