import type { Request, Response } from 'express';
import fs from 'fs';
import type { ApiResponse } from '@chatlock/shared-types';
import type { RequestUploadUrlInput } from '@chatlock/validation';
import {
  mediaService,
  type MediaService,
  type UploadUrlResponse,
} from '../services/media.service.js';
import { LocalStorageProvider } from '../storage/local-storage.provider.js';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../errors/app-error.js';

export class MediaController {
  constructor(private readonly service: MediaService = mediaService) {}

  /**
   * Generates a signed upload URL for uploading media directly to storage.
   */
  public requestUploadUrl = async (
    req: Request<unknown, unknown, RequestUploadUrlInput>,
    res: Response<ApiResponse<UploadUrlResponse>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.service.requestUploadUrl(req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Signed upload URL generated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Accepts direct binary upload payload for local storage driver.
   */
  public uploadLocalFile = async (
    req: Request<{ 0?: string; fileKey?: string }>,
    res: Response<ApiResponse<{ fileUrl: string; size: number; mimeType: string }>>,
  ): Promise<void> => {
    const fileKey = req.params[0] || req.params.fileKey || '';
    if (!fileKey) {
      throw new BadRequestError('File key is required');
    }

    const signature = req.query['signature'] as string;
    const expires = Number(req.query['expires']);
    const declaredMime = req.headers['content-type'] || 'application/octet-stream';

    if (!Buffer.isBuffer(req.body) && !(req.body instanceof Uint8Array)) {
      throw new BadRequestError('Upload body must be raw binary data');
    }

    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

    const result = await this.service.processLocalUpload(
      fileKey,
      buffer,
      declaredMime,
      signature,
      expires,
    );

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Serves uploaded static files with security headers.
   */
  public serveLocalFile = async (
    req: Request<{ 0?: string; fileKey?: string }>,
    res: Response,
  ): Promise<void> => {
    const fileKey = req.params[0] || req.params.fileKey || '';
    if (!fileKey) {
      throw new BadRequestError('File key is required');
    }

    const provider = this.service.getStorageProvider();
    if (!(provider instanceof LocalStorageProvider)) {
      throw new NotFoundError('Local file serving is only available for local storage driver');
    }

    const filePath = provider.getFilePath(fileKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File not found');
    }

    // Set secure response headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    res.sendFile(filePath);
  };
}

export const mediaController = new MediaController();
