import { z } from 'zod';
import { idSchema } from './common.js';

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const ALLOWED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/mp4',
  'audio/m4a',
] as const;

export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_AUDIO_MIMES,
  ...ALLOWED_VIDEO_MIMES,
  ...ALLOWED_DOC_MIMES,
] as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max limit

export const messageAttachmentSchema = z.object({
  id: idSchema.optional().default(() => 'att_' + Date.now()),
  url: z.string().min(1, 'Attachment URL is required'),
  key: z.string().optional(),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES, 'File exceeds 25MB limit'),
  mimeType: z.string().min(1).max(100),
  thumbnailUrl: z.string().optional(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  uploadStatus: z.enum(['uploading', 'uploaded', 'failed']).optional().default('uploaded'),
});

export const requestUploadUrlSchema = z.object({
  conversationId: idSchema,
  filename: z.string().min(1, 'Filename is required').max(255),
  mimeType: z
    .string()
    .refine(
      (mime) => (ALL_ALLOWED_MIME_TYPES as readonly string[]).includes(mime.toLowerCase().trim()),
      {
        message:
          'Unsupported MIME type. Only images, audio, videos, and standard documents are allowed.',
      },
    ),
  size: z
    .number()
    .int()
    .positive('File size must be greater than 0')
    .max(MAX_FILE_SIZE_BYTES, 'File size exceeds maximum allowed 25MB'),
  type: z.enum(['image', 'file', 'audio', 'video']).default('image'),
});

export type MessageAttachmentInput = z.infer<typeof messageAttachmentSchema>;
export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;
