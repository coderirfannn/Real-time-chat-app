# ChatLock — Media & Cloud Storage Engine

This document details the media upload pipeline, storage providers, cryptographic HMAC upload signing, binary magic-byte inspection, and CDN delivery in **ChatLock**.

---

## 1. Storage Providers & Architecture

ChatLock implements a pluggable storage interface (`IStorageProvider`) supporting three distinct storage backends configured via `STORAGE_DRIVER`:

```
+--------------------------------------------------------------------+
|                      IStorageProvider Interface                    |
| - generateSignedUploadUrl(fileName, mimeType, sizeBytes)           |
| - uploadFile(buffer, fileName, mimeType)                           |
| - getPublicUrl(key)                                                |
| - deleteFile(key)                                                  |
+---------------------------------+----------------------------------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
+-----------------------+ +-----------------------+ +-----------------------+
|  Cloudinary Storage   | |      AWS S3 Storage   | |     Local Storage     |
| (Production Default)  | |  (Enterprise Cloud)   | |  (Dev & Unit Tests)   |
+-----------------------+ +-----------------------+ +-----------------------+
```

### 1.1 Cloudinary Cloud Storage (`CloudinaryStorageProvider`)
- Production default provider utilizing official `cloudinary` v2 SDK.
- Direct high-throughput streaming buffer uploads via `cloudinary.v2.uploader.upload_stream`.
- Automatic transformation, WEBP/AVIF dynamic optimization, and global CDN caching.
- HMAC-SHA256 signature verification for secure asset destruction and updates.

### 1.2 AWS S3 Storage (`S3StorageProvider`)
- Utilizes `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- Direct client-to-bucket pre-signed PUT uploads.

### 1.3 Local Storage (`LocalStorageProvider`)
- Stores uploaded assets on disk under `STORAGE_LOCAL_PATH`.
- Path traversal protection ensuring files remain strictly within the authorized root directory.

---

## 2. Upload Pipeline & Cryptographic Security

```
[ Client App ]                                       [ Server / MediaController ]                          [ Cloud Storage / CDN ]
      |                                                           |                                                   |
      |---- 1. POST /api/v1/media/upload-url -------------------->|                                                   |
      |     (fileName, mimeType, sizeBytes)                       |---- 2. Validate bounds (max 25MB) --------------->|
      |                                                           |---- 3. Generate HMAC SHA-256 Descriptor --------->|
      |<--- 4. Return Upload URL + Signature + Key ---------------|                                                   |
      |                                                                                                               |
      |---- 5. Direct Stream Upload (POST /api/v1/media/upload) ->|                                                   |
      |     (Multipart File Stream)                               |---- 6. Magic-Byte Binary Inspection ------------->|
      |                                                           |        [Inspect first 8K bytes of buffer]         |
      |                                                           |        [Reject MIME Spoofing]                     |
      |                                                           |---- 7. Stream Buffer to Cloudinary -------------->|
      |                                                           |<--- 8. Confirm CDN Storage & Public URL ----------|
      |<--- 9. Return Public Secure CDN URL ----------------------|                                                   |
```

---

## 3. Binary Magic-Byte Inspection

To prevent MIME-type spoofing and malicious file execution, ChatLock inspects the actual initial byte signatures (magic numbers) of uploaded files:

| Format | Magic Byte Signature (Hex) | Enforced Extensions |
| :--- | :--- | :--- |
| **JPEG** | `FF D8 FF` | `.jpg`, `.jpeg` |
| **PNG** | `89 50 4E 47 0D 0A 1A 0A` | `.png` |
| **GIF** | `47 49 46 38` (`GIF87a` / `GIF89a`) | `.gif` |
| **WEBP** | `52 49 46 46 ... 57 45 42 50` (`RIFF...WEBP`) | `.webp` |
| **PDF** | `25 50 44 46` (`%PDF`) | `.pdf` |
| **ZIP** | `50 4B 03 04` (`PK..`) | `.zip` |
| **MP4** | `.... 66 74 79 70` (`ftyp`) | `.mp4` |
| **MP3** | `49 44 33` (`ID3`) or `FF FB` | `.mp3` |
| **WAV** | `52 49 46 46 ... 57 41 56 45` (`RIFF...WAVE`) | `.wav` |

If a file claims to be an image but contains executable headers or unrecognized magic bytes, the server immediately rejects the upload with `400 BAD_REQUEST` (`INVALID_FILE_SIGNATURE`).

---

## 4. Attachment Data Model & Decoupling

Zero binary payloads are stored in MongoDB. Messages store strictly validated metadata descriptors:

```typescript
interface MessageAttachment {
  id: string;               // Attachment ID (e.g. "att_1740000000_a1b2c3d4")
  url: string;              // Secure HTTPS CDN URL
  mimeType: string;         // Verified MIME type (e.g. "image/jpeg")
  sizeBytes: number;        // File size in bytes (max: 25MB)
  fileName?: string;        // Original sanitized file name
  thumbnailUrl?: string;    // Auto-generated thumbnail URL
  width?: number;           // Image/video pixel width
  height?: number;          // Image/video pixel height
  durationMs?: number;      // Audio/video duration in milliseconds
}
```
