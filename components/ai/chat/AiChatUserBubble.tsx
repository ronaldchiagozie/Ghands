import { haptics } from '@/hooks/useHaptics';
import { Copy, Pencil, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AiMessage } from './types';

type AiChatUserBubbleProps = {
  message: AiMessage;
};

export default function AiChatUserBubble({ message }: AiChatUserBubbleProps) {
  return (
    <View style={{ marginBottom: 18, alignItems: 'flex-end' }}>
      <Text
        style={{
          fontFamily: 'Poppins-Regular',
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.72)',
          marginBottom: 6,
          marginRight: 44,
        }}
      >
        You {message.time}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', maxWidth: '92%' }}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#111827',
              borderRadius: 18,
              borderBottomRightRadius: 6,
              paddingHorizontal: 14,
              paddingVertical: 12,
              maxWidth: '100%',
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
                lineHeight: 21,
                color: '#FFFFFF',
              }}
            >
              {message.text}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginRight: 2 }}>
            <Pressable
              onPress={() => haptics.light()}
              accessibilityRole="button"
              accessibilityLabel="Copy message"
              hitSlop={8}
            >
              <Copy size={14} color="rgba(255,255,255,0.55)" />
            </Pressable>
            <Pressable
              onPress={() => haptics.light()}
              accessibilityRole="button"
              accessibilityLabel="Edit message"
              hitSlop={8}
            >
              <Pencil size={14} color="rgba(255,255,255,0.55)" />
            </Pressable>
          </View>
        </View>

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: '#2563EB',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 10,
          }}
        >
          <User size={16} color="#FFFFFF" strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}
