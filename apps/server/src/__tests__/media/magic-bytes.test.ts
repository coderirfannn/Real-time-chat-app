import { describe, it, expect } from 'vitest';
import { verifyBufferMagicBytes } from '../../storage/magic-bytes.js';

describe('Media Magic Bytes Inspector — Task 15 Validation', () => {
  it('1. JPEG: verifies FF D8 FF header and rejects spoofed files', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const fakeJpeg = Buffer.from('NOT_A_JPEG_FILE');

    expect(verifyBufferMagicBytes(validJpeg, 'image/jpeg')).toBe(true);
    expect(verifyBufferMagicBytes(validJpeg, 'image/jpg')).toBe(true);
    expect(verifyBufferMagicBytes(fakeJpeg, 'image/jpeg')).toBe(false);
  });

  it('2. PNG: verifies 89 50 4E 47 header and rejects spoofed files', () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x00]);

    expect(verifyBufferMagicBytes(validPng, 'image/png')).toBe(true);
    expect(verifyBufferMagicBytes(fakePng, 'image/png')).toBe(false);
  });

  it('3. PDF: verifies %PDF header and rejects spoofed files', () => {
    const validPdf = Buffer.from('%PDF-1.7 header information');
    const fakePdf = Buffer.from('Plain text file pretending to be pdf');

    expect(verifyBufferMagicBytes(validPdf, 'application/pdf')).toBe(true);
    expect(verifyBufferMagicBytes(fakePdf, 'application/pdf')).toBe(false);
  });

  it('4. GIF: verifies GIF8 header and rejects spoofed files', () => {
    const validGif = Buffer.from('GIF89a...');
    const fakeGif = Buffer.from('PNG89a...');

    expect(verifyBufferMagicBytes(validGif, 'image/gif')).toBe(true);
    expect(verifyBufferMagicBytes(fakeGif, 'image/gif')).toBe(false);
  });

  it('5. MP4 / Video: verifies ftyp container header', () => {
    const validMp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    const fakeMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x61, 0x6b, 0x65]);

    expect(verifyBufferMagicBytes(validMp4, 'video/mp4')).toBe(true);
    expect(verifyBufferMagicBytes(fakeMp4, 'video/mp4')).toBe(false);
  });

  it('6. MP3: verifies ID3 or MPEG sync bytes', () => {
    const validMp3Id3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00]);
    const validMp3Sync = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    const fakeMp3 = Buffer.from('SOME_RANDOM_DATA');

    expect(verifyBufferMagicBytes(validMp3Id3, 'audio/mpeg')).toBe(true);
    expect(verifyBufferMagicBytes(validMp3Sync, 'audio/mpeg')).toBe(true);
    expect(verifyBufferMagicBytes(fakeMp3, 'audio/mpeg')).toBe(false);
  });

  it('7. Rejects empty or null buffers', () => {
    expect(verifyBufferMagicBytes(Buffer.alloc(0), 'image/png')).toBe(false);
  });
});
