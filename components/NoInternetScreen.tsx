import { BorderRadius, Colors } from '@/lib/designSystem';
import { haptics } from '@/hooks/useHaptics';
import { RefreshCw } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

/** Same file path as `lib/assets` — require here so Metro always bundles it for this screen. */
const NO_INTERNET_IMG = require('../assets/images/nointernetimg.png');

const BG = '#F9F9F7';

type NoInternetScreenProps = {
  onRetry: () => void | Promise<void | boolean>;
};

export default function NoInternetScreen({ onRetry }: NoInternetScreenProps) {
  const [busy, setBusy] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const heroHeight = useMemo(() => {
    if (windowWidth < 375) return 260;
    if (windowWidth < 414) return 280;
    return 300;
  }, [windowWidth]);

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
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Same layout as onboarding hero illustrations */}
        <View style={[styles.heroZone, { height: heroHeight }]}>
          <Image
            source={NO_INTERNET_IMG}
            style={{
              width: windowWidth * 0.78,
              height: heroHeight,
            }}
            resizeMode="contain"
            fadeDuration={0}
            accessible
            accessibilityLabel="No internet connection illustration"
          />
        </View>

        <Text style={styles.title}>No connection</Text>
        <Text style={styles.body}>
          You’re offline. Check your connection and try again.
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    backgroundColor: BG,
  },
  heroZone: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    backgroundColor: BG,
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
