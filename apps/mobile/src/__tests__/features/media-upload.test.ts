import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mediaUploadService } from '../../services/media/media-upload.service';
import { apiClient } from '../../services/api/client';

describe('Mobile MediaUploadService — Task 15 Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Requests signed upload URL descriptor from server', async () => {
    const mockResponse = {
      uploadUrl: 'http://localhost:5000/api/v1/media/upload/attachments%2Fconv_1%2Ftest.png',
      fileUrl: 'http://localhost:5000/api/v1/media/files/attachments%2Fconv_1%2Ftest.png',
      fileKey: 'attachments/conv_1/test.png',
      method: 'PUT' as const,
      expiresAt: '2026-09-01T00:00:00Z',
      attachment: {
        id: 'att_123',
        url: 'http://localhost:5000/api/v1/media/files/attachments%2Fconv_1%2Ftest.png',
        name: 'test.png',
        size: 1024,
        mimeType: 'image/png',
        uploadStatus: 'uploading' as const,
      },
    };

    vi.spyOn(apiClient, 'post').mockResolvedValue(mockResponse as never);

    const descriptor = await mediaUploadService.requestUploadUrl('conv_1', {
      name: 'test.png',
      mimeType: 'image/png',
      size: 1024,
    });

    expect(descriptor.uploadUrl).toBe(mockResponse.uploadUrl);
    expect(descriptor.attachment.name).toBe('test.png');
    expect(apiClient.post).toHaveBeenCalledWith('/media/upload-url', {
      conversationId: 'conv_1',
      filename: 'test.png',
      mimeType: 'image/png',
      size: 1024,
      type: 'image',
    });
  });

  it('2. uploadAttachment: orchestrates signed URL request and binary upload', async () => {
    const mockDescriptor = {
      uploadUrl: 'http://localhost:5000/api/v1/media/upload/att.png',
      fileUrl: 'http://localhost:5000/api/v1/media/files/att.png',
      fileKey: 'attachments/conv_1/att.png',
      method: 'PUT' as const,
      expiresAt: '2026-09-01T00:00:00Z',
      attachment: {
        id: 'att_1',
        url: 'http://localhost:5000/api/v1/media/files/att.png',
        name: 'photo.png',
        size: 2048,
        mimeType: 'image/png',
      },
    };

    vi.spyOn(mediaUploadService, 'requestUploadUrl').mockResolvedValue(mockDescriptor as never);
    vi.spyOn(mediaUploadService, 'uploadBinary').mockResolvedValue(true);

    const attachment = await mediaUploadService.uploadAttachment('conv_1', {
      uri: 'blob:http://localhost:8081/photo',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 2048,
    });

    expect(attachment.url).toBe(mockDescriptor.fileUrl);
    expect(attachment.uploadStatus).toBe('uploaded');
    expect(mediaUploadService.requestUploadUrl).toHaveBeenCalled();
    expect(mediaUploadService.uploadBinary).toHaveBeenCalled();
  });
});
