import crypto from 'crypto';
import type { RequestUploadUrlInput } from '@chatlock/validation';
import type { MessageAttachment } from '@chatlock/shared-types';
import { config } from '../config/index.js';
import type { IStorageProvider, SignedUploadDescriptor } from '../storage/storage.interface.js';
import { LocalStorageProvider } from '../storage/local-storage.provider.js';
import { S3StorageProvider } from '../storage/s3-storage.provider.js';
import { CloudinaryStorageProvider } from '../storage/cloudinary-storage.provider.js';
import {
  conversationRepository,
  type ConversationRepository,
} from '../repositories/conversation.repository.js';
import { ForbiddenError, BadRequestError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

const mediaLogger = logger.child('MediaService');

export interface UploadUrlResponse extends SignedUploadDescriptor {
  attachment: MessageAttachment;
}

export class MediaService {
  private readonly storageProvider: IStorageProvider;

  constructor(
    private readonly convRepo: ConversationRepository = conversationRepository,
    storageProvider?: IStorageProvider,
  ) {
    if (storageProvider) {
      this.storageProvider = storageProvider;
    } else if (config.storage.driver === 'cloudinary') {
      const cloudName = config.storage.cloudinary?.cloudName?.trim() || '';
      const apiKey = config.storage.cloudinary?.apiKey?.trim() || '';
      const apiSecret = config.storage.cloudinary?.apiSecret?.trim() || '';

      if (!cloudName) {
        mediaLogger.error(
          'STORAGE_DRIVER is set to "cloudinary", but CLOUDINARY_CLOUD_NAME is not configured in .env! Media cannot be stored on Cloudinary without your Cloud Name.',
        );
      }

      this.storageProvider = new CloudinaryStorageProvider(
        cloudName,
        apiKey,
        apiSecret,
        `http://localhost:${config.app.port}`,
        config.security.sessionSecret,
      );
    } else if (config.storage.driver === 's3' && config.storage.s3?.bucket) {
      this.storageProvider = new S3StorageProvider(
        config.storage.s3.bucket,
        config.storage.s3.region || 'us-east-1',
      );
    } else {
      this.storageProvider = new LocalStorageProvider(
        config.storage.localPath,
        `http://localhost:${config.app.port}`,
        config.security.sessionSecret,
      );
    }
  }

  /**
   * Generates a collision-resistant safe storage key for a file in a conversation.
   */
  private generateFileKey(conversationId: string, originalFilename: string): string {
    const cleanFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const uniqueHash = crypto.randomBytes(6).toString('hex');
    const timestamp = Date.now();
    return `attachments/${conversationId.trim()}/${timestamp}_${uniqueHash}_${cleanFilename}`;
  }

  /**
   * Authorizes conversation participant and issues a signed upload descriptor.
   */
  public async requestUploadUrl(
    userId: string,
    input: RequestUploadUrlInput,
    clientBaseUrl?: string,
  ): Promise<UploadUrlResponse> {
    const cleanConvId = input.conversationId.trim();

    // 1. Verify user is a legitimate participant in this conversation
    const isParticipant = await this.convRepo.isParticipant(cleanConvId, userId.trim());
    if (!isParticipant) {
      throw new ForbiddenError('You are not authorized to upload media in this conversation');
    }

    // 2. Generate safe file key
    const fileKey = this.generateFileKey(cleanConvId, input.filename);

    // 3. Issue signed upload descriptor with 15-minute expiration
    const descriptor = await this.storageProvider.generateSignedUploadUrl({
      fileKey,
      mimeType: input.mimeType.toLowerCase().trim(),
      size: input.size,
      expiresInSeconds: 900,
      baseUrl: clientBaseUrl,
    });

    const attachment: MessageAttachment = {
      id: 'att_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      url: descriptor.fileUrl,
      key: fileKey,
      name: input.filename,
      size: input.size,
      mimeType: input.mimeType,
      uploadStatus: 'uploading',
    };

    mediaLogger.info('Issued signed upload descriptor', {
      userId,
      conversationId: cleanConvId,
      fileKey,
      size: input.size,
      mimeType: input.mimeType,
    });

    return {
      ...descriptor,
      attachment,
    };
  }

  /**
   * Processes a direct binary buffer upload (for local storage driver).
   */
  public async processLocalUpload(
    fileKey: string,
    buffer: Buffer,
    declaredMime: string,
    signature: string,
    expires: number,
  ): Promise<{ fileUrl: string; size: number; mimeType: string }> {
    if (!signature || !expires) {
      throw new BadRequestError('Upload signature and expiration timestamp are required');
    }

    const isValidSig = this.storageProvider.verifyUploadSignature(fileKey, signature, expires);
    if (!isValidSig) {
      throw new ForbiddenError('Invalid or expired upload signature');
    }

    const result = await this.storageProvider.saveBuffer(fileKey, buffer, declaredMime);

    return {
      fileUrl: result.fileUrl,
      size: result.size,
      mimeType: declaredMime,
    };
  }

  public getStorageProvider(): IStorageProvider {
    return this.storageProvider;
  }
}

export const mediaService = new MediaService();
