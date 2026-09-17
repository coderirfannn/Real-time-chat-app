import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Platform,
  Easing,
} from 'react-native';

export interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete?: () => void;
}

export function AnimatedSplashScreen({
  isReady,
  onAnimationComplete,
}: AnimatedSplashScreenProps): React.JSX.Element | null {
  const [isVisible, setIsVisible] = useState(true);

  // Animation values
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseRingScale = useRef(new Animated.Value(0.8)).current;
  const pulseRingOpacity = useRef(new Animated.Value(0.4)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(15)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const shimmerValue = useRef(new Animated.Value(0)).current;

  // 1. Initial Entrance & Pulse loop
  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle breathing pulse on the aura ring
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseRingScale, {
            toValue: 1.25,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseRingOpacity, {
            toValue: 0.15,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseRingScale, {
            toValue: 0.85,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseRingOpacity, {
            toValue: 0.5,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulseAnim.start();

    // Shimmer bar loop
    const shimmerAnim = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    shimmerAnim.start();

    return () => {
      pulseAnim.stop();
      shimmerAnim.stop();
    };
  }, [
    logoScale,
    logoOpacity,
    pulseRingScale,
    pulseRingOpacity,
    textOpacity,
    textTranslateY,
    shimmerValue,
  ]);

  // 2. Smooth Exit once App is Hydrated and Ready
  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsVisible(false);
        onAnimationComplete?.();
      });
    }, 600); // 600ms grace for premium branding display

    return () => clearTimeout(timer);
  }, [isReady, exitOpacity, exitScale, onAnimationComplete]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: exitOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}
      pointerEvents="none"
    >
      {/* Background Ambient Glow */}
      <View style={styles.glowContainer}>
        <Animated.View
          style={[
            styles.pulseAura,
            {
              transform: [{ scale: pulseRingScale }],
              opacity: pulseRingOpacity,
            },
          ]}
        />
      </View>

      {/* Center Brand Icon */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Brand Title & Tagline */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={styles.appName}>ChatLock</Text>
        <View style={styles.badgeRow}>
          <View style={styles.greenDot} />
          <Text style={styles.tagline}>End-to-End Encrypted</Text>
        </View>
      </Animated.View>

      {/* Bottom Loading Indicator Bar */}
      <View style={styles.footer}>
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                transform: [
                  {
                    translateX: shimmerValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-80, 80],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0E1015',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  glowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseAura: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 210, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(36, 107, 253, 0.35)',
  },
  logoWrapper: {
    width: 108,
    height: 108,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: '#12141C',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'sans-serif-medium' },
      web: { fontFamily: 'Inter, system-ui, sans-serif' },
    }),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#12D18E',
    marginRight: 6,
  },
  tagline: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
  },
  progressBarTrack: {
    width: 72,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: 36,
    height: '100%',
    backgroundColor: '#00D2FF',
    borderRadius: 2,
  },
});
