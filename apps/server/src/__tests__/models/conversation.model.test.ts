import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { ConversationModel } from '../../models/conversation.model.js';

describe('Conversation Model Schema & Validation', () => {
  const user1 = new Types.ObjectId();
  const user2 = new Types.ObjectId();

  it('generates consistent deterministic directKey for any participant order', () => {
    const key1 = ConversationModel.generateDirectKey(user1, user2);
    const key2 = ConversationModel.generateDirectKey(user2, user1);
    expect(key1).toBe(key2);
  });

  it('validates a correct direct conversation document', () => {
    const directKey = ConversationModel.generateDirectKey(user1, user2);
    const conversation = new ConversationModel({
      type: 'direct',
      participants: [user1, user2],
      directKey,
    });

    const error = conversation.validateSync();
    expect(error).toBeUndefined();
    expect(conversation.type).toBe('direct');
    expect(conversation.isArchived).toBe(false);
  });

  it('validates a correct group conversation document', () => {
    const user3 = new Types.ObjectId();
    const conversation = new ConversationModel({
      type: 'group',
      title: 'Engineering Team',
      creatorId: user1,
      participants: [user1, user2, user3],
      admins: [user1],
    });

    const error = conversation.validateSync();
    expect(error).toBeUndefined();
    expect(conversation.type).toBe('group');
    expect(conversation.title).toBe('Engineering Team');
    expect(conversation.directKey).toBeUndefined();
  });
});
