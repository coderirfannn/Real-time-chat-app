import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaService } from '../../services/media.service.js';
import type { ConversationRepository } from '../../repositories/conversation.repository.js';
import type { IStorageProvider, SignedUploadDescriptor } from '../../storage/storage.interface.js';
import { ForbiddenError } from '../../errors/app-error.js';

describe('MediaService — Task 15 Unit Tests', () => {
  let mockConvRepo: ConversationRepository;
  let mockStorageProvider: IStorageProvider;
  let mediaService: MediaService;

  beforeEach(() => {
    mockConvRepo = {
      isParticipant: vi.fn(),
    } as unknown as ConversationRepository;

    mockStorageProvider = {
      generateSignedUploadUrl: vi
        .fn()
        .mockImplementation(
          async (params: {
            fileKey: string;
            mimeType: string;
            size: number;
          }): Promise<SignedUploadDescriptor> => ({
            uploadUrl: `http://localhost:5000/upload/${params.fileKey}`,
            fileUrl: `http://localhost:5000/files/${params.fileKey}`,
            fileKey: params.fileKey,
            method: 'PUT',
            expiresAt: new Date().toISOString(),
          }),
        ),
      getPublicUrl: vi.fn().mockReturnValue('http://localhost:5000/files/test.png'),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      saveBuffer: vi
        .fn()
        .mockResolvedValue({ fileUrl: 'http://localhost:5000/files/test.png', size: 100 }),
      verifyUploadSignature: vi.fn().mockReturnValue(true),
    };

    mediaService = new MediaService(mockConvRepo, mockStorageProvider);
  });

  it('1. Issues signed upload URL when caller is a verified conversation participant', async () => {
    vi.mocked(mockConvRepo.isParticipant).mockResolvedValue(true);

    const result = await mediaService.requestUploadUrl('user_123', {
      conversationId: 'conv_456',
      filename: 'sample-image.png',
      mimeType: 'image/png',
      size: 2048,
      type: 'image',
    });

    expect(result.uploadUrl).toBeDefined();
    expect(result.fileKey).toContain('attachments/conv_456/');
    expect(result.attachment).toBeDefined();
    expect(result.attachment.name).toBe('sample-image.png');
    expect(result.attachment.mimeType).toBe('image/png');
    expect(mockConvRepo.isParticipant).toHaveBeenCalledWith('conv_456', 'user_123');
  });

  it('2. Rejects requestUploadUrl when caller is NOT a participant', async () => {
    vi.mocked(mockConvRepo.isParticipant).mockResolvedValue(false);

    await expect(
      mediaService.requestUploadUrl('unauthorized_user', {
        conversationId: 'conv_456',
        filename: 'secret.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        type: 'file',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('3. Instantiates CloudinaryStorageProvider when STORAGE_DRIVER is cloudinary', async () => {
    vi.resetModules();
    vi.doMock('../../config/index.js', () => ({
      config: {
        storage: {
          driver: 'cloudinary',
          cloudinary: {
            cloudName: 'test-cloud',
            apiKey: 'test-key',
            apiSecret: 'test-secret',
          },
        },
        app: { port: 5000 },
        security: { sessionSecret: 'secret123' },
      },
    }));

    const { MediaService: DynamicMediaService } = await import('../../services/media.service.js');
    const { CloudinaryStorageProvider } =
      await import('../../storage/cloudinary-storage.provider.js');

    const svc = new DynamicMediaService(mockConvRepo);
    expect(svc.getStorageProvider()).toBeInstanceOf(CloudinaryStorageProvider);
  });
});
