import { Platform } from 'react-native';
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
  base64?: string;
  width?: number;
  height?: number;
}

export class MediaUploadService {
  /**
   * Requests a signed upload URL from the server.
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
    const fileType =
      file.type ||
      (file.mimeType.startsWith('image/')
        ? 'image'
        : file.mimeType.startsWith('video/')
          ? 'video'
          : file.mimeType.startsWith('audio/')
            ? 'audio'
            : 'document');

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
    let bodyData: BodyInit_ | null = null;
    const requestHeaders: Record<string, string> = {
      'Content-Type': file.mimeType,
    };

    if (Platform.OS !== 'web' && file.base64) {
      // React Native Android/iOS okhttp handles JSON strings reliably without blob bugs
      bodyData = JSON.stringify({ base64: file.base64 });
      requestHeaders['Content-Type'] = 'application/json';
    } else if (file.base64 && Platform.OS === 'web') {
      // Decode base64 to binary ArrayBuffer for reliable transfer across Web
      try {
        const binaryString =
          typeof atob === 'function'
            ? atob(file.base64)
            : Buffer.from(file.base64, 'base64').toString('binary');
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        bodyData = bytes.buffer;
      } catch {
        bodyData = file.blob || null;
      }
    } else if (file.blob) {
      bodyData = file.blob;
    } else {
      // In Expo/React Native fetch can read from file:// or base64
      const res = await fetch(file.uri);
      bodyData = await res.blob();
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: requestHeaders,
      body: bodyData,
    });

    if (!uploadResponse.ok) {
      let serverErrorMsg = '';
      try {
        const errorJson = await uploadResponse.json();
        serverErrorMsg = errorJson?.message || errorJson?.error?.message || '';
      } catch {
        // ignore JSON parse error
      }
      throw new Error(serverErrorMsg || `Media upload failed with status ${uploadResponse.status}`);
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
