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
  useWindowDimensions,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  mediaUploadService,
  type LocalMediaFile,
} from '../../../services/media/media-upload.service';
import type { MessageAttachment } from '@chatlock/shared-types';
import type { LocalMessage } from '../../../types/chat.types';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../../../components/ui/Icon';

if (Platform.OS === 'android' && UIManager?.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // safe fallback
  }
}

export const COMPOSER_EMOJIS = [
  '😊',
  '😂',
  '😍',
  '👍',
  '🔥',
  '🎉',
  '❤️',
  '🙏',
  '✨',
  '🚀',
  '💯',
  '😎',
  '👀',
  '💪',
  '🤝',
  '👋',
];

export interface MessageComposerProps {
  conversationId?: string;
  onSendMessage: (
    content: string,
    attachments?: MessageAttachment[],
    replyToMessageId?: string,
  ) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyingTo?: LocalMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  onFocus?: () => void;
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
  replyingTo,
  onCancelReply,
  disabled = false,
  placeholder,
  onFocus,
}: MessageComposerProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 380;
  const bottomPadding = Math.max(insets.bottom, 8);

  const defaultPlaceholder =
    Platform.OS === 'web' && windowWidth > 500 ? 'Type a message... (Enter to send)' : 'Message...';
  const effectivePlaceholder = placeholder || defaultPlaceholder;

  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(38);
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiDrawer, setShowEmojiDrawer] = useState(false);

  const textInputRef = useRef<TextInput | null>(null);
  const fileInputRef = useRef<{ click: () => void; value?: string } | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const sendScaleAnim = useRef(new Animated.Value(1)).current;

  const triggerLayoutAnimation = useCallback(() => {
    if (
      Platform.OS !== 'web' &&
      typeof LayoutAnimation !== 'undefined' &&
      LayoutAnimation?.configureNext
    ) {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {
        // Safe fallback in test or headless environments
      }
    }
  }, []);

  const handleContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const raw = e?.nativeEvent?.contentSize?.height;
      if (raw && raw > 0) {
        const clamped = Math.min(Math.max(38, Math.round(raw)), 120);
        if (clamped !== inputHeight) {
          triggerLayoutAnimation();
          setInputHeight(clamped);
        }
      }
    },
    [inputHeight, triggerLayoutAnimation],
  );

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
      if (newText === '' && inputHeight !== 38) {
        triggerLayoutAnimation();
        setInputHeight(38);
      }

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
    [disabled, onTypingStart, stopTyping, clearTypingTimer, inputHeight, triggerLayoutAnimation],
  );

  useEffect(() => {
    return () => {
      clearTypingTimer();
    };
  }, [clearTypingTimer]);

  const handlePickFile = useCallback(async () => {
    if (!conversationId) return;

    if (Platform.OS === 'web') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (!asset) return;

        const filename = asset.fileName || `photo_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        const localFile: LocalMediaFile = {
          uri: asset.uri,
          name: filename,
          mimeType,
          size: asset.fileSize || 1024 * 50,
          width: asset.width,
          height: asset.height,
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
        }
      }
    } catch (err) {
      console.warn('[MessageComposer] Native image picker error:', err);
    }
  }, [conversationId]);

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

  const handleRemoveStaged = useCallback(
    (id: string) => {
      triggerLayoutAnimation();
      setStagedFiles((prev) => prev.filter((item) => item.id !== id));
    },
    [triggerLayoutAnimation],
  );

  const handleToggleEmojiDrawer = useCallback(() => {
    triggerLayoutAnimation();
    setShowEmojiDrawer((prev) => !prev);
  }, [triggerLayoutAnimation]);

  const handleInsertEmoji = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    textInputRef.current?.focus();
  }, []);

  const uploadedAttachments = stagedFiles
    .filter((f) => f.status === 'uploaded' && f.attachment)
    .map((f) => f.attachment!);

  const canSend =
    (text.trim().length > 0 || uploadedAttachments.length > 0) && !disabled && !isUploading;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if ((!trimmed && uploadedAttachments.length === 0) || disabled || isUploading) return;

    // Instant tactile spring feedback on mobile
    Animated.sequence([
      Animated.timing(sendScaleAnim, {
        toValue: 0.82,
        duration: 60,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(sendScaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    stopTyping();
    onSendMessage(
      trimmed,
      uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      replyingTo?.id,
    );

    // Only trigger layout animation if collapsible bars (attachments/reply/emoji drawer) were open
    // Avoid triggering full layout transitions on normal text sends to prevent native keyboard flickers
    const hadCollapsibleBanners = stagedFiles.length > 0 || Boolean(replyingTo) || showEmojiDrawer;
    if (hadCollapsibleBanners) {
      triggerLayoutAnimation();
    }

    setText('');
    setInputHeight(38);
    setStagedFiles([]);
    setShowEmojiDrawer(false);
    onCancelReply?.();

    // Continuously preserve keyboard focus across consecutive messages
    // Immediate call prevents native unfocus; next tick and delayed fallbacks catch microtasks
    textInputRef.current?.focus();
    requestAnimationFrame(() => {
      textInputRef.current?.focus();
    });
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  }, [
    text,
    uploadedAttachments,
    disabled,
    isUploading,
    onSendMessage,
    replyingTo,
    showEmojiDrawer,
    stagedFiles.length,
    onCancelReply,
    stopTyping,
    triggerLayoutAnimation,
    sendScaleAnim,
  ]);

  // Prevent button from stealing focus from text input
  const handleSendPressIn = useCallback(() => {
    textInputRef.current?.focus();
  }, []);

  // Handle Enter key on Web to send without Shift
  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
      const native = e.nativeEvent as { key: string; shiftKey?: boolean };
      if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
        e.preventDefault?.();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
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

      {/* Quoted Reply Banner */}
      {Boolean(replyingTo) && (
        <View style={styles.replyBanner}>
          <View style={styles.replyBannerContent}>
            <Text style={styles.replyBannerHeader}>
              Replying to{' '}
              {replyingTo?.sender?.displayName || replyingTo?.sender?.username || 'user'}
            </Text>
            <Text style={styles.replyBannerSnippet} numberOfLines={1}>
              {replyingTo?.content || '[Attachment]'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.replyBannerClose}
            onPress={onCancelReply}
            activeOpacity={0.7}
            accessibilityLabel="Cancel reply"
          >
            <Icon name="close" size={12} color="#A0A5B5" />
          </TouchableOpacity>
        </View>
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
                    <Icon name="file-text" size={20} color="#246BFD" />
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

                {item.status === 'failed' && (
                  <Icon name="alert-circle" size={14} color="#F75555" style={styles.failedBadge} />
                )}

                <TouchableOpacity
                  onPress={() => handleRemoveStaged(item.id)}
                  style={styles.removeStagedButton}
                  activeOpacity={0.7}
                >
                  <Icon name="close" size={10} color="#A0A5B5" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Quick Emoji Drawer */}
      {showEmojiDrawer && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.emojiDrawer}
          contentContainerStyle={styles.emojiDrawerContent}
        >
          {COMPOSER_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleInsertEmoji(emoji)}
              style={styles.drawerEmojiBtn}
              activeOpacity={0.6}
            >
              <Text style={styles.drawerEmojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Main Composer Row */}
      <View style={styles.composerRow}>
        {/* Attachment Picker Button */}
        <TouchableOpacity
          style={[styles.iconButton, isNarrow ? styles.iconButtonNarrow : null]}
          onPress={handlePickFile}
          disabled={disabled || isUploading}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityLabel="Attach media or file"
        >
          <Icon
            name="paperclip"
            size={20}
            color={disabled || isUploading ? '#616675' : '#A0A5B5'}
          />
        </TouchableOpacity>

        {/* Emoji Drawer Toggle Button */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            showEmojiDrawer ? styles.iconButtonActive : null,
            isNarrow ? styles.iconButtonNarrow : null,
          ]}
          onPress={handleToggleEmojiDrawer}
          disabled={disabled}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityLabel="Toggle emoji drawer"
        >
          <Icon name="smile" size={20} color={showEmojiDrawer ? '#246BFD' : '#A0A5B5'} />
        </TouchableOpacity>

        {/* Text Input Wrapper */}
        <View style={[styles.inputWrapper, isNarrow ? styles.inputWrapperNarrow : null]}>
          <TextInput
            ref={textInputRef}
            style={[styles.input, { height: inputHeight }]}
            placeholder={effectivePlaceholder}
            placeholderTextColor="#64748B"
            value={text}
            onChangeText={handleChangeText}
            onContentSizeChange={handleContentSizeChange}
            multiline
            maxLength={4000}
            editable={!disabled}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            onKeyPress={handleKeyPress}
            onFocus={onFocus}
          />
        </View>

        {/* Dynamic Send Button with Tactile Feedback */}
        <Animated.View style={{ transform: [{ scale: sendScaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
              isNarrow ? styles.sendButtonNarrow : null,
            ]}
            onPress={handleSend}
            onPressIn={handleSendPressIn}
            disabled={!canSend}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityLabel="Send message"
            // @ts-expect-error web pointer down handler prevents blur on web/mobile browsers
            onMouseDown={
              Platform.OS === 'web'
                ? (e: { preventDefault?: () => void }) => e?.preventDefault?.()
                : undefined
            }
          >
            <Icon name="send" size={16} color={canSend ? '#FFFFFF' : '#616675'} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181A20',
    borderTopWidth: 1,
    borderTopColor: '#2A2D36',
    paddingVertical: 8,
    ...Platform.select({
      web: {
        transition: 'padding-bottom 0.2s cubic-bezier(0.2, 0, 0, 1)',
      },
    }),
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F222A',
    borderLeftWidth: 3,
    borderLeftColor: '#246BFD',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  replyBannerContent: {
    flex: 1,
    marginRight: 8,
  },
  replyBannerHeader: {
    color: '#246BFD',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyBannerSnippet: {
    color: '#A0A5B5',
    fontSize: 12,
  },
  replyBannerClose: {
    padding: 4,
  },
  replyBannerCloseText: {
    color: '#757B8C',
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: '#1F222A',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#2A2D36',
    maxWidth: 180,
    gap: 6,
  },
  stagedCardFailed: {
    borderColor: '#F75555',
  },
  stagedThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#262A34',
  },
  stagedFileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#262A34',
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
    color: '#757B8C',
    fontSize: 10,
    marginTop: 2,
  },
  stageIndicator: {
    marginHorizontal: 4,
  },
  failedBadge: {
    marginHorizontal: 2,
  },
  removeStagedButton: {
    padding: 4,
  },
  removeStagedText: {
    color: '#757B8C',
    fontSize: 12,
    fontWeight: '700',
  },
  emojiDrawer: {
    paddingHorizontal: 12,
    marginBottom: 8,
    maxHeight: 42,
  },
  emojiDrawerContent: {
    gap: 8,
    alignItems: 'center',
  },
  drawerEmojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#262A34',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerEmojiText: {
    fontSize: 18,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#262A34',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  iconButtonNarrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  iconButtonActive: {
    backgroundColor: 'rgba(36, 107, 253, 0.2)',
    borderWidth: 1,
    borderColor: '#246BFD',
  },
  iconButtonText: {
    fontSize: 18,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#1F222A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2A2D36',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    minHeight: 42,
    justifyContent: 'center',
  },
  inputWrapperNarrow: {
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlignVertical: 'center',
    outlineWidth: 0,
    ...Platform.select({
      web: {
        transition: 'height 0.15s ease',
      },
    }),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease, transform 0.1s ease',
      },
    }),
  },
  sendButtonNarrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sendButtonActive: {
    backgroundColor: '#246BFD',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(36, 107, 253, 0.4)',
      },
    }),
  },
  sendButtonDisabled: {
    backgroundColor: '#262A34',
  },
  sendText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 2,
  },
  sendTextActive: {
    color: '#FFFFFF',
  },
  sendTextDisabled: {
    color: '#757B8C',
  },
});
