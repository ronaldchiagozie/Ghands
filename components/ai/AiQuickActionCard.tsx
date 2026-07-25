import { haptics } from '@/hooks/useHaptics';
import { FileText, Search } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AI_ASSISTANT_TEXT,
  AI_COLORS,
  AI_QUICK_ACTION_CARD,
  type AiQuickAction,
  type AiQuickActionIcon,
} from './aiAssistantTheme';

const QUICK_ACTION_ICONS: Record<
  AiQuickActionIcon,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  service: Search,
  describe: FileText,
};

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
  const Icon = QUICK_ACTION_ICONS[action.icon];

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
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: 'rgba(228, 255, 92, 0.28)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Icon size={18} color={AI_COLORS.accent} strokeWidth={2.2} />
          </View>
          <Text
            style={{
              flex: 1,
              flexShrink: 1,
              fontFamily: 'Poppins-SemiBold',
              fontSize: 14,
              lineHeight: 19,
              color: AI_ASSISTANT_TEXT.primary,
            }}
            numberOfLines={2}
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
