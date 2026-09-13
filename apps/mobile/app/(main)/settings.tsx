import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Switch,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { useSocketStore } from '../../src/store/socket.store';
import { userApi } from '../../src/services/api/user.api';
import { authApi } from '../../src/services/api/auth.api';
import { Avatar } from '../../src/components/Avatar';
import { AppHeader } from '../../src/components/layout/AppHeader';
import { Button, Card, Input, Icon } from '../../src/components/ui';
import {
  biometricsService,
  type BiometricCapability,
} from '../../src/services/security/biometrics.service';
import { useNotificationStore } from '../../src/store/notification.store';
import { notificationService } from '../../src/services/notifications/notification.service';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const connectionState = useSocketStore((state) => state.connectionState);

  // Profile editing state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Biometric App Lock state
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Change Password state
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification & Sound Preferences
  const notificationsEnabled = useNotificationStore((state) => state.notificationsEnabled);
  const soundEnabled = useNotificationStore((state) => state.soundEnabled);
  const vibrateEnabled = useNotificationStore((state) => state.vibrateEnabled);
  const inAppAlertsEnabled = useNotificationStore((state) => state.inAppAlertsEnabled);
  const setNotificationsEnabled = useNotificationStore((state) => state.setNotificationsEnabled);
  const setSoundEnabled = useNotificationStore((state) => state.setSoundEnabled);
  const setVibrateEnabled = useNotificationStore((state) => state.setVibrateEnabled);
  const setInAppAlertsEnabled = useNotificationStore((state) => state.setInAppAlertsEnabled);

  const handleToggleNotifications = useCallback(
    async (value: boolean) => {
      await setNotificationsEnabled(value);
      setSuccessMessage(value ? 'Message notifications enabled' : 'Notifications muted');
      setTimeout(() => setSuccessMessage(null), 2500);
    },
    [setNotificationsEnabled],
  );

  const handleToggleSound = useCallback(
    async (value: boolean) => {
      await setSoundEnabled(value);
      if (value) {
        notificationService.playBellSound();
      }
      setSuccessMessage(value ? 'Bell sound enabled' : 'Bell sound muted');
      setTimeout(() => setSuccessMessage(null), 2500);
    },
    [setSoundEnabled],
  );

  const handleToggleVibrate = useCallback(
    async (value: boolean) => {
      await setVibrateEnabled(value);
      if (value) {
        notificationService.triggerVibration();
      }
      setSuccessMessage(value ? 'Device vibration enabled' : 'Vibration disabled');
      setTimeout(() => setSuccessMessage(null), 2500);
    },
    [setVibrateEnabled],
  );

  const handleToggleInAppAlerts = useCallback(
    async (value: boolean) => {
      await setInAppAlertsEnabled(value);
    },
    [setInAppAlertsEnabled],
  );

  useEffect(() => {
    biometricsService.getCapabilities().then(setBiometricCapability);
    biometricsService.isAppLockEnabled().then(setIsAppLockEnabled);
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)' as never);
    }
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

  const handleToggleAppLock = useCallback(async (value: boolean) => {
    setIsTogglingLock(true);
    setErrorMessage(null);

    // Verify biometric identity before changing setting
    const authResult = await biometricsService.authenticate(
      value ? 'Confirm biometrics to enable App Lock' : 'Confirm identity to disable App Lock',
    );

    if (!authResult.success) {
      setIsTogglingLock(false);
      setErrorMessage(authResult.error || 'Authentication failed');
      return;
    }

    await biometricsService.setAppLockEnabled(value);
    setIsAppLockEnabled(value);
    setIsTogglingLock(false);
    setSuccessMessage(value ? 'ChatLock App Lock enabled' : 'App Lock disabled');
    setTimeout(() => setSuccessMessage(null), 3000);
  }, []);

  const handleChangePassword = useCallback(async () => {
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must contain uppercase, lowercase, and a number');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });

      setIsPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully! Other sessions have been revoked.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

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
      if (window.confirm('Are you sure you want to sign out on all devices?')) {
        await confirmAction();
      }
    } else {
      Alert.alert(
        'Sign Out of All Devices',
        "You'll be signed out on all devices. You'll need to log in again.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out All', style: 'destructive', onPress: confirmAction },
        ],
      );
    }
  }, [logout, router]);

  const isOnline = connectionState === 'connected';

  return (
    <View style={styles.outerContainer}>
      {/* Figma E-Chat Header */}
      <AppHeader
        title="Settings"
        subtitle="Account, Privacy & Security"
        showBack={true}
        onBack={handleBack}
        hasBorder={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveContent}>
          {/* Feedback Messages */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={18} color="#F75555" />
              <Text style={styles.errorBoxText}>{errorMessage}</Text>
            </View>
          )}
          {successMessage && (
            <View style={styles.successBox}>
              <Icon name="check" size={18} color="#12D18E" />
              <Text style={styles.successBoxText}>{successMessage}</Text>
            </View>
          )}

          {/* Section 1: User Profile Card */}
          <Card style={styles.sectionCard} padding="lg">
            <View style={styles.profileHeader}>
              <Avatar
                name={currentUser?.displayName || currentUser?.username || 'User'}
                avatarUrl={currentUser?.avatarUrl}
                size="lg"
                isOnline={isOnline}
                hasRing={false}
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
                  <Input
                    label="Display Name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter display name"
                    autoFocus
                  />
                  <View style={styles.editActionButtons}>
                    <Button
                      title="Save Changes"
                      variant="primary"
                      size="sm"
                      loading={isSaving}
                      onPress={handleSaveProfile}
                    />
                    <Button
                      title="Cancel"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        setIsEditing(false);
                        setDisplayName(currentUser?.displayName || '');
                      }}
                    />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editTrigger}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Edit display name"
                >
                  <Icon name="edit" size={14} color="#246BFD" />
                  <Text style={styles.editTriggerText}>Edit Display Name</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Section 2: Biometric App Lock & Protection */}
          <Card style={styles.sectionCard} padding="lg">
            <Text style={styles.sectionHeaderTitle}>App Protection &amp; Privacy</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingIconCol}>
                <Icon name="smartphone" size={18} color="#A0A5B5" />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>
                  Biometric App Lock (
                  {biometricCapability?.biometryType && biometricCapability.biometryType !== 'None'
                    ? biometricCapability.biometryType
                    : 'Passcode'}
                  )
                </Text>
                <Text style={styles.settingSubtext}>
                  Requires identity authentication when opening or resuming ChatLock.
                </Text>
              </View>
              <Switch
                value={isAppLockEnabled}
                onValueChange={handleToggleAppLock}
                disabled={isTogglingLock}
                trackColor={{ false: '#262A34', true: '#246BFD' }}
                thumbColor={isAppLockEnabled ? '#FFFFFF' : '#A0A5B5'}
                ios_backgroundColor="#262A34"
              />
            </View>
          </Card>

          {/* Section: Notifications & Sounds Card */}
          <Card style={styles.sectionCard} padding="lg">
            <Text style={styles.sectionHeaderTitle}>Notifications &amp; Sounds</Text>

            {/* Master Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingIconCol}>
                <Icon name="bell" size={18} color="#A0A5B5" />
              </View>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Message Notifications</Text>
                <Text style={styles.settingSubtext}>
                  Receive alerts when incoming messages arrive.
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#262A34', true: '#246BFD' }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#A0A5B5'}
                ios_backgroundColor="#262A34"
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.settingDivider} />

                {/* Sound / Bell Toggle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingIconCol}>
                    <Icon name="volume-2" size={18} color="#A0A5B5" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Sound / Bell</Text>
                    <Text style={styles.settingSubtext}>
                      Play notification bell tone according to device sound mode.
                    </Text>
                  </View>
                  <Switch
                    value={soundEnabled}
                    onValueChange={handleToggleSound}
                    trackColor={{ false: '#262A34', true: '#246BFD' }}
                    thumbColor={soundEnabled ? '#FFFFFF' : '#A0A5B5'}
                    ios_backgroundColor="#262A34"
                  />
                </View>

                <View style={styles.settingDivider} />

                {/* Vibrate Toggle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingIconCol}>
                    <Icon name="smartphone" size={18} color="#A0A5B5" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>Vibration</Text>
                    <Text style={styles.settingSubtext}>
                      Vibrate mobile device on incoming messages.
                    </Text>
                  </View>
                  <Switch
                    value={vibrateEnabled}
                    onValueChange={handleToggleVibrate}
                    trackColor={{ false: '#262A34', true: '#246BFD' }}
                    thumbColor={vibrateEnabled ? '#FFFFFF' : '#A0A5B5'}
                    ios_backgroundColor="#262A34"
                  />
                </View>

                <View style={styles.settingDivider} />

                {/* In-App Alerts Toggle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingIconCol}>
                    <Icon name="bell" size={18} color="#A0A5B5" />
                  </View>
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingLabel}>In-App Previews</Text>
                    <Text style={styles.settingSubtext}>
                      Display preview banner while using ChatLock.
                    </Text>
                  </View>
                  <Switch
                    value={inAppAlertsEnabled}
                    onValueChange={handleToggleInAppAlerts}
                    trackColor={{ false: '#262A34', true: '#246BFD' }}
                    thumbColor={inAppAlertsEnabled ? '#FFFFFF' : '#A0A5B5'}
                    ios_backgroundColor="#262A34"
                  />
                </View>
              </>
            )}
          </Card>

          {/* Section 3: Security & Credentials Card */}
          <Card style={styles.sectionCard} padding="lg">
            <Text style={styles.sectionHeaderTitle}>Security &amp; Account</Text>

            <View style={styles.actionButtonsCol}>
              <Button
                title="Change Password"
                variant="secondary"
                size="md"
                fullWidth
                iconLeft={<Icon name="key" size={16} color="#FFFFFF" />}
                onPress={() => {
                  setPasswordError(null);
                  setIsPasswordModalVisible(true);
                }}
              />

              <Button
                title="Log Out from this Device"
                variant="outline"
                size="md"
                fullWidth
                iconLeft={<Icon name="logout" size={16} color="#A0A5B5" />}
                onPress={handleLogout}
              />

              <Button
                title="Sign Out of All Devices"
                variant="danger"
                size="md"
                fullWidth
                loading={isLoggingOutAll}
                iconLeft={<Icon name="logout" size={16} color="#FFFFFF" />}
                onPress={handleLogoutAllDevices}
              />
            </View>
          </Card>

          {/* Consumer App Footer */}
          <View style={styles.footerInfo}>
            <Text style={styles.footerVersion}>ChatLock v0.16.0 • End-to-End Encrypted</Text>
          </View>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={isPasswordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsPasswordModalVisible(false)}
        >
          <View
            style={styles.modalCard}
            // @ts-expect-error prevent click propagation
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSubtitle}>
              Ensure your new password is at least 8 characters and includes uppercase, lowercase,
              and numbers.
            </Text>

            {passwordError && (
              <View style={styles.errorBox}>
                <Icon name="alert-circle" size={18} color="#F75555" />
                <Text style={styles.errorBoxText}>{passwordError}</Text>
              </View>
            )}

            <View style={styles.modalInputs}>
              <Input
                label="Current Password"
                secureTextEntry
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />

              <Input
                label="New Password"
                secureTextEntry
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Input
                label="Confirm New Password"
                secureTextEntry
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={() => setIsPasswordModalVisible(false)}
                disabled={isChangingPassword}
              />
              <Button
                title="Update Password"
                variant="primary"
                size="md"
                loading={isChangingPassword}
                onPress={handleChangePassword}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110, // Safe distance from bottom tab bar
  },
  responsiveContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 85, 85, 0.12)',
    borderColor: 'rgba(247, 85, 85, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  errorBoxText: {
    color: '#F75555',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 209, 142, 0.12)',
    borderColor: 'rgba(18, 209, 142, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  successBoxText: {
    color: '#12D18E',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#1F222A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2D36',
  },
  sectionHeaderTitle: {
    color: '#A0A5B5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileDetails: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileUsername: {
    color: '#246BFD',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  profileEmail: {
    color: '#A0A5B5',
    fontSize: 13,
    marginTop: 2,
  },
  editSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2D36',
    paddingTop: 14,
  },
  editTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  editTriggerText: {
    color: '#246BFD',
    fontSize: 14,
    fontWeight: '600',
  },
  editRow: {
    gap: 12,
  },
  editActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  settingIconCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingTextCol: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtext: {
    color: '#A0A5B5',
    fontSize: 12,
    lineHeight: 18,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#2A2D36',
    marginVertical: 12,
  },
  actionButtonsCol: {
    gap: 12,
  },
  footerInfo: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  footerVersion: {
    color: '#757B8C',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#1F222A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#2A2D36',
    gap: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#A0A5B5',
    lineHeight: 18,
  },
  modalInputs: {
    gap: 12,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
});
