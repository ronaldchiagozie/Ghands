import { AI_ANIMATION, AI_CHAT_UI, AI_COLORS } from '@/components/ai/aiAssistantTheme';
import { useRevealText } from '@/hooks/useRevealText';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { copyTextToClipboard } from '@/utils/clipboard';
import { Image } from 'expo-image';
import { Copy } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import AiChatTypingDots from './AiChatTypingDots';
import type { AiMessage } from './types';

const AI_BOT_AVATAR = require('../../../ghandsaibothappy.png');

const BOT_BUBBLE_SHADOW =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0B1220',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      }
    : { elevation: 3 };

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
  const { showSuccess, showError } = useToast();
  const shouldReveal = Boolean(message.revealText && message.text.length > 0);
  const { displayText, isComplete } = useRevealText(
    message.text,
    shouldReveal,
    AI_ANIMATION.revealCharMs
  );

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

  const handleCopy = async () => {
    haptics.light();
    const copied = await copyTextToClipboard(message.text);
    if (copied) {
      showSuccess('Copied to clipboard');
    } else {
      showError('Could not copy message');
    }
  };

  return (
    <View style={{ marginBottom: 20, alignItems: 'flex-start' }}>
      {isTypingPlaceholder ? null : (
        <Text
          style={{
            fontFamily: 'Poppins-Regular',
            fontSize: 11,
            color: AI_COLORS.subtle,
            marginBottom: 6,
            marginLeft: 46,
          }}
        >
          {message.time}
        </Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', maxWidth: '90%' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            overflow: 'hidden',
            marginRight: 10,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <Image source={AI_BOT_AVATAR} contentFit="cover" style={{ width: 36, height: 36 }} />
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={
              isTypingPlaceholder
                ? {
                    backgroundColor: AI_CHAT_UI.typingBubble.background,
                    borderRadius: AI_CHAT_UI.typingBubble.borderRadius,
                    paddingHorizontal: AI_CHAT_UI.typingBubble.paddingHorizontal,
                    paddingVertical: AI_CHAT_UI.typingBubble.paddingVertical,
                    minWidth: AI_CHAT_UI.typingBubble.minWidth,
                    ...BOT_BUBBLE_SHADOW,
                  }
                : {
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    borderBottomLeftRadius: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    ...BOT_BUBBLE_SHADOW,
                  }
            }
          >
            {isTypingPlaceholder ? (
              <AiChatTypingDots />
            ) : (
              <Text
                style={{
                  fontFamily: 'Poppins-Regular',
                  fontSize: 15,
                  lineHeight: 22,
                  color: '#0F172A',
                }}
              >
                {shouldReveal ? displayText : message.text}
              </Text>
            )}
          </View>

          {!isTypingPlaceholder && message.text.length > 0 ? (
            <Pressable
              onPress={() => void handleCopy()}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
              hitSlop={8}
              style={{ marginTop: 8, marginLeft: 4 }}
            >
              <Copy size={14} color={AI_COLORS.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
