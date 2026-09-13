import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { brandColors } from '../theme/colors';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  style,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        {icon ? (
          typeof icon === 'string' ? (
            <Icon name={icon as never} size={36} color={brandColors.primary} />
          ) : (
            icon
          )
        ) : (
          <Icon name="chat" size={36} color={brandColors.primary} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <View style={styles.actionWrapper}>
          <Button title={actionLabel} variant="primary" size="md" onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    // Soft primary tint — Figma E-Chat empty state pattern (no border)
    backgroundColor: 'rgba(36, 107, 253, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 14,
    color: '#A0A5B5',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  actionWrapper: {
    marginTop: 24,
  },
});
