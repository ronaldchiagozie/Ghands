import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { runSpring, runTiming } from '@/lib/motion';
import { buildAiSuggestionCopyText, copyTextToClipboard } from '@/utils/clipboard';
import { Copy, Maximize2, Pencil } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { AiSuggestion } from './types';

const USE_DRAFT_LIME = '#E4FF5C';

type AiSuggestionCardProps = {
  suggestion: AiSuggestion;
  visible: boolean;
  onUseDraft: (suggestion: AiSuggestion) => void;
};

export default function AiSuggestionCard({
  suggestion,
  visible,
  onUseDraft,
}: AiSuggestionCardProps) {
  const { showSuccess, showError } = useToast();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion || visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion || visible ? 0 : 40)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(40);
      return;
    }

    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(40);

    runTiming(reducedMotion, opacity, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true,
    });
    runSpring(reducedMotion, translateY, {
      toValue: 0,
      tension: 68,
      friction: 15,
      useNativeDriver: true,
    });
  }, [opacity, reducedMotion, translateY, visible]);

  const handleCopy = async () => {
    haptics.light();
    const copied = await copyTextToClipboard(
      buildAiSuggestionCopyText({
        title: suggestion.title,
        body: suggestion.body,
        previewLabel: suggestion.previewLabel,
        previewValue: suggestion.previewValue,
      }),
    );
    if (copied) {
      showSuccess('Copied to clipboard');
    } else {
      showError('Could not copy suggestion');
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        marginLeft: 44,
        marginRight: 0,
        marginBottom: 10,
        marginTop: -6,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
          shadowColor: '#101828',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 3,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins-Bold',
              fontSize: 16,
              color: '#111827',
            }}
          >
            {suggestion.title}
          </Text>
          <Maximize2 size={16} color="#111827" strokeWidth={2} />
        </View>

        {suggestion.variant === 'booking' && suggestion.previewLabel ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-SemiBold',
                fontSize: 13,
                color: '#111827',
                marginBottom: 8,
              }}
            >
              💡 {suggestion.previewLabel}
            </Text>
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 13,
                color: '#374151',
              }}
            >
              {suggestion.previewValue}
            </Text>
          </View>
        ) : (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 14,
              padding: 14,
              marginBottom: 14,
              minHeight: 108,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 13,
                lineHeight: 20,
                color: '#9CA3AF',
              }}
            >
              {suggestion.body}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            haptics.medium();
            onUseDraft(suggestion);
          }}
          accessibilityRole="button"
          accessibilityLabel={suggestion.ctaLabel}
          style={({ pressed }) => ({
            backgroundColor: '#111827',
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: 'Poppins-SemiBold',
              fontSize: 15,
              color: USE_DRAFT_LIME,
            }}
          >
            {suggestion.ctaLabel}
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 8,
          paddingRight: 4,
        }}
      >
        <Pressable
          onPress={() => void handleCopy()}
          accessibilityRole="button"
          accessibilityLabel="Copy suggestion"
          hitSlop={8}
          style={{ marginRight: 10 }}
        >
          <Copy size={14} color="rgba(255,255,255,0.55)" />
        </Pressable>
        <Pressable
          onPress={() => haptics.light()}
          accessibilityRole="button"
          accessibilityLabel="Edit suggestion"
          hitSlop={8}
        >
          <Pencil size={14} color="rgba(255,255,255,0.55)" />
        </Pressable>
      </View>
    </Animated.View>
  );
}
