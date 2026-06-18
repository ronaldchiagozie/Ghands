import { BorderRadius, Colors } from '@/lib/designSystem';
import { haptics } from '@/hooks/useHaptics';
import { Image } from 'expo-image';
import { RefreshCw } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Bundled illustration — man with phone, no Wi‑Fi (386×357). */
const NO_INTERNET_IMG = require('../assets/images/nointernetimg.png');
const ILLUSTRATION_WIDTH = 300;
const ILLUSTRATION_HEIGHT = 278;

type NoInternetScreenProps = {
  onRetry: () => void | Promise<void | boolean>;
};

/**
 * Full-screen offline state (provider home & similar). Does not clear auth.
 */
export default function NoInternetScreen({ onRetry }: NoInternetScreenProps) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    haptics.light();
    setBusy(true);
    try {
      await Promise.resolve(onRetry());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} accessibilityRole="none">
      <View style={styles.illustrationFrame}>
        <Image
          source={NO_INTERNET_IMG}
          style={styles.illustration}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="No internet connection illustration"
          onError={(error) => {
            if (__DEV__) {
              console.warn('[NoInternetScreen] illustration failed to load', error);
            }
          }}
        />
      </View>
      <Text style={styles.title}>Whoops!</Text>
      <Text style={styles.body}>
        No internet connection found. Check your internet connection or try again.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        disabled={busy}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        {busy ? (
          <ActivityIndicator size="small" color={Colors.textPrimary} style={{ marginRight: 8 }} />
        ) : (
          <RefreshCw size={20} color={Colors.textPrimary} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const BG = '#F9F9F7';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  illustrationFrame: {
    width: ILLUSTRATION_WIDTH,
    height: ILLUSTRATION_HEIGHT,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  illustration: {
    width: ILLUSTRATION_WIDTH,
    height: ILLUSTRATION_HEIGHT,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.textPrimary,
    backgroundColor: Colors.white,
    minWidth: 200,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
});
