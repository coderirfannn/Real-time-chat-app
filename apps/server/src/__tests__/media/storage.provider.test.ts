import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LocalStorageProvider } from '../../storage/local-storage.provider.js';

describe('LocalStorageProvider — Task 15 Unit Tests', () => {
  const testUploadDir = path.join(os.tmpdir(), 'chatlock_test_uploads_' + Date.now());
  let provider: LocalStorageProvider;

  beforeEach(() => {
    provider = new LocalStorageProvider(
      testUploadDir,
      'http://localhost:5000',
      'test_secret_32_chars_minimum_123456',
    );
  });

  afterEach(async () => {
    if (fs.existsSync(testUploadDir)) {
      await fs.promises.rm(testUploadDir, { recursive: true, force: true });
    }
  });

  it('1. Generates valid signed upload URL and signature verification passes', async () => {
    const descriptor = await provider.generateSignedUploadUrl({
      fileKey: 'attachments/conv_123/img.png',
      mimeType: 'image/png',
      size: 1024,
      expiresInSeconds: 60,
    });

    expect(descriptor.uploadUrl).toContain('signature=');
    expect(descriptor.uploadUrl).toContain('expires=');
    expect(descriptor.fileUrl).toContain('/api/v1/media/files/attachments');

    // Extract signature and expires from uploadUrl
    const url = new URL(descriptor.uploadUrl);
    const sig = url.searchParams.get('signature')!;
    const exp = Number(url.searchParams.get('expires'));

    expect(provider.verifyUploadSignature('attachments/conv_123/img.png', sig, exp)).toBe(true);
  });

  it('2. Rejects tampered or expired signatures', async () => {
    const descriptor = await provider.generateSignedUploadUrl({
      fileKey: 'attachments/conv_123/img.png',
      mimeType: 'image/png',
      size: 1024,
      expiresInSeconds: 60,
    });

    const url = new URL(descriptor.uploadUrl);
    const sig = url.searchParams.get('signature')!;
    const exp = Number(url.searchParams.get('expires'));

    // Tampered file key
    expect(provider.verifyUploadSignature('attachments/conv_123/other.png', sig, exp)).toBe(false);

    // Tampered signature
    expect(
      provider.verifyUploadSignature('attachments/conv_123/img.png', 'tampered_sig_hex', exp),
    ).toBe(false);

    // Expired timestamp
    expect(
      provider.verifyUploadSignature('attachments/conv_123/img.png', sig, Date.now() - 1000),
    ).toBe(false);
  });

  it('3. Saves valid binary buffer to disk and rejects spoofed mime payload', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    const result = await provider.saveBuffer('attachments/test/photo.png', validPng, 'image/png');
    expect(result.size).toBe(validPng.length);
    expect(result.fileUrl).toContain('photo.png');

    const fakePng = Buffer.from('NOT_A_PNG');
    await expect(
      provider.saveBuffer('attachments/test/fake.png', fakePng, 'image/png'),
    ).rejects.toThrow(/does not match declared MIME type/);
  });

  it('4. Throws error on path traversal attempt', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(provider.saveBuffer('../../etc/passwd', validPng, 'image/png')).rejects.toThrow(
      /path traversal detected/,
    );
  });
});
