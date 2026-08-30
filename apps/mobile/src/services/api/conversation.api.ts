import { apiClient } from './client.js';
import type {
  CreateDirectConversationInput,
  ConversationPaginationInput,
} from '@chatlock/validation';
import type { IConversation } from '@chatlock/shared-types';

export class ConversationApi {
  public async getConversations(params?: ConversationPaginationInput): Promise<IConversation[]> {
    return apiClient.get<IConversation[]>('/conversations', { params });
  }

  public async getConversationById(id: string): Promise<IConversation> {
    return apiClient.get<IConversation>(`/conversations/${id}`);
  }

  public async createDirectConversation(
    input: CreateDirectConversationInput,
  ): Promise<IConversation> {
    return apiClient.post<IConversation>('/conversations', input);
  }
}

export const conversationApi = new ConversationApi();
