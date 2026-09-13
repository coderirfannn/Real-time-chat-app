import { apiClient } from './client';
import type {
  CreateDirectConversationInput,
  ConversationPaginationInput,
  MessageCursorPaginationInput,
} from '@chatlock/validation';
import type { IConversation, IMessage, CursorPaginatedResult } from '@chatlock/shared-types';

export class ConversationApi {
  public async getConversations(params?: ConversationPaginationInput): Promise<IConversation[]> {
    return apiClient.get<IConversation[]>('/conversations', { params });
  }

  public async getConversationById(id: string): Promise<IConversation> {
    return apiClient.get<IConversation>(`/conversations/${id}`);
  }

  public async createDirectConversation(
    recipientOrInput: string | CreateDirectConversationInput,
  ): Promise<IConversation> {
    const payload =
      typeof recipientOrInput === 'string'
        ? { recipientId: recipientOrInput, type: 'direct' as const }
        : recipientOrInput;
    return apiClient.post<IConversation>('/conversations', payload);
  }

  public async getMessages(
    conversationId: string,
    params?: MessageCursorPaginationInput,
  ): Promise<CursorPaginatedResult<IMessage>> {
    return apiClient.get<CursorPaginatedResult<IMessage>>(
      `/conversations/${conversationId}/messages`,
      { params },
    );
  }

  public async markAsRead(conversationId: string): Promise<{ markedCount: number }> {
    return apiClient.post<{ markedCount: number }>(`/conversations/${conversationId}/read`, {});
  }
}

export const conversationApi = new ConversationApi();
