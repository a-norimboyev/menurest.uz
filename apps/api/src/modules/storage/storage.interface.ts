export interface UploadedFilePayload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface StorageAdapter {
  upload(file: UploadedFilePayload): Promise<UploadResult>;
  delete(keyOrUrl: string): Promise<void>;
}
