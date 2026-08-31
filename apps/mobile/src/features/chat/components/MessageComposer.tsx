import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import {
  mediaUploadService,
  type LocalMediaFile,
} from '../../../services/media/media-upload.service';
import type { MessageAttachment } from '@chatlock/shared-types';

export interface MessageComposerProps {
  conversationId?: string;
  onSendMessage: (content: string, attachments?: MessageAttachment[]) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

interface StagedAttachment {
  id: string;
  file: LocalMediaFile;
  status: 'uploading' | 'uploaded' | 'failed';
  attachment?: MessageAttachment;
  error?: string;
}

export function MessageComposer({
  conversationId = '',
  onSendMessage,
  onTypingStart,
  onTypingStop,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageComposerProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<{ click: () => void; value?: string } | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const clearTypingTimer = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const stopTyping = useCallback(() => {
    clearTypingTimer();
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
  }, [clearTypingTimer, onTypingStop]);

  const handleChangeText = useCallback(
    (newText: string) => {
      setText(newText);

      if (disabled) return;

      const trimmed = newText.trim();
      if (trimmed.length > 0) {
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          onTypingStart?.();
        }

        clearTypingTimer();
        typingTimerRef.current = setTimeout(() => {
          stopTyping();
        }, 3000);
      } else {
        stopTyping();
      }
    },
    [disabled, onTypingStart, stopTyping, clearTypingTimer],
  );

  useEffect(() => {
    return () => {
      clearTypingTimer();
    };
  }, [clearTypingTimer]);

  const handlePickFile = useCallback(() => {
    if (Platform.OS === 'web') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  }, []);

  const handleFileSelected = useCallback(
    async (event: {
      target?: { files?: ArrayLike<{ name: string; type: string; size: number }> };
    }) => {
      const files = event?.target?.files;
      if (!files || files.length === 0 || !conversationId) return;

      const file = files[0];
      if (!file) return;

      const localFile: LocalMediaFile = {
        uri:
          typeof URL !== 'undefined' && URL.createObjectURL
            ? URL.createObjectURL(file as never)
            : '',
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        blob: file as never,
      };

      const stagedId = 'staged_' + Date.now();
      const newStaged: StagedAttachment = {
        id: stagedId,
        file: localFile,
        status: 'uploading',
      };

      setStagedFiles((prev) => [...prev, newStaged]);
      setIsUploading(true);

      try {
        const uploaded = await mediaUploadService.uploadAttachment(conversationId, localFile);
        setStagedFiles((prev) =>
          prev.map((item) =>
            item.id === stagedId ? { ...item, status: 'uploaded', attachment: uploaded } : item,
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setStagedFiles((prev) =>
          prev.map((item) =>
            item.id === stagedId ? { ...item, status: 'failed', error: msg } : item,
          ),
        );
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [conversationId],
  );

  const handleRemoveStaged = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const uploadedAttachments = stagedFiles
    .filter((f) => f.status === 'uploaded' && f.attachment)
    .map((f) => f.attachment!);

  const canSend =
    (text.trim().length > 0 || uploadedAttachments.length > 0) && !disabled && !isUploading;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && uploadedAttachments.length === 0) || disabled || isUploading) return;

    stopTyping();
    onSendMessage(trimmed, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);
    setText('');
    setStagedFiles([]);
  }, [text, uploadedAttachments, disabled, isUploading, onSendMessage, stopTyping]);

  return (
    <View style={styles.container}>
      {/* Hidden File Input for Web */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as never}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.zip,.txt"
          style={{ display: 'none' }}
          onChange={handleFileSelected as never}
        />
      )}

      {/* Staged Attachments Preview Ribbon */}
      {stagedFiles.length > 0 && (
        <ScrollView
          horizontal
          style={styles.attachmentsRibbon}
          contentContainerStyle={styles.attachmentsContent}
          showsHorizontalScrollIndicator={false}
        >
          {stagedFiles.map((item) => {
            const isImage = item.file.mimeType.startsWith('image/');
            return (
              <View
                key={item.id}
                style={[
                  styles.stagedCard,
                  item.status === 'failed' ? styles.stagedCardFailed : null,
                ]}
              >
                {isImage ? (
                  <Image source={{ uri: item.file.uri }} style={styles.stagedThumbnail} />
                ) : (
                  <View style={styles.stagedFileIcon}>
                    <Text style={styles.fileIconText}>📄</Text>
                  </View>
                )}

                <View style={styles.stagedDetails}>
                  <Text style={styles.stagedFileName} numberOfLines={1}>
                    {item.file.name}
                  </Text>
                  <Text style={styles.stagedFileSize}>
                    {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                  </Text>
                </View>

                {item.status === 'uploading' && (
                  <ActivityIndicator size="small" color="#38BDF8" style={styles.stageIndicator} />
                )}

                {item.status === 'failed' && <Text style={styles.failedBadge}>⚠️</Text>}

                <TouchableOpacity
                  onPress={() => handleRemoveStaged(item.id)}
                  style={styles.removeStagedButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeStagedText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.composerRow}>
        {/* Attachment Picker Button */}
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handlePickFile}
          disabled={disabled || isUploading}
          activeOpacity={0.7}
        >
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#64748B"
            value={text}
            onChangeText={handleChangeText}
            multiline
            maxLength={4000}
            editable={!disabled}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendButton, canSend ? styles.sendButtonActive : styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.sendText, canSend ? styles.sendTextActive : styles.sendTextDisabled]}
          >
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingVertical: 8,
  },
  attachmentsRibbon: {
    paddingHorizontal: 12,
    marginBottom: 8,
    maxHeight: 60,
  },
  attachmentsContent: {
    gap: 8,
    alignItems: 'center',
  },
  stagedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 180,
    gap: 6,
  },
  stagedCardFailed: {
    borderColor: '#EF4444',
  },
  stagedThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  stagedFileIcon: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconText: {
    fontSize: 16,
  },
  stagedDetails: {
    flex: 1,
  },
  stagedFileName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stagedFileSize: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  stageIndicator: {
    marginHorizontal: 4,
  },
  failedBadge: {
    fontSize: 12,
  },
  removeStagedButton: {
    padding: 4,
  },
  removeStagedText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    gap: 8,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  attachIcon: {
    fontSize: 18,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 120,
  },
  input: {
    color: '#F8FAFC',
    fontSize: 15,
    minHeight: 24,
    maxHeight: 110,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: '#0284C7',
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
  },
  sendText: {
    fontSize: 18,
    fontWeight: '700',
  },
  sendTextActive: {
    color: '#FFFFFF',
  },
  sendTextDisabled: {
    color: '#64748B',
  },
});
