import { MIN_TOUCH_TARGET } from '@/lib/designSystem';
import React from 'react';
import { Pressable, View } from 'react-native';
import { AI_ASSISTANT_TEXT } from './aiAssistantTheme';

type AiMenuButtonProps = {
  onPress?: () => void;
};

export default function AiMenuButton({ onPress }: AiMenuButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 22, gap: 5 }}>
        <View
          style={{
            height: 2,
            width: 18,
            borderRadius: 1,
            backgroundColor: AI_ASSISTANT_TEXT.primary,
          }}
        />
        <View
          style={{
            height: 2,
            width: 14,
            borderRadius: 1,
            backgroundColor: AI_ASSISTANT_TEXT.primary,
            marginLeft: 4,
          }}
        />
        <View
          style={{
            height: 2,
            width: 20,
            borderRadius: 1,
            backgroundColor: AI_ASSISTANT_TEXT.primary,
          }}
        />
      </View>
    </Pressable>
  );
}
