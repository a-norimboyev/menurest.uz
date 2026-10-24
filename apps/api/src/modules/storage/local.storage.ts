import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { StorageAdapter, UploadedFilePayload, UploadResult } from './storage.interface.js';

export class LocalStorageAdapter implements StorageAdapter {
  private uploadsDir: string;

  constructor(customUploadsDir?: string) {
    this.uploadsDir = customUploadsDir || path.resolve(process.cwd(), 'uploads');
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Magic bytes verification to ensure file is genuinely an image (not renamed exe/script)
   */
  private validateImageMagicBytes(buffer: Buffer): { isValid: boolean; extension: string; mimeType: string } {
    if (buffer.length < 12) {
      return { isValid: false, extension: '', mimeType: '' };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { isValid: true, extension: 'jpg', mimeType: 'image/jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { isValid: true, extension: 'png', mimeType: 'image/png' };
    }

    // WEBP: 'RIFF' .... 'WEBP'
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    if (riff === 'RIFF' && webp === 'WEBP') {
      return { isValid: true, extension: 'webp', mimeType: 'image/webp' };
    }

    return { isValid: false, extension: '', mimeType: '' };
  }

  async upload(file: UploadedFilePayload): Promise<UploadResult> {
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSizeBytes) {
      throw new Error(`Fayl hajmi ruxsat etilgan maksimal 5 MB dan oshib ketdi (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Real content inspection via magic bytes
    const verification = this.validateImageMagicBytes(file.buffer);
    if (!verification.isValid) {
      throw new Error('Fayl haqiqiy tasvir formati emas. Faqat JPEG, PNG va WEBP tasvirlariga ruxsat beriladi');
    }

    await this.ensureDir();

    // Random cryptographically secure filename
    const randomKey = `${crypto.randomUUID()}.${verification.extension}`;
    const destinationPath = path.join(this.uploadsDir, randomKey);

    await fs.writeFile(destinationPath, file.buffer);

    return {
      url: `/uploads/${randomKey}`,
      key: randomKey,
      size: file.size,
      mimeType: verification.mimeType,
    };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const filename = path.basename(keyOrUrl);
    const targetPath = path.join(this.uploadsDir, filename);
    try {
      await fs.unlink(targetPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
