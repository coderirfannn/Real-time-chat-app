import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import {
  biometricsService,
  type BiometricCapability,
} from '../../services/security/biometrics.service';
import { Icon } from '../ui/Icon';

interface AppLockModalProps {
  isVisible: boolean;
  onUnlocked: () => void;
}

export function AppLockModal({ isVisible, onUnlocked }: AppLockModalProps): React.JSX.Element {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);

  useEffect(() => {
    biometricsService.getCapabilities().then(setCapability);
  }, []);

  const triggerAuth = useCallback(async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);

    const result = await biometricsService.authenticate('Unlock ChatLock to continue');
    setIsAuthenticating(false);

    if (result.success) {
      onUnlocked();
    } else if (result.error) {
      setErrorMessage('Authentication required to unlock');
    }
  }, [onUnlocked]);

  useEffect(() => {
    if (isVisible) {
      triggerAuth();
    }
  }, [isVisible, triggerAuth]);

  return (
    <Modal visible={isVisible} animationType="fade" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Security Shield Icon */}
          <View style={styles.iconContainer}>
            <Icon name="shield" size={44} color="#38BDF8" />
          </View>

          <Text style={styles.title}>ChatLock is Locked</Text>
          <Text style={styles.subtitle}>
            Authenticate with{' '}
            {capability?.biometryType && capability.biometryType !== 'None'
              ? capability.biometryType
              : 'Device Passcode'}{' '}
            to access your secure messages.
          </Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color="#F87171" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.unlockButton}
            onPress={triggerAuth}
            activeOpacity={0.8}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.unlockButtonText}>
                Unlock with{' '}
                {capability?.biometryType && capability.biometryType !== 'None'
                  ? capability.biometryType
                  : 'Passcode'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 24,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  unlockButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 240,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
      },
      default: {
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
