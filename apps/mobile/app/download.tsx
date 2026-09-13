import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { darkColors, brandColors } from '../src/theme/colors';
import { Icon } from '../src/components/ui/Icon';
import { Button } from '../src/components/ui/Button';

export default function DownloadScreen(): React.JSX.Element {
  const router = useRouter();

  const apkDownloadUrl =
    process.env['EXPO_PUBLIC_APK_DOWNLOAD_URL'] ||
    'https://github.com/coderirfannn/Real-time-chat-app/releases/latest';

  const playStoreUrl =
    process.env['EXPO_PUBLIC_PLAY_STORE_URL'] ||
    'https://play.google.com/store/apps/details?id=com.chatlock.app';

  const handleOpenWeb = () => {
    router.replace('/');
  };

  const handleDownloadApk = async () => {
    try {
      const supported = await Linking.canOpenURL(apkDownloadUrl);
      if (supported) {
        await Linking.openURL(apkDownloadUrl);
      }
    } catch {
      // Fallback redirect
      if (typeof window !== 'undefined') {
        window.location.href = apkDownloadUrl;
      }
    }
  };

  const handleOpenPlayStore = async () => {
    try {
      const supported = await Linking.canOpenURL(playStoreUrl);
      if (supported) {
        await Linking.openURL(playStoreUrl);
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.location.href = playStoreUrl;
      }
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Icon name="shield" size={40} color={brandColors.primary} />
        </View>
        <Text style={styles.title}>Get ChatLock</Text>
        <Text style={styles.subtitle}>
          Secure, real-time messaging with biometric protection, instant sync, and zero compromise.
        </Text>
      </View>

      {/* Primary Targets */}
      <View style={styles.cardsContainer}>
        {/* 1. Web Application */}
        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <Icon name="globe" size={28} color={brandColors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Open ChatLock Web</Text>
            <Text style={styles.cardDescription}>
              No installation needed. Access your chats instantly in any modern web browser.
            </Text>
          </View>
          <Button
            title="Launch Web App"
            variant="primary"
            fullWidth
            onPress={handleOpenWeb}
            style={styles.actionButton}
          />
        </View>

        {/* 2. Direct Android APK */}
        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <Icon name="smartphone" size={28} color="#12D18E" />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>Download Android APK</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Direct</Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>
              Install ChatLock directly on your Android device. Compatible with Android 8.0+.
            </Text>
          </View>
          <Button
            title="Download APK"
            variant="secondary"
            fullWidth
            onPress={handleDownloadApk}
            style={styles.actionButton}
          />
        </View>

        {/* 3. Google Play Store */}
        <View style={styles.card}>
          <View style={styles.cardIconWrapper}>
            <Icon name="check-circle" size={28} color="#FFB800" />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>Google Play Store</Text>
              <View style={[styles.badge, styles.playBadge]}>
                <Text style={styles.badgeText}>AAB</Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>
              Standard distribution via Google Play Store with automatic background updates.
            </Text>
          </View>
          <Button
            title="View on Google Play"
            variant="outline"
            fullWidth
            onPress={handleOpenPlayStore}
            style={styles.actionButton}
          />
        </View>
      </View>

      {/* Trust & Architecture Badges */}
      <View style={styles.trustSection}>
        <View style={styles.featureItem}>
          <Icon name="lock" size={20} color={brandColors.primary} />
          <Text style={styles.featureText}>Biometric App Lock</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="refresh-cw" size={20} color="#12D18E" />
          <Text style={styles.featureText}>Multi-Node Real-Time Sync</Text>
        </View>
        <View style={styles.featureItem}>
          <Icon name="file" size={20} color="#00B8D9" />
          <Text style={styles.featureText}>Direct Signed Cloud Media</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={handleOpenWeb} activeOpacity={0.7}>
          <Text style={styles.footerLink}>← Back to ChatLock Home</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>ChatLock v0.1.0 • Production Build</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 48 : 64,
    paddingBottom: 48,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    maxWidth: 520,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(36, 107, 253, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(36, 107, 253, 0.25)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: darkColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: darkColors.textSecondary,
    textAlign: 'center',
  },
  cardsContainer: {
    width: '100%',
    maxWidth: 500,
    gap: 16,
  },
  card: {
    backgroundColor: darkColors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  cardIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: darkColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardContent: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColors.textPrimary,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: darkColors.textSecondary,
  },
  badge: {
    backgroundColor: 'rgba(18, 209, 142, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  playBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: darkColors.textPrimary,
  },
  actionButton: {
    marginTop: 4,
  },
  trustSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 36,
    maxWidth: 500,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: darkColors.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
    color: darkColors.textPrimary,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: brandColors.primary,
  },
  versionText: {
    fontSize: 12,
    color: darkColors.textMuted,
  },
});
