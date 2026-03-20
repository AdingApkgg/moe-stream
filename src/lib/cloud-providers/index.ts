export interface CloudFileInfo {
  fileId?: string;
  name: string;
  size?: number;
  mimeType?: string;
  downloadUrl?: string;
}

export interface DownloadResult {
  stream: ReadableStream<Uint8Array>;
  size?: number;
  mimeType: string;
  filename: string;
}

export interface CloudProvider {
  id: string;
  name: string;
  /** Parse a share URL to extract file info */
  parseShareUrl(url: string): Promise<CloudFileInfo | null>;
  /** Download file content as a stream */
  downloadStream(
    fileInfo: CloudFileInfo,
    accessToken?: string,
  ): Promise<DownloadResult>;
}

export { GoogleDriveProvider } from "./google-drive";
export { OneDriveProvider } from "./onedrive";
export { DropboxProvider } from "./dropbox";
export { UrlDownloadProvider } from "./url-download";

export type CloudProviderType = "google" | "onedrive" | "dropbox" | "url";

export function getProvider(type: CloudProviderType): CloudProvider {
  switch (type) {
    case "google":
      return new (require("./google-drive").GoogleDriveProvider)();
    case "onedrive":
      return new (require("./onedrive").OneDriveProvider)();
    case "dropbox":
      return new (require("./dropbox").DropboxProvider)();
    case "url":
      return new (require("./url-download").UrlDownloadProvider)();
  }
}
