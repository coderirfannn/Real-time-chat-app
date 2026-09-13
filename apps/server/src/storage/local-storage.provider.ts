import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { IStorageProvider, SignedUploadDescriptor } from './storage.interface.js';
import { verifyBufferMagicBytes } from './magic-bytes.js';
import { BadRequestError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const storageLogger = logger.child('LocalStorageProvider');

export class LocalStorageProvider implements IStorageProvider {
  private readonly baseUploadDir: string;
  private readonly baseUrl: string;
  private readonly signingSecret: string;

  constructor(
    baseUploadDir: string = './uploads',
    baseUrl: string = 'http://localhost:5000',
    signingSecret: string = 'dev_storage_signing_secret_min_32_chars_123456',
  ) {
    this.baseUploadDir = path.resolve(process.cwd(), baseUploadDir);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.signingSecret = signingSecret;

    // Ensure upload directory exists
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  private computeSignature(fileKey: string, expires: number): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${fileKey}:${expires}`)
      .digest('hex');
  }

  public verifyUploadSignature(fileKey: string, signature: string, expires: number): boolean {
    if (!signature || !expires || isNaN(expires)) {
      return false;
    }

    if (Date.now() > expires) {
      storageLogger.warn('Signed upload URL has expired', { fileKey, expires });
      return false;
    }

    const expectedSignature = this.computeSignature(fileKey, expires);

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  public async generateSignedUploadUrl(params: {
    fileKey: string;
    mimeType: string;
    size: number;
    expiresInSeconds: number;
    baseUrl?: string;
  }): Promise<SignedUploadDescriptor> {
    const effectiveBaseUrl = (params.baseUrl || this.baseUrl).replace(/\/+$/, '');
    const expires = Date.now() + params.expiresInSeconds * 1000;
    const signature = this.computeSignature(params.fileKey, expires);

    const uploadUrl = `${effectiveBaseUrl}/api/v1/media/upload/${encodeURIComponent(params.fileKey)}?signature=${signature}&expires=${expires}`;
    const fileUrl = this.getPublicUrl(params.fileKey, effectiveBaseUrl);

    return {
      uploadUrl,
      fileUrl,
      fileKey: params.fileKey,
      method: 'PUT',
      headers: {
        'Content-Type': params.mimeType,
      },
      token: signature,
      expiresAt: new Date(expires).toISOString(),
    };
  }

  public getPublicUrl(fileKey: string, baseUrl?: string): string {
    const effectiveBaseUrl = (baseUrl || this.baseUrl).replace(/\/+$/, '');
    return `${effectiveBaseUrl}/api/v1/media/files/${encodeURIComponent(fileKey)}`;
  }

  private resolveSafeFilePath(fileKey: string): string {
    const targetPath = path.resolve(this.baseUploadDir, fileKey);
    // Path traversal defense
    if (!targetPath.startsWith(this.baseUploadDir)) {
      throw new BadRequestError('Invalid file path: path traversal detected');
    }
    return targetPath;
  }

  public async saveBuffer(
    fileKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ fileUrl: string; size: number }> {
    // 1. Verify magic bytes
    const isValidMagic = verifyBufferMagicBytes(buffer, mimeType);
    if (!isValidMagic) {
      throw new BadRequestError(
        `File payload does not match declared MIME type: ${mimeType}. Upload rejected.`,
      );
    }

    // 2. Resolve safe path & ensure directory
    const targetFilePath = this.resolveSafeFilePath(fileKey);
    const parentDir = path.dirname(targetFilePath);

    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(targetFilePath, buffer);

    storageLogger.info('File written to local storage', {
      fileKey,
      size: buffer.length,
      mimeType,
    });

    return {
      fileUrl: this.getPublicUrl(fileKey),
      size: buffer.length,
    };
  }

  public async deleteFile(fileKey: string): Promise<void> {
    const targetPath = this.resolveSafeFilePath(fileKey);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
      storageLogger.info('File deleted from local storage', { fileKey });
    }
  }

  public getFilePath(fileKey: string): string {
    return this.resolveSafeFilePath(fileKey);
  }
}
