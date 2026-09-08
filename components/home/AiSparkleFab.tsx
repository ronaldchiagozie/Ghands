import AiSparkleIcon from '@/components/icons/AiSparkleIcon';
import { haptics } from '@/hooks/useHaptics';
import { useBottomTabBarHeight } from '@/lib/tabletLayout';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

const FAB_SIZE = 64;
const FAB_RADIUS = FAB_SIZE / 2;
const FAB_TAB_OVERLAP = 18;
const FAB_RIGHT_INSET = 12;
const FAB_FILL = '#003D4D';

const FAB_SHADOW =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#002028',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.34,
        shadowRadius: 16,
      }
    : { elevation: 16 };

export default function AiSparkleFab() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();

  const handlePress = useCallback(() => {
    haptics.light();
    /**
     * Deliberately no newChat flag.
     *
     * This button used to send one, and it is the way almost everybody opens
     * Handy - so the screen wiped the remembered conversation and greeted them
     * from scratch every single time. The code that reopens the last thread
     * was sitting right underneath, unreachable, because the only door into
     * the room announced itself as a new conversation.
     *
     * Asking for nothing lets the screen decide: it reopens what you were in
     * the middle of, and falls back to a greeting when there is nothing recent
     * worth reopening. Starting fresh on purpose still lives in the history
     * drawer, where somebody who wants it goes looking.
     */
    router.push('/AiAssistantScreen' as any);
  }, [router]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: FAB_RIGHT_INSET,
        bottom: tabBarHeight - FAB_TAB_OVERLAP,
        zIndex: 100,
      }}
    >
      <View
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_RADIUS,
          backgroundColor: FAB_FILL,
          alignItems: 'center',
          justifyContent: 'center',
          ...FAB_SHADOW,
        }}
      >
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Open AI assistant"
          accessibilityHint="Get help with support questions and image analysis"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={StyleSheet.absoluteFillObject}
        >
          {/**
            * Centring on a plain View. It lived in a function style on the
            * Pressable, which NativeWind flattens - so the mark was only ever
            * centred by luck of the icon filling the button.
            */}
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: FAB_RADIUS,
            }}
          >
            <AiSparkleIcon variant="fab" />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
