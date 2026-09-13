import { mobileConfig } from '../config/env';

/**
 * Resolves a media attachment URL to ensure it points to the reachable host
 * from the current device or client runtime.
 *
 * If a URL contains localhost or 127.0.0.1 (common when uploads originate from
 * a desktop browser pointing at a local server), it rewrites the origin to
 * match mobileConfig.apiUrl's origin (e.g., http://192.168.0.112:5000).
 * Relative URLs (e.g., /api/v1/media/files/...) are also prefixed with the active origin.
 * Cloud-hosted URLs (e.g., Cloudinary, S3) and local device URIs (file://, blob:, data:)
 * are returned unchanged.
 */
export function resolveMediaUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  // Preserve local device URIs, blobs, and base64 data URIs
  if (trimmed.startsWith('file://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  try {
    // Derive the base origin from mobileConfig.apiUrl (e.g. "http://192.168.1.5:5000")
    const apiOrigin = (mobileConfig?.apiUrl || 'http://localhost:5000/api/v1').replace(
      /\/api\/v1\/?$/,
      '',
    );

    // Relative path (e.g., "/api/v1/media/files/...")
    if (trimmed.startsWith('/')) {
      return `${apiOrigin}${trimmed}`;
    }

    // Check if the URL points to localhost or 127.0.0.1
    const localhostRegex = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)?$/i;
    const match = trimmed.match(localhostRegex);
    if (match) {
      const pathAndQuery = match[1] || '';
      return `${apiOrigin}${pathAndQuery}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
