import { useRevealText } from '@/hooks/useRevealText';
import { haptics } from '@/hooks/useHaptics';
import { Image } from 'expo-image';
import { Copy } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import AiChatTypingDots from './AiChatTypingDots';
import type { AiMessage } from './types';

const AI_BOT_AVATAR = require('../../../ghandsaibothappy.png');

type AiChatBotBubbleProps = {
  message: AiMessage;
  isTypingPlaceholder?: boolean;
  onRevealComplete?: (messageId: string) => void;
};

export default function AiChatBotBubble({
  message,
  isTypingPlaceholder = false,
  onRevealComplete,
}: AiChatBotBubbleProps) {
  const shouldReveal = Boolean(message.revealText && message.text.length > 0);
  const { displayText, isComplete } = useRevealText(message.text, shouldReveal, 16);

  useEffect(() => {
    if (isTypingPlaceholder) return;
    if (shouldReveal && isComplete) {
      onRevealComplete?.(message.id);
      return;
    }
    if (!shouldReveal && message.text.length > 0) {
      onRevealComplete?.(message.id);
    }
  }, [isComplete, isTypingPlaceholder, message.id, message.text.length, onRevealComplete, shouldReveal]);

  return (
    <View style={{ marginBottom: 18, alignItems: 'flex-start' }}>
      <Text
        style={{
          fontFamily: 'Poppins-Regular',
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.72)',
          marginBottom: 6,
          marginLeft: 44,
        }}
      >
        {message.time}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', maxWidth: '92%' }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            overflow: 'hidden',
            marginRight: 10,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Image source={AI_BOT_AVATAR} contentFit="cover" style={{ width: 34, height: 34 }} />
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              borderBottomLeftRadius: 6,
              paddingHorizontal: 14,
              paddingVertical: isTypingPlaceholder ? 10 : 12,
              minWidth: isTypingPlaceholder ? 72 : undefined,
            }}
          >
            {isTypingPlaceholder ? (
              <AiChatTypingDots />
            ) : (
              <Text
                style={{
                  fontFamily: 'Poppins-Regular',
                  fontSize: 14,
                  lineHeight: 21,
                  color: '#111827',
                }}
              >
                {shouldReveal ? displayText : message.text}
              </Text>
            )}
          </View>

          {!isTypingPlaceholder && message.text.length > 0 ? (
            <Pressable
              onPress={() => haptics.light()}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
              hitSlop={8}
              style={{ marginTop: 6, marginLeft: 2 }}
            >
              <Copy size={14} color="rgba(255,255,255,0.55)" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
