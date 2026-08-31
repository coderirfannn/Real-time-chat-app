/**
 * Inspects a binary buffer header to verify that its actual magic bytes
 * match the declared MIME type. Rejects spoofed or malicious file payloads.
 */
export function verifyBufferMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  const mime = declaredMime.toLowerCase().trim();

  // 1. JPEG: FF D8 FF
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // 3. GIF: GIF87a or GIF89a (47 49 46 38)
  if (mime === 'image/gif') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    );
  }

  // 4. WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x41 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  // 5. PDF: %PDF (25 50 44 46)
  if (mime === 'application/pdf') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // 6. ZIP & Office OpenXML documents (PK.. 50 4B 03 04 or 50 4B 05 06)
  if (
    mime === 'application/zip' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword'
  ) {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    );
  }

  // 7. MP4 / M4A / MOV: ftyp box at byte 4-7 (66 74 79 70) or moov (6D 6F 6F 76)
  if (
    mime === 'video/mp4' ||
    mime === 'audio/mp4' ||
    mime === 'audio/m4a' ||
    mime === 'video/quicktime'
  ) {
    if (buffer.length >= 8) {
      const isFtyp =
        buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
      const isMoov =
        buffer[4] === 0x6d && buffer[5] === 0x6f && buffer[6] === 0x6f && buffer[7] === 0x76;
      return Boolean(isFtyp || isMoov);
    }
    return false;
  }

  // 8. WEBM: 1A 45 DF A3 (Matroska / EBML)
  if (mime === 'video/webm') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }

  // 9. MP3: ID3 (49 44 33) or MPEG sync word (FF FB, FF F3, FF F2)
  if (mime === 'audio/mpeg') {
    if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return true;
    }
    const b0 = buffer[0];
    const b1 = buffer[1];
    if (buffer.length >= 2 && b0 === 0xff && b1 !== undefined && (b1 & 0xe0) === 0xe0) {
      return true;
    }
    return false;
  }

  // 10. OGG: OggS (4F 67 67 53)
  if (mime === 'audio/ogg') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x4f &&
      buffer[1] === 0x67 &&
      buffer[2] === 0x67 &&
      buffer[3] === 0x53
    );
  }

  // 11. WAV: RIFF....WAVE
  if (mime === 'audio/wav') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x41 &&
      buffer[10] === 0x56 &&
      buffer[11] === 0x45
    );
  }

  // 12. Plain text
  if (mime === 'text/plain') {
    // Check first 512 bytes for NULL bytes (binary detector)
    const checkLength = Math.min(buffer.length, 512);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return false;
      }
    }
    return true;
  }

  // Default fallback: allow if buffer has contents
  return buffer.length > 0;
}
