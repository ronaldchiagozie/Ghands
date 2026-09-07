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

/** Same file path as `lib/assets` - require here so Metro always bundles it for this screen. */
const NO_INTERNET_IMG = require('../assets/images/nointernetimg.png');

const BG = '#F9F9F7';

type NoInternetScreenProps = {
  onRetry: () => void | Promise<void | boolean>;
  /** 'device' when their link is down, 'server' when ours did not answer. */
  reason?: 'device' | 'server';
};

export default function NoInternetScreen({
  onRetry,
  reason = 'device',
}: NoInternetScreenProps) {
  const [busy, setBusy] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  /**
   * Capped against the window height as well as its width. Centred content on a
   * short screen otherwise pushes the retry button below the fold, and the one
   * control on this screen is the one thing that must always be reachable.
   */
  const heroHeight = useMemo(() => {
    const byWidth = windowWidth < 375 ? 260 : windowWidth < 414 ? 280 : 300;
    return Math.min(byWidth, Math.round(windowHeight * 0.34));
  }, [windowWidth, windowHeight]);

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
            accessibilityLabel={
              reason === 'server'
                ? 'Cannot reach GHands illustration'
                : 'No internet connection illustration'
            }
          />
        </View>

        {/**
          * Two different problems, two different sentences. The server not
          * answering was being reported as "You're offline. Check your
          * connection" - to somebody whose connection was working, since the
          * latch behind this screen only fires when the device link is up.
          * Telling people to fix something that is not broken is worse than
          * admitting the fault is ours.
          */}
        <Text style={styles.title}>
          {reason === 'server' ? 'Can’t reach GHands' : 'No connection'}
        </Text>
        <Text style={styles.body}>
          {reason === 'server'
            ? 'Your internet is fine. We can’t reach our servers right now, and this usually passes in a moment.'
            : 'You’re offline. Check your connection and try again.'}
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
    /**
     * flexGrow lets the content container fill the scroll view, which is what
     * makes justifyContent mean anything here - without it the container is only
     * as tall as its children and centring does nothing, which is why this sat
     * against the top of the screen.
     *
     * It still scrolls when the illustration and text are taller than the
     * viewport, so a small phone in landscape can reach the retry button.
     */
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: BG,
  },
  heroZone: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
