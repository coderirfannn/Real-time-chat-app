import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudinaryStorageProvider } from '../../storage/cloudinary-storage.provider.js';
import { v2 as cloudinary } from 'cloudinary';
import { BadRequestError } from '../../errors/app-error.js';

vi.mock('cloudinary', () => {
  const mockConfig = vi.fn();
  const mockUploadStream = vi.fn();
  const mockDestroy = vi.fn();

  return {
    v2: {
      config: mockConfig,
      uploader: {
        upload_stream: mockUploadStream,
        destroy: mockDestroy,
      },
    },
  };
});

describe('CloudinaryStorageProvider Unit Tests', () => {
  let provider: CloudinaryStorageProvider;
  const cloudName = 'test_cloud';
  const apiKey = 'mock_cloudinary_api_key';
  const apiSecret = 'mock_cloudinary_api_secret_32_chars';
  const baseUrl = 'http://localhost:5000';

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new CloudinaryStorageProvider(cloudName, apiKey, apiSecret, baseUrl);
  });

  it('1. Initializes Cloudinary configuration with provided credentials', () => {
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  });

  it('2. Generates signed upload URL descriptor with valid token and expiration', async () => {
    const descriptor = await provider.generateSignedUploadUrl({
      fileKey: 'attachments/conv_123/image.png',
      mimeType: 'image/png',
      size: 1024,
      expiresInSeconds: 900,
    });

    expect(descriptor.fileKey).toBe('attachments/conv_123/image.png');
    expect(descriptor.method).toBe('PUT');
    expect(descriptor.headers?.['Content-Type']).toBe('image/png');
    expect(descriptor.uploadUrl).toContain(
      `${baseUrl}/api/v1/media/upload/attachments%2Fconv_123%2Fimage.png`,
    );
    expect(descriptor.uploadUrl).toContain('signature=');
    expect(descriptor.uploadUrl).toContain('expires=');
    expect(descriptor.fileUrl).toContain(
      'https://res.cloudinary.com/test_cloud/auto/upload/chatlock/attachments/conv_123/image.png',
    );
    expect(descriptor.token).toBeDefined();
    expect(new Date(descriptor.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('3. Formats public CDN URLs correctly', () => {
    const url = provider.getPublicUrl('attachments/conv_456/photo.jpg');
    expect(url).toBe(
      'https://res.cloudinary.com/test_cloud/auto/upload/chatlock/attachments/conv_456/photo.jpg',
    );

    const absoluteUrl = 'https://res.cloudinary.com/test_cloud/image/upload/v1234/test.png';
    expect(provider.getPublicUrl(absoluteUrl)).toBe(absoluteUrl);
  });

  it('4. Cryptographically verifies valid and invalid upload signatures', async () => {
    const descriptor = await provider.generateSignedUploadUrl({
      fileKey: 'attachments/conv_1/doc.pdf',
      mimeType: 'application/pdf',
      size: 2048,
      expiresInSeconds: 300,
    });

    const expires = new Date(descriptor.expiresAt).getTime();
    const signature = descriptor.token!;

    // Valid signature
    expect(provider.verifyUploadSignature('attachments/conv_1/doc.pdf', signature, expires)).toBe(
      true,
    );

    // Tampered file key
    expect(
      provider.verifyUploadSignature('attachments/conv_tampered/doc.pdf', signature, expires),
    ).toBe(false);

    // Tampered signature
    expect(
      provider.verifyUploadSignature('attachments/conv_1/doc.pdf', signature + 'tamper', expires),
    ).toBe(false);

    // Expired timestamp
    const expiredTimestamp = Date.now() - 1000;
    expect(
      provider.verifyUploadSignature('attachments/conv_1/doc.pdf', signature, expiredTimestamp),
    ).toBe(false);
  });

  it('5. Rejects saveBuffer when magic bytes do not match declared MIME type', async () => {
    // Declared as PNG, but buffer content is plain text / invalid magic bytes
    const invalidBuffer = Buffer.from('this is not a valid png file payload');

    await expect(
      provider.saveBuffer('attachments/conv_1/fake.png', invalidBuffer, 'image/png'),
    ).rejects.toThrow(BadRequestError);
  });

  it('6. Streams valid buffer to Cloudinary uploader and returns result', async () => {
    // Valid PNG magic bytes
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    const mockSecureUrl =
      'https://res.cloudinary.com/test_cloud/image/upload/v12345/chatlock/attachments/conv_1/valid.png';

    vi.mocked(cloudinary.uploader.upload_stream).mockImplementation(((...args: unknown[]) => {
      const options = (typeof args[0] === 'object' && args[0] !== null ? args[0] : {}) as Record<
        string,
        unknown
      >;
      const callback = (typeof args[0] === 'function' ? args[0] : args[1]) as
        ((err: unknown, result: unknown) => void) | undefined;

      const stream = {
        end: (buf: Buffer) => {
          if (callback) {
            callback(undefined, {
              public_id: options.public_id as string,
              secure_url: mockSecureUrl,
              bytes: buf.length,
            });
          }
        },
      };
      return stream;
    }) as never);

    const result = await provider.saveBuffer(
      'attachments/conv_1/valid.png',
      pngBuffer,
      'image/png',
    );

    expect(result.fileUrl).toBe(mockSecureUrl);
    expect(result.size).toBe(pngBuffer.length);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        public_id: 'chatlock/attachments/conv_1/valid',
        resource_type: 'auto',
        overwrite: true,
      }),
      expect.any(Function),
    );
  });

  it('7. Invokes Cloudinary destroy when deleting a file', async () => {
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' });

    await provider.deleteFile('attachments/conv_1/to_delete.png');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'chatlock/attachments/conv_1/to_delete',
      {
        resource_type: 'auto',
        invalidate: true,
      },
    );
  });
});
