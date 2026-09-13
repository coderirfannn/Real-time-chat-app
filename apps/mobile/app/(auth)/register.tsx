import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../src/services/api/auth.api';
import { useAuthStore } from '../../src/store/auth.store';
import { Input, Button, Card, Icon } from '../../src/components/ui';
import { brandColors, semanticColors } from '../../src/theme/colors';

export default function RegisterScreen(): React.JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = useCallback(async () => {
    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanDisplayName) {
      setErrorMessage('Display name is required');
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMessage('Username can only contain letters, numbers, and underscores');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setErrorMessage('Password must contain at least one uppercase letter (A-Z)');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setErrorMessage('Password must contain at least one lowercase letter (a-z)');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setErrorMessage('Password must contain at least one number (0-9)');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await authApi.register({
        displayName: cleanDisplayName,
        username: cleanUsername,
        email: cleanEmail,
        password,
      });

      await setSession(response);
      router.replace('/(main)' as never);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [displayName, username, email, password, confirmPassword, setSession, router]);

  const handleNavigateLogin = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrapper}>
            {/* Header Brand */}
            <View style={styles.brandContainer}>
              <View style={styles.logoBadge}>
                <Icon name="shield" size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join ChatLock today for secure messaging</Text>
            </View>

            {/* Form Card */}
            <Card style={styles.card} padding="lg">
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Icon name="alert-circle" size={16} color={semanticColors.error} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Display Name Input */}
              <Input
                label="Display Name"
                placeholder="e.g. Alex Smith"
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                editable={!isLoading}
                iconLeft={<Icon name="user" size={18} color="#757B8C" />}
              />

              {/* Username Input */}
              <Input
                label="Username"
                placeholder="e.g. alex_smith"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                iconLeft={<Icon name="edit" size={18} color="#757B8C" />}
                hint="Only letters, numbers, and underscores"
              />

              {/* Email Input */}
              <Input
                label="Email Address"
                placeholder="e.g. alex@example.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!isLoading}
                iconLeft={<Icon name="mail" size={18} color="#757B8C" />}
              />

              {/* Password Input */}
              <Input
                label="Password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
                iconLeft={<Icon name="key" size={18} color="#757B8C" />}
                hint="Must contain uppercase, lowercase, and a number"
                iconRight={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color="#757B8C" />
                  </TouchableOpacity>
                }
              />

              {/* Confirm Password Input */}
              <Input
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
                iconLeft={<Icon name="shield" size={18} color="#757B8C" />}
              />

              {/* Submit Button */}
              <Button
                title="Create Account"
                onPress={handleRegister}
                variant="primary"
                size="lg"
                fullWidth
                loading={isLoading}
                disabled={isLoading}
                style={styles.submitButton}
              />
            </Card>

            {/* Footer Navigation */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleNavigateLogin} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 460,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: brandColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(36, 107, 253, 0.35)',
      },
    }),
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#757B8C',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1F222A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(247, 85, 85, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(247, 85, 85, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: semanticColors.error,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  submitButton: {
    marginTop: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerText: {
    color: '#757B8C',
    fontSize: 14,
  },
  footerLink: {
    color: brandColors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
