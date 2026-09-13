import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../../../components/ui/Icon';
import type { DeliveryStatus } from '../../../types/chat.types';

export interface DeliveryReceiptProps {
  status: DeliveryStatus;
  onRetry?: () => void;
  size?: 'small' | 'normal';
}

export const DeliveryReceipt = memo(function DeliveryReceipt({
  status,
  onRetry,
}: DeliveryReceiptProps): React.JSX.Element | null {
  switch (status) {
    case 'pending':
    case 'sending':
      return (
        <View style={styles.container} testID="receipt-sending">
          <ActivityIndicator size={10} color="rgba(255, 255, 255, 0.6)" />
        </View>
      );

    case 'sent':
      // Single checkmark in muted slate
      return (
        <View style={styles.container} testID="receipt-sent" accessibilityLabel="Sent">
          <Icon name="check" size={12} color="rgba(255, 255, 255, 0.7)" />
        </View>
      );

    case 'delivered':
      // Double checkmarks in muted slate
      return (
        <View style={styles.container} testID="receipt-delivered" accessibilityLabel="Delivered">
          <Icon name="check-check" size={14} color="rgba(255, 255, 255, 0.75)" />
        </View>
      );

    case 'read':
      // Double checkmarks in electric sky blue (#38BDF8)
      return (
        <View style={styles.container} testID="receipt-read" accessibilityLabel="Read">
          <Icon name="check-check" size={14} color="#38BDF8" />
        </View>
      );

    case 'failed':
      return (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.7}
          style={styles.failedContainer}
          testID="receipt-failed"
          accessibilityLabel="Delivery failed, tap to retry"
        >
          <Icon name="alert-circle" size={11} color="#EF4444" />
          <Text style={styles.failedText}>Retry</Text>
        </TouchableOpacity>
      );

    default:
      return null;
  }
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  failedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 3,
  },
  failedText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '600',
  },
});
