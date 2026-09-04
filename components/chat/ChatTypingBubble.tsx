import AiChatTypingDots from '@/components/ai/chat/AiChatTypingDots';
import React from 'react';
import { View } from 'react-native';
import { Colors } from '@/lib/designSystem';
import { AvatarCircle } from '@/components/AvatarCircle';

type ChatTypingBubbleProps = {
  isProviderView: boolean;
  /** The other party's name, for initials when they have no photo. */
  counterpartName?: string;
};

export default function ChatTypingBubble({
  isProviderView,
  counterpartName,
}: ChatTypingBubbleProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 8,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          overflow: 'hidden',
          marginRight: 8,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <AvatarCircle name={counterpartName} size={28} borderColor="transparent" />
      </View>

      <View
        style={{
          backgroundColor: Colors.white,
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: 'rgba(17, 24, 39, 0.045)',
          minWidth: 64,
        }}
      >
        <AiChatTypingDots />
      </View>
    </View>
  );
}
