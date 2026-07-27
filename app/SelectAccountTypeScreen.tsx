import { Colors } from '@/lib/designSystem';
import { haptics } from '@/hooks/useHaptics';
import useOnboarding from '../hooks/useOnboarding';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthRole } from '../hooks/useAuth';

/**
 * Client-only entry: provider signup/onboarding was split out of this app and
 * those routes no longer exist here. Do not reintroduce a provider CTA.
 */
export default function SelectAccountTypeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setRole } = useAuthRole();
  const { isOnboardingComplete } = useOnboarding();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonSlideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(buttonSlideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClientSignup = async () => {
    haptics.selection();
    await setRole('client');

    if (isOnboardingComplete) {
      router.replace('/SignupScreen');
    } else {
      router.replace('/onboarding');
    }
  };

  const buttonStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: buttonSlideAnim }],
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ImageBackground
        source={require('../assets/images/introimage.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
          <Animated.View style={[styles.buttonsContainer, buttonStyle]}>
            <TouchableOpacity
              style={styles.clientButton}
              onPress={handleClientSignup}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Sign up as a client"
            >
              <Text style={styles.clientButtonText}>Sign Up as a Client</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={async () => {
                haptics.selection();
                await setRole('client');
                router.replace('/LoginScreen');
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Log in to an existing account"
            >
              <Text style={styles.loginLinkText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: '100%',
  },
  buttonsContainer: {
    gap: 10,
    width: '100%',
    alignSelf: 'center',
  },
  clientButton: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  clientButtonText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  loginLink: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 4,
  },
  loginLinkText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    flexShrink: 1,
  },
});
