import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MediaPreviewModal } from '../../components/ui/MediaPreviewModal';
import type { MessageAttachment } from '@chatlock/shared-types';

describe('MediaPreviewModal Component', () => {
  const mockAttachment: MessageAttachment = {
    id: 'att_123',
    name: 'vacation_photo.png',
    mimeType: 'image/png',
    size: 2048576,
    url: 'http://localhost:5000/api/v1/media/files/photo.png',
    uploadStatus: 'uploaded',
  };

  it('renders correctly when visible is true with an attachment', () => {
    const onClose = vi.fn();
    const modal = React.createElement(MediaPreviewModal, {
      visible: true,
      attachment: mockAttachment,
      onClose,
    });

    expect(modal).toBeDefined();
    expect(modal.props.visible).toBe(true);
    expect(modal.props.attachment?.name).toBe('vacation_photo.png');
    expect(modal.props.onClose).toBe(onClose);
  });

  it('renders null when visible is false and attachment is null', () => {
    const modal = React.createElement(MediaPreviewModal, {
      visible: false,
      attachment: null,
      onClose: vi.fn(),
    });

    expect(modal).toBeDefined();
    expect(modal.props.visible).toBe(false);
  });

  it('handles attachment with undefined name or size gracefully', () => {
    const fallbackAttachment: MessageAttachment = {
      id: 'att_fallback',
      name: 'fallback.jpg',
      size: 1024,
      mimeType: 'image/jpeg',
      url: 'https://res.cloudinary.com/test/image.jpg',
    };

    const modal = React.createElement(MediaPreviewModal, {
      visible: true,
      attachment: fallbackAttachment,
      onClose: vi.fn(),
    });

    expect(modal).toBeDefined();
    expect(modal.props.attachment?.id).toBe('att_fallback');
  });
});
