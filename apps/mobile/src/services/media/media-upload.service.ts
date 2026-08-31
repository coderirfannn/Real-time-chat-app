import { apiClient } from '../api/client';
import type { MessageAttachment } from '@chatlock/shared-types';

export interface UploadUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileKey: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  token?: string;
  expiresAt: string;
  attachment: MessageAttachment;
}

export interface LocalMediaFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  blob?: Blob;
  width?: number;
  height?: number;
}

export class MediaUploadService {
  /**
   * Requests a signed upload URL descriptor from the server.
   */
  public async requestUploadUrl(
    conversationId: string,
    file: {
      name: string;
      mimeType: string;
      size: number;
      type?: 'image' | 'file' | 'audio' | 'video';
    },
  ): Promise<UploadUrlResponse> {
    const fileType = file.type || (file.mimeType.startsWith('image/') ? 'image' : 'file');

    return apiClient.post<UploadUrlResponse>('/media/upload-url', {
      conversationId,
      filename: file.name,
      mimeType: file.mimeType,
      size: file.size,
      type: fileType,
    });
  }

  /**
   * Performs direct binary stream upload to the signed storage URL.
   */
  public async uploadBinary(uploadUrl: string, file: LocalMediaFile): Promise<boolean> {
    let bodyData: unknown;

    if (file.blob) {
      bodyData = file.blob;
    } else {
      // In Expo/React Native fetch can read from file:// or base64
      const res = await fetch(file.uri);
      bodyData = await res.blob();
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.mimeType,
      },
      body: bodyData as string | Blob | FormData | null,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Media upload failed with status ${uploadResponse.status}`);
    }

    return true;
  }

  /**
   * Full end-to-end media upload pipeline:
   * Requests signed descriptor -> uploads to storage -> returns validated MessageAttachment metadata.
   */
  public async uploadAttachment(
    conversationId: string,
    file: LocalMediaFile,
  ): Promise<MessageAttachment> {
    // 1. Request signed upload URL
    const descriptor = await this.requestUploadUrl(conversationId, {
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      type: file.mimeType.startsWith('image/') ? 'image' : 'file',
    });

    // 2. Upload binary to storage
    await this.uploadBinary(descriptor.uploadUrl, file);

    // 3. Return completed attachment metadata
    return {
      ...descriptor.attachment,
      uploadStatus: 'uploaded',
      width: file.width,
      height: file.height,
    };
  }
}

export const mediaUploadService = new MediaUploadService();
