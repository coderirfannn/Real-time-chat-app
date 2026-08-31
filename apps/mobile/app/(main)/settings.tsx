import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useSocketStore } from '../../src/store/socket.store';
import { userApi } from '../../src/services/api/user.api';
import { authApi } from '../../src/services/api/auth.api';
import { Avatar } from '../../src/components/Avatar';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const connectionState = useSocketStore((state) => state.connectionState);

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSaveProfile = useCallback(async () => {
    if (!displayName.trim()) {
      setErrorMessage('Display name cannot be empty');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await userApi.updateProfile({ displayName: displayName.trim() });
      setUser(updated);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  }, [displayName, setUser]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/(auth)/login' as never);
    } catch (err) {
      console.warn('Logout error:', err);
    }
  }, [logout, router]);

  const handleLogoutAllDevices = useCallback(async () => {
    const confirmAction = async () => {
      setIsLoggingOutAll(true);
      try {
        await authApi.logoutAll();
        await logout();
        router.replace('/(auth)/login' as never);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to revoke sessions';
        setErrorMessage(msg);
      } finally {
        setIsLoggingOutAll(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out of all active devices?')) {
        await confirmAction();
      }
    } else {
      Alert.alert(
        'Log Out All Devices',
        'Are you sure you want to invalidate all active login sessions across all your devices?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out All', style: 'destructive', onPress: confirmAction },
        ],
      );
    }
  }, [logout, router]);

  const isOnline = connectionState === 'connected';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account & Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Messages */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{errorMessage}</Text>
          </View>
        )}
        {successMessage && (
          <View style={styles.successBox}>
            <Text style={styles.successBoxText}>{successMessage}</Text>
          </View>
        )}

        {/* User Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <Avatar
              name={currentUser?.displayName || currentUser?.username || 'User'}
              avatarUrl={currentUser?.avatarUrl}
              size="lg"
              isOnline={isOnline}
            />
            <View style={styles.profileDetails}>
              <Text style={styles.profileName} numberOfLines={1}>
                {currentUser?.displayName || 'ChatLock User'}
              </Text>
              <Text style={styles.profileUsername}>@{currentUser?.username}</Text>
              <Text style={styles.profileEmail}>{currentUser?.email}</Text>
            </View>
          </View>

          {/* Edit Display Name */}
          <View style={styles.editSection}>
            {isEditing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter display name"
                  placeholderTextColor="#64748B"
                  autoFocus
                />
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.smallButton, styles.saveButton]}
                    onPress={handleSaveProfile}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, styles.cancelButton]}
                    onPress={() => {
                      setIsEditing(false);
                      setDisplayName(currentUser?.displayName || '');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editTrigger}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.editTriggerText}>✏️ Edit Display Name</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* System & Connection Status Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>System & Gateway Status</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Real-Time Gateway</Text>
            <View style={styles.badgeWrapper}>
              <View
                style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}
              />
              <Text style={styles.statusValue}>{connectionState.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>App Version</Text>
            <Text style={styles.statusValue}>v0.14.0 (Production Grade)</Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Security Protocol</Text>
            <Text style={styles.statusValue}>Zero-Trust Auth & Session Rotation</Text>
          </View>
        </View>

        {/* Security & Logout Actions Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Security & Sessions</Text>

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Log Out from this Device</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.logoutAllButton]}
            onPress={handleLogoutAllDevices}
            disabled={isLoggingOutAll}
            activeOpacity={0.8}
          >
            {isLoggingOutAll ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <Text style={styles.logoutAllButtonText}>⚠️ Invalidate All Active Sessions</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorBoxText: {
    color: '#F87171',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  successBoxText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  profileUsername: {
    color: '#38BDF8',
    fontSize: 14,
    marginTop: 2,
  },
  profileEmail: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  editSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  editTrigger: {
    paddingVertical: 4,
  },
  editTriggerText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  editRow: {
    gap: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#0284C7',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  statusValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutAllButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  logoutAllButtonText: {
    color: '#F87171',
    fontWeight: '600',
    fontSize: 13,
  },
});
