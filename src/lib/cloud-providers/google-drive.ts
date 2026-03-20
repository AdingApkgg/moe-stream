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
      downloadUrl: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    };
  }

  async downloadStream(
    fileInfo: CloudFileInfo,
    accessToken?: string,
  ): Promise<DownloadResult> {
    if (!accessToken) throw new Error("Google Drive 需要授权令牌");
    if (!fileInfo.fileId) throw new Error("缺少文件 ID");

    // Get file metadata first
    const metaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileInfo.fileId}?fields=name,size,mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaResp.ok) throw new Error(`获取文件信息失败: ${metaResp.status}`);

    const meta = (await metaResp.json()) as {
      name: string;
      size?: string;
      mimeType: string;
    };

    const downloadResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileInfo.fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
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
}
