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
    router.push({
      pathname: '/AiAssistantScreen' as any,
      params: { newChat: 'true' },
    } as any);
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
          style={({ pressed }) => ({
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: FAB_RADIUS,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <AiSparkleIcon variant="fab" />
        </Pressable>
      </View>
    </View>
  );
}
