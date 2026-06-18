import AiChatTypingDots from '@/components/ai/chat/AiChatTypingDots';
import React from 'react';
import { Image, View } from 'react-native';
import { Colors } from '@/lib/designSystem';

type ChatTypingBubbleProps = {
  isProviderView: boolean;
};

export default function ChatTypingBubble({ isProviderView }: ChatTypingBubbleProps) {
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
        <Image
          source={
            isProviderView
              ? require('../../assets/images/userimg.jpg')
              : require('../../assets/images/plumbericon2.png')
          }
          style={{ width: 28, height: 28, borderRadius: 14 }}
          resizeMode="cover"
        />
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
