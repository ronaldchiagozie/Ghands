import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NoInternetScreen from '@/components/NoInternetScreen';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { isPublicUnauthenticatedRoute } from '@/utils/authPublicRoutes';

/**
 * App-wide offline gate — same No Internet UI on every tab/screen (not per-tab empty states).
 */
export default function GlobalOfflineOverlay() {
  const { isOnline, isInitialized, recheck } = useNetworkConnectivity();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!isInitialized || isOnline) return null;

  // Cold start / splash: avoid flashing offline before first NetInfo read on entry routes.
  if (pathname === '/' || pathname === '/index') return null;

  if (isPublicUnauthenticatedRoute(pathname)) return null;

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        styles.overlay,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
      pointerEvents="auto"
      accessibilityViewIsModal
    >
      <NoInternetScreen onRetry={recheck} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9999,
    elevation: Platform.OS === 'android' ? 9999 : undefined,
    backgroundColor: '#F9F9F7',
  },
});
