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

export async function getProvider(type: CloudProviderType): Promise<CloudProvider> {
  switch (type) {
    case "google": {
      const { GoogleDriveProvider } = await import("./google-drive");
      return new GoogleDriveProvider();
    }
    case "onedrive": {
      const { OneDriveProvider } = await import("./onedrive");
      return new OneDriveProvider();
    }
    case "dropbox": {
      const { DropboxProvider } = await import("./dropbox");
      return new DropboxProvider();
    }
    case "url": {
      const { UrlDownloadProvider } = await import("./url-download");
      return new UrlDownloadProvider();
    }
  }
}
