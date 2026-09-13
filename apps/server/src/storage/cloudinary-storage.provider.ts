import crypto from 'crypto';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import type { IStorageProvider, SignedUploadDescriptor } from './storage.interface.js';
import { verifyBufferMagicBytes } from './magic-bytes.js';
import { BadRequestError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const cloudinaryLogger = logger.child('CloudinaryStorageProvider');

export class CloudinaryStorageProvider implements IStorageProvider {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly signingSecret: string;

  constructor(
    cloudName: string,
    apiKey: string,
    apiSecret: string,
    baseUrl: string = 'http://localhost:5000',
    signingSecret?: string,
  ) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.signingSecret = signingSecret || apiSecret || 'chatlock_default_signing_secret';

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
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
      cloudinaryLogger.warn('Signed upload URL has expired', { fileKey, expires });
      return false;
    }

    const expectedSignature = this.computeSignature(fileKey, expires);

    if (signature.length !== expectedSignature.length) {
      return false;
    }

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
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
    if (!this.cloudName) {
      throw new BadRequestError(
        'Cloudinary storage is active, but CLOUDINARY_CLOUD_NAME is not configured in .env. Please provide your Cloudinary Cloud Name.',
      );
    }

    const effectiveBaseUrl = (params.baseUrl || this.baseUrl).replace(/\/+$/, '');
    const expires = Date.now() + params.expiresInSeconds * 1000;
    const signature = this.computeSignature(params.fileKey, expires);

    const uploadUrl = `${effectiveBaseUrl}/api/v1/media/upload/${encodeURIComponent(params.fileKey)}?signature=${signature}&expires=${expires}`;
    const fileUrl = this.getPublicUrl(params.fileKey);

    cloudinaryLogger.info('Generated Cloudinary signed upload descriptor', {
      fileKey: params.fileKey,
      cloudName: this.cloudName,
    });

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

  public getPublicUrl(fileKey: string): string {
    if (fileKey.startsWith('http://') || fileKey.startsWith('https://')) {
      return fileKey;
    }
    const cleanKey = fileKey.replace(/^\/+/, '');
    return `https://res.cloudinary.com/${encodeURIComponent(this.cloudName)}/auto/upload/chatlock/${cleanKey}`;
  }

  private extractPublicId(fileKey: string): string {
    const cleanKey = fileKey.replace(/^\/+/, '').replace(/\.[^/.]+$/, '');
    return `chatlock/${cleanKey}`;
  }

  public async saveBuffer(
    fileKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ fileUrl: string; size: number }> {
    if (!this.cloudName) {
      throw new BadRequestError(
        'Cloudinary storage is active, but CLOUDINARY_CLOUD_NAME is not configured in .env. Please provide your Cloudinary Cloud Name.',
      );
    }

    // 1. Verify buffer magic bytes
    const isValidMagic = verifyBufferMagicBytes(buffer, mimeType);
    if (!isValidMagic) {
      throw new BadRequestError(
        `File payload does not match declared MIME type: ${mimeType}. Upload rejected.`,
      );
    }

    const publicId = this.extractPublicId(fileKey);

    // 2. Stream upload to Cloudinary
    return new Promise<{ fileUrl: string; size: number }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'auto',
          overwrite: true,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            cloudinaryLogger.error('Failed to upload stream to Cloudinary', {
              error,
              fileKey,
              publicId,
            });
            const msg = error?.message || 'Upload to Cloudinary failed with no result';
            if (msg.includes('missing permissions') || msg.includes('403')) {
              return reject(
                new BadRequestError(
                  'Cloudinary rejected upload: API Key is missing "create" (upload) permissions. Please enable Create/Upload permissions on this key in Cloudinary Console (Settings -> Access Keys).',
                ),
              );
            }
            return reject(new BadRequestError(`Upload to Cloudinary failed: ${msg}`));
          }

          cloudinaryLogger.info('File uploaded to Cloudinary successfully', {
            fileKey,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            bytes: result.bytes,
          });

          resolve({
            fileUrl: result.secure_url,
            size: result.bytes || buffer.length,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }

  public async deleteFile(fileKey: string): Promise<void> {
    const publicId = this.extractPublicId(fileKey);

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'auto',
        invalidate: true,
      });

      cloudinaryLogger.info('File deleted from Cloudinary', {
        fileKey,
        publicId,
        result: result?.result,
      });
    } catch (error) {
      cloudinaryLogger.warn('Failed to delete file from Cloudinary', {
        fileKey,
        publicId,
        error,
      });
    }
  }
}
