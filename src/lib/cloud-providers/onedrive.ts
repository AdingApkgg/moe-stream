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
    if (!accessToken) throw new Error("OneDrive 需要授权令牌");

    if (fileInfo.fileId) {
      // Download via Graph API using item ID
      const metaResp = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileInfo.fileId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
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

    // Fallback: try direct share URL
    const resp = await fetch(fileInfo.downloadUrl || "", { redirect: "follow" });
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
