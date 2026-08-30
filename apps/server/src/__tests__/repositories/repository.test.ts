import { describe, it, expect } from 'vitest';
import {
  userRepository,
  sessionRepository,
  conversationRepository,
  messageRepository,
  messageReceiptRepository,
  deviceRepository,
} from '../../repositories/index.js';

describe('Repository Layer Instances', () => {
  it('instantiates all decoupled repositories', () => {
    expect(userRepository).toBeDefined();
    expect(sessionRepository).toBeDefined();
    expect(conversationRepository).toBeDefined();
    expect(messageRepository).toBeDefined();
    expect(messageReceiptRepository).toBeDefined();
    expect(deviceRepository).toBeDefined();
  });

  it('exposes standard CRUD signatures on BaseRepository', () => {
    expect(typeof userRepository.findById).toBe('function');
    expect(typeof userRepository.findOne).toBe('function');
    expect(typeof userRepository.create).toBe('function');
    expect(typeof userRepository.updateById).toBe('function');
    expect(typeof userRepository.deleteById).toBe('function');
    expect(typeof userRepository.paginate).toBe('function');
  });

  it('exposes specialized domain methods on repositories', () => {
    expect(typeof userRepository.findByEmail).toBe('function');
    expect(typeof sessionRepository.findByTokenHash).toBe('function');
    expect(typeof conversationRepository.findDirectConversation).toBe('function');
    expect(typeof messageRepository.findByClientMessageId).toBe('function');
    expect(typeof messageReceiptRepository.upsertReceipt).toBe('function');
    expect(typeof deviceRepository.upsertDevice).toBe('function');
  });
});
