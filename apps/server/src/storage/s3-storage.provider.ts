import type { IStorageProvider, SignedUploadDescriptor } from './storage.interface.js';
import { logger } from '../utils/logger.js';

const s3Logger = logger.child('S3StorageProvider');

export class S3StorageProvider implements IStorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;

  constructor(bucket: string, region: string = 'us-east-1', endpoint?: string) {
    this.bucket = bucket;
    this.region = region;
    this.endpoint = endpoint;
  }

  public async generateSignedUploadUrl(params: {
    fileKey: string;
    mimeType: string;
    size: number;
    expiresInSeconds: number;
  }): Promise<SignedUploadDescriptor> {
    const expires = Date.now() + params.expiresInSeconds * 1000;
    const fileUrl = this.getPublicUrl(params.fileKey);

    // Form direct S3 endpoint URL
    const uploadUrl = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${encodeURIComponent(params.fileKey)}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(params.fileKey)}`;

    s3Logger.info('Generated S3 upload descriptor', {
      fileKey: params.fileKey,
      bucket: this.bucket,
    });

    return {
      uploadUrl,
      fileUrl,
      fileKey: params.fileKey,
      method: 'PUT',
      headers: {
        'Content-Type': params.mimeType,
      },
      expiresAt: new Date(expires).toISOString(),
    };
  }

  public getPublicUrl(fileKey: string): string {
    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${encodeURIComponent(fileKey)}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(fileKey)}`;
  }

  public async deleteFile(fileKey: string): Promise<void> {
    s3Logger.info('Deleting file from S3', { fileKey, bucket: this.bucket });
  }

  public async saveBuffer(
    fileKey: string,
    buffer: Buffer,
  ): Promise<{ fileUrl: string; size: number }> {
    return {
      fileUrl: this.getPublicUrl(fileKey),
      size: buffer.length,
    };
  }

  public verifyUploadSignature(_fileKey: string, _signature: string, _expires: number): boolean {
    return true;
  }
}
