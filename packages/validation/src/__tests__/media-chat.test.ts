import { describe, it, expect } from 'vitest';
import { messageAttachmentSchema } from '../media.js';
import { sendMessageSchema } from '../chat.js';

describe('Media & Message Attachment Validation Tests', () => {
  it('1. Accepts valid attachment with standard att_ prefixed ID', () => {
    const payload = {
      id: 'att_1789313605652_5faf31a75909_sample.png',
      url: 'https://res.cloudinary.com/test_cloud/auto/upload/chatlock/sample.png',
      name: 'sample.png',
      size: 2048,
      mimeType: 'image/png',
      uploadStatus: 'uploaded' as const,
    };

    const result = messageAttachmentSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(payload.id);
      expect(result.data.url).toBe(payload.url);
    }
  });

  it('2. Defaults id to an att_ prefixed timestamp when omitted', () => {
    const payload = {
      url: 'https://res.cloudinary.com/test_cloud/auto/upload/chatlock/sample.png',
      name: 'sample.png',
      size: 2048,
      mimeType: 'image/png',
    };

    const result = messageAttachmentSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toMatch(/^att_\d+/);
      expect(result.data.uploadStatus).toBe('uploaded');
    }
  });

  it('3. Successfully validates sendMessageSchema with media attachments and att_ IDs', () => {
    const msgPayload = {
      conversationId: '507f1f77bcf86cd799439011',
      clientMessageId: 'client_msg_123',
      content: '',
      type: 'image' as const,
      attachments: [
        {
          id: 'att_1789313605652_photo.jpg',
          url: 'https://res.cloudinary.com/test_cloud/auto/upload/chatlock/photo.jpg',
          name: 'photo.jpg',
          size: 5120,
          mimeType: 'image/jpeg',
          uploadStatus: 'uploaded' as const,
        },
      ],
      replyToMessageId: '',
    };

    const result = sendMessageSchema.safeParse(msgPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachments).toHaveLength(1);
      expect(result.data.attachments![0]?.id).toBe('att_1789313605652_photo.jpg');
      expect(result.data.replyToMessageId).toBeUndefined();
    }
  });
});
