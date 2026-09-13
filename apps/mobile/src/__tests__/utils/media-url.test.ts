import { describe, it, expect } from 'vitest';
import { resolveMediaUrl } from '../../utils/media-url';
import { mobileConfig } from '../../config/env';

describe('resolveMediaUrl', () => {
  it('returns empty string for null, undefined, or empty string', () => {
    expect(resolveMediaUrl(null)).toBe('');
    expect(resolveMediaUrl(undefined)).toBe('');
    expect(resolveMediaUrl('')).toBe('');
    expect(resolveMediaUrl('   ')).toBe('');
  });

  it('preserves file://, blob:, and data: URIs', () => {
    expect(resolveMediaUrl('file:///data/user/0/com.chatlock/cache/pic.jpg')).toBe(
      'file:///data/user/0/com.chatlock/cache/pic.jpg',
    );
    expect(resolveMediaUrl('blob:http://localhost:8081/uuid-1234')).toBe(
      'blob:http://localhost:8081/uuid-1234',
    );
    expect(resolveMediaUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('preserves external CDN URLs untouched (Cloudinary, S3, etc.)', () => {
    const cloudinaryUrl =
      'https://res.cloudinary.com/chatlock/image/upload/v12345/chatlock/conv1/photo.jpg';
    expect(resolveMediaUrl(cloudinaryUrl)).toBe(cloudinaryUrl);

    const s3Url = 'https://s3.amazonaws.com/mybucket/image.png';
    expect(resolveMediaUrl(s3Url)).toBe(s3Url);
  });

  it('resolves relative URLs to the active API origin', () => {
    const apiOrigin = mobileConfig.apiUrl.replace(/\/api\/v1\/?$/, '');
    expect(resolveMediaUrl('/api/v1/media/files/photo.png')).toBe(
      `${apiOrigin}/api/v1/media/files/photo.png`,
    );
  });

  it('rewrites localhost and 127.0.0.1 to the active API origin', () => {
    const apiOrigin = mobileConfig.apiUrl.replace(/\/api\/v1\/?$/, '');

    const localhostUrl = 'http://localhost:5000/api/v1/media/files/conv_1%2Ftest.png';
    expect(resolveMediaUrl(localhostUrl)).toBe(`${apiOrigin}/api/v1/media/files/conv_1%2Ftest.png`);

    const loopbackUrl = 'http://127.0.0.1:5000/api/v1/media/files/conv_1%2Ftest.png';
    expect(resolveMediaUrl(loopbackUrl)).toBe(`${apiOrigin}/api/v1/media/files/conv_1%2Ftest.png`);

    const queryUrl = 'http://localhost:5000/api/v1/media/files/pic.jpg?token=xyz123';
    expect(resolveMediaUrl(queryUrl)).toBe(`${apiOrigin}/api/v1/media/files/pic.jpg?token=xyz123`);
  });
});
