import { AI_CHAT_UI, AI_COLORS } from '@/components/ai/aiAssistantTheme';
import { haptics } from '@/hooks/useHaptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { runSpring, runTiming } from '@/lib/motion';
import { buildAiSuggestionCopyText, copyTextToClipboard } from '@/utils/clipboard';
import { Copy, HandHelping, Maximize2, Pencil } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { AiSuggestion } from './types';

const S = AI_CHAT_UI.suggestion;

type AiSuggestionCardProps = {
  /** Reports a copy result up to the chat screen, which owns the toast - a toast rendered in here would be pinned inside this bubble. */
  onNotify?: (type: 'success' | 'error', message: string) => void;
  suggestion: AiSuggestion;
  visible: boolean;
  onUseDraft: (suggestion: AiSuggestion) => void;
};

export default function AiSuggestionCard({
  suggestion,
  visible,
  onUseDraft,
  onNotify,
}: AiSuggestionCardProps) {
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
      onNotify?.('success', 'Copied to clipboard');
    } else {
      onNotify?.('error', 'Could not copy suggestion');
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
          backgroundColor: S.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: S.previewBorder,
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
              flex: 1,
              fontFamily: 'Poppins-Bold',
              fontSize: 16,
              color: S.title,
              marginRight: 8,
            }}
          >
            {suggestion.title}
          </Text>
          <Maximize2 size={16} color={S.previewLabel} strokeWidth={2} />
        </View>

        {suggestion.variant === 'booking' && suggestion.previewLabel ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: S.previewBorder,
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
              backgroundColor: S.previewBg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              {/**
                * The booking Handy is proposing, so it gets Handy's own mark.
                * A lightbulb here was the other half of the sparkle: the
                * universal "the AI had an idea" glyph, which says something
                * about the technology and nothing about the job being booked.
                */}
              <HandHelping size={15} color={AI_COLORS.accentInk} strokeWidth={2.2} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'Poppins-SemiBold',
                  fontSize: 13,
                  color: S.previewLabel,
                }}
              >
                {suggestion.previewLabel}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 13,
                lineHeight: 20,
                color: S.body,
              }}
            >
              {suggestion.previewValue}
            </Text>
          </View>
        ) : (
          <View
            style={{
              borderWidth: 1,
              borderColor: S.previewBorder,
              borderRadius: 14,
              padding: 14,
              marginBottom: 14,
              minHeight: 108,
              backgroundColor: S.previewBg,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
                lineHeight: 22,
                color: S.body,
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
          android_ripple={{ color: 'rgba(255, 255, 255, 0.14)', borderless: false }}
        >
          {/**
            * Visuals on the inner View, never on the Pressable. NativeWind
            * flattens a function style here and drops it silently, which is
            * how the chat history list lost its cards.
            */}
          <View
            style={{
              backgroundColor: S.ctaBg,
              borderRadius: 999,
              paddingVertical: 14,
              paddingHorizontal: 20,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
          <Text
            style={{
              fontFamily: 'Poppins-SemiBold',
              fontSize: 16,
              lineHeight: 22,
              color: S.ctaText,
              textAlign: 'center',
            }}
          >
            {suggestion.ctaLabel}
          </Text>
          </View>
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
          <Copy size={16} color={S.footerIcon} strokeWidth={2} />
        </Pressable>
        <Pressable
          onPress={() => haptics.light()}
          accessibilityRole="button"
          accessibilityLabel="Edit suggestion"
          hitSlop={8}
        >
          <Pencil size={16} color={S.footerIcon} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
