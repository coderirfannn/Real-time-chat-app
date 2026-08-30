import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { MessageModel } from '../../models/message.model.js';

describe('Message Model Schema & Validation', () => {
  const conversationId = new Types.ObjectId();
  const senderId = new Types.ObjectId();

  it('validates a correct text message document', () => {
    const message = new MessageModel({
      conversationId,
      senderId,
      clientMessageId: 'msg-client-uuid-001',
      type: 'text',
      content: 'Hello World',
    });

    const error = message.validateSync();
    expect(error).toBeUndefined();
    expect(message.type).toBe('text');
    expect(message.editedAt).toBeNull();
    expect(message.deletedAt).toBeNull();
  });

  it('validates a message with attachments', () => {
    const message = new MessageModel({
      conversationId,
      senderId,
      clientMessageId: 'msg-client-uuid-002',
      type: 'image',
      content: 'Check this image',
      attachments: [
        {
          id: 'att-01',
          url: 'https://cdn.chatlock.app/img.jpg',
          name: 'photo.jpg',
          size: 102400,
          mimeType: 'image/jpeg',
        },
      ],
    });

    const error = message.validateSync();
    expect(error).toBeUndefined();
    expect(message.attachments?.length).toBe(1);
    expect(message.attachments?.[0]?.name).toBe('photo.jpg');
  });

  it('fails validation when content exceeds max length', () => {
    const hugeContent = 'a'.repeat(5001);
    const message = new MessageModel({
      conversationId,
      senderId,
      clientMessageId: 'msg-003',
      type: 'text',
      content: hugeContent,
    });

    const error = message.validateSync();
    expect(error?.errors['content']).toBeDefined();
  });
});
