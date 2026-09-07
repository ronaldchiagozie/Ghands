import { Colors } from '@/lib/designSystem';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Shown while tab auth gates or token guards resolve - never leave a blank screen. */
export function ScreenBootLoader() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.white,
      }}
    >
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}
