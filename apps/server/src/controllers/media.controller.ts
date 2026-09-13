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

    const host = req.get('host');
    const protocol = req.protocol;
    const clientBaseUrl = host ? `${protocol}://${host}` : undefined;

    const result = await this.service.requestUploadUrl(req.user.id, req.body, clientBaseUrl);

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

    let buffer: Buffer;
    const contentType = (req.headers['content-type'] || '').toLowerCase();

    if (Buffer.isBuffer(req.body)) {
      const textHead = req.body.toString('utf-8', 0, 30).trim();
      if (
        textHead.startsWith('{') &&
        (contentType.includes('json') || textHead.includes('"base64"'))
      ) {
        try {
          const parsed = JSON.parse(req.body.toString('utf-8')) as { base64?: string };
          if (parsed && typeof parsed.base64 === 'string') {
            buffer = Buffer.from(parsed.base64, 'base64');
          } else {
            buffer = req.body;
          }
        } catch {
          buffer = req.body;
        }
      } else {
        buffer = req.body;
      }
    } else if (req.body instanceof Uint8Array) {
      buffer = Buffer.from(req.body);
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      buffer = Buffer.from(req.body, 'base64');
    } else if (
      req.body &&
      typeof req.body === 'object' &&
      typeof (req.body as Record<string, unknown>)['base64'] === 'string'
    ) {
      buffer = Buffer.from((req.body as { base64: string }).base64, 'base64');
    } else {
      throw new BadRequestError('Upload body must be raw binary data');
    }

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
      res.redirect(provider.getPublicUrl(fileKey));
      return;
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
