import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';

export interface MessageComposerProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({
  onSendMessage,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageComposerProps): React.JSX.Element {
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !disabled;

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSendMessage(trimmed);
    setText('');
  }, [text, disabled, onSendMessage]);

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          value={text}
          onChangeText={setText}
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
        <Text style={[styles.sendText, canSend ? styles.sendTextActive : styles.sendTextDisabled]}>
          ↑
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
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
