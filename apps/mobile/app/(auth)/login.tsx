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

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your email or username');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await authApi.login({
        identifier: cleanIdentifier,
        password,
      });

      await setSession(response);
      if (Platform.OS === 'web' && response.user.role === 'ADMIN') {
        router.replace('/admin/dashboard' as never);
      } else {
        router.replace('/(main)' as never);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [identifier, password, setSession, router]);

  const handleNavigateRegister = useCallback(() => {
    router.push('/(auth)/register' as never);
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
                <Icon name="shield" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>ChatLock</Text>
              <Text style={styles.subtitle}>Real-time secure messaging</Text>
            </View>

            {/* Form Card */}
            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>Sign In</Text>

              {errorMessage && (
                <View style={styles.errorBanner}>
                  <Icon name="alert-circle" size={16} color={semanticColors.error} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Identifier Input */}
              <Input
                label="Email or Username"
                placeholder="Enter email or username"
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                iconLeft={<Icon name="user" size={18} color="#757B8C" />}
              />

              {/* Password Input */}
              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
                iconLeft={<Icon name="key" size={18} color="#757B8C" />}
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

              {/* Submit Button */}
              <Button
                title="Sign In"
                onPress={handleLogin}
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
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleNavigateRegister} activeOpacity={0.7}>
                <Text style={styles.footerLink}>Create Account</Text>
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
    maxWidth: 440,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
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
    marginBottom: 18,
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
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
