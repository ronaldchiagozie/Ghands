import { AI_COLORS } from '@/components/ai/aiAssistantTheme';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { copyTextToClipboard } from '@/utils/clipboard';
import { Copy, Pencil, User } from 'lucide-react-native';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { AiMessage } from './types';

const USER_BUBBLE_SHADOW =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      }
    : { elevation: 2 };

type AiChatUserBubbleProps = {
  message: AiMessage;
};

export default function AiChatUserBubble({ message }: AiChatUserBubbleProps) {
  const { showSuccess, showError } = useToast();

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
    <View style={{ marginBottom: 20, alignItems: 'flex-end' }}>
      <Text
        style={{
          fontFamily: 'Poppins-Regular',
          fontSize: 11,
          color: AI_COLORS.subtle,
          marginBottom: 6,
          marginRight: 46,
        }}
      >
        You · {message.time}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', maxWidth: '90%' }}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#0B1F28',
              borderRadius: 20,
              borderBottomRightRadius: 6,
              borderWidth: 1,
              borderColor: 'rgba(228, 255, 92, 0.22)',
              paddingHorizontal: 16,
              paddingVertical: 13,
              maxWidth: '100%',
              ...USER_BUBBLE_SHADOW,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 15,
                lineHeight: 22,
                color: AI_COLORS.primary,
              }}
            >
              {message.text}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginRight: 4 }}>
            <Pressable
              onPress={() => void handleCopy()}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
              hitSlop={8}
            >
              <Copy size={14} color={AI_COLORS.muted} />
            </Pressable>
            <Pressable
              onPress={() => haptics.light()}
              accessibilityRole="button"
              accessibilityLabel="Edit message"
              hitSlop={8}
            >
              <Pencil size={14} color={AI_COLORS.muted} />
            </Pressable>
          </View>
        </View>

        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(228, 255, 92, 0.18)',
            borderWidth: 1,
            borderColor: 'rgba(228, 255, 92, 0.35)',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 10,
          }}
        >
          <User size={17} color={AI_COLORS.accent} strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}
