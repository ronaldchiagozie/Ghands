import { haptics } from '@/hooks/useHaptics';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AI_ASSISTANT_TEXT,
  AI_QUICK_ACTION_CARD,
  type AiQuickAction,
} from './aiAssistantTheme';

type AiQuickActionCardProps = {
  action: AiQuickAction;
  width: number;
  height: number;
  onPress: (action: AiQuickAction) => void;
};

export default function AiQuickActionCard({
  action,
  width,
  height,
  onPress,
}: AiQuickActionCardProps) {
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress(action);
      }}
      accessibilityRole="button"
      accessibilityLabel={action.title}
      accessibilityHint={action.description}
      style={({ pressed }) => ({
        width,
        height,
        maxWidth: width,
        opacity: pressed ? 0.94 : 1,
      })}
    >
      <View
        style={{
          width,
          height,
          maxWidth: width,
          borderRadius: AI_QUICK_ACTION_CARD.borderRadius,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
          backgroundColor: AI_QUICK_ACTION_CARD.background,
          borderWidth: AI_QUICK_ACTION_CARD.borderWidth,
          borderColor: AI_QUICK_ACTION_CARD.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, lineHeight: 22, marginRight: 8 }}>{action.emoji}</Text>
          <Text
            style={{
              flexShrink: 1,
              fontFamily: 'Poppins-SemiBold',
              fontSize: 15,
              lineHeight: 20,
              color: AI_ASSISTANT_TEXT.primary,
            }}
          >
            {action.title}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Poppins-Regular',
            fontSize: 12,
            lineHeight: 18,
            color: 'rgba(255, 255, 255, 0.92)',
          }}
        >
          {action.description}
        </Text>
      </View>
    </Pressable>
  );
}
