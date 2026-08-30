import type { Request, Response } from 'express';
import type { ApiResponse } from '@chatlock/shared-types';
import type {
  CreateDirectConversationInput,
  ConversationPaginationInput,
  ConversationIdParamsInput,
} from '@chatlock/validation';
import {
  conversationService,
  type ConversationService,
  type ConversationDetailResponse,
} from '../services/conversation.service.js';
import type { PaginatedConversations } from '../repositories/conversation.repository.js';
import { BadRequestError, UnauthorizedError } from '../errors/app-error.js';

export class ConversationController {
  constructor(private readonly service: ConversationService = conversationService) {}

  public listConversations = async (
    req: Request<unknown, unknown, unknown, ConversationPaginationInput>,
    res: Response<ApiResponse<PaginatedConversations<Record<string, unknown>>>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { page, limit, cursor } = req.query;

    const result = await this.service.getUserConversations(req.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      cursor: cursor ? String(cursor) : undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Conversations retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public createConversation = async (
    req: Request<unknown, unknown, CreateDirectConversationInput>,
    res: Response<ApiResponse<ConversationDetailResponse>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const targetRecipientId =
      req.body.recipientId ||
      req.body.participantId ||
      (req.body.participantIds && req.body.participantIds.length > 0
        ? req.body.participantIds[0]
        : undefined);

    if (!targetRecipientId) {
      throw new BadRequestError('Recipient ID is required to start a direct conversation');
    }

    const result = await this.service.getOrCreateDirectConversation(req.user.id, targetRecipientId);

    const statusCode = result.isNew ? 201 : 200;
    const message = result.isNew
      ? 'Direct conversation created successfully'
      : 'Existing direct conversation retrieved';

    res.status(statusCode).json({
      success: true,
      message,
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public getConversation = async (
    req: Request<ConversationIdParamsInput>,
    res: Response<ApiResponse<ConversationDetailResponse>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await this.service.getConversationById(req.params.id, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };

  public listMessages = async (
    req: Request<ConversationIdParamsInput, unknown, unknown, ConversationPaginationInput>,
    res: Response<ApiResponse<unknown>>,
  ): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { page, limit } = req.query;

    const result = await this.service.getConversationMessages(req.params.id, req.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });

    res.status(200).json({
      success: true,
      message: 'Messages retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  };
}

export const conversationController = new ConversationController();
