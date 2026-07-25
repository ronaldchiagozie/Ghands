import { haptics } from '@/hooks/useHaptics';
import { MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { runTiming } from '@/lib/motion';
import { Plus, Send } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, TextInput, View } from 'react-native';
import { AI_ASSISTANT_GLASS, AI_ASSISTANT_TEXT, AI_COLORS } from './aiAssistantTheme';

type AiPromptInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onAttachPress?: () => void;
  onSend?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  compact?: boolean;
};

export default function AiPromptInput({
  value,
  onChangeText,
  onAttachPress,
  onSend,
  onFocus,
  onBlur,
  compact = false,
}: AiPromptInputProps) {
  const reducedMotion = useReducedMotion();
  const sendOpacity = useRef(new Animated.Value(value.trim() ? 1 : 0)).current;
  const canSend = value.trim().length > 0;

  useEffect(() => {
    runTiming(reducedMotion, sendOpacity, {
      toValue: canSend ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    });
  }, [canSend, reducedMotion, sendOpacity]);

  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: AI_ASSISTANT_GLASS.border,
        backgroundColor: AI_ASSISTANT_GLASS.inputBackground,
        minHeight: compact ? 96 : 128,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 12,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Type a prompt..."
        placeholderTextColor={AI_ASSISTANT_TEXT.placeholder}
        multiline
        textAlignVertical="top"
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={() => {
          if (canSend) onSend?.();
        }}
        style={{
          minHeight: compact ? 52 : 72,
          paddingRight: 44,
          paddingBottom: 36,
          fontFamily: 'Poppins-Regular',
          fontSize: 15,
          lineHeight: 22,
          color: AI_ASSISTANT_TEXT.primary,
        }}
      />
      <Pressable
        onPress={() => {
          haptics.light();
          onAttachPress?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Add attachment"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: 'absolute',
          left: 16,
          bottom: 12,
          width: MIN_TOUCH_TARGET,
          height: MIN_TOUCH_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={22} color={AI_ASSISTANT_TEXT.primary} strokeWidth={2.2} />
      </Pressable>

      <Animated.View
        pointerEvents={canSend ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          opacity: sendOpacity,
        }}
      >
        <Pressable
          onPress={() => {
            if (!canSend) return;
            haptics.selection();
            onSend?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={{
            width: MIN_TOUCH_TARGET,
            height: MIN_TOUCH_TARGET,
            borderRadius: MIN_TOUCH_TARGET / 2,
            backgroundColor: canSend ? AI_COLORS.accent : 'rgba(255, 255, 255, 0.18)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={18} color={canSend ? AI_COLORS.accentInk : AI_ASSISTANT_TEXT.primary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}
