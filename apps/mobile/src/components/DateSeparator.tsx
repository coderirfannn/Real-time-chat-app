import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface DateSeparatorProps {
  label: string;
  accessibilityRole?: 'header' | 'text' | 'none';
  accessibilityLabel?: string;
}

export function DateSeparator({
  label,
  accessibilityRole = 'header',
  accessibilityLabel,
}: DateSeparatorProps): React.JSX.Element {
  return (
    <View
      style={styles.container}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || `Conversation date: ${label}`}
    >
      <View style={styles.pill}>
        <Text style={styles.text}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 14,
  },
  pill: {
    backgroundColor: '#1F222A',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#2A2D36',
  },
  text: {
    color: '#A0A5B5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
