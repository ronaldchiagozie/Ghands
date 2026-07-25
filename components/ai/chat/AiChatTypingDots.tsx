import { AI_CHAT_UI } from '@/components/ai/aiAssistantTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const DOT_SIZE = 8;
const DOT_GAP = 9;

export default function AiChatTypingDots() {
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);

  const colors = AI_CHAT_UI.typingDots;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: DOT_SIZE,
      }}
    >
      {colors.map((baseColor, index) => {
        const opacity = pulse.interpolate({
          inputRange: [0, 0.33, 0.66, 1],
          outputRange:
            index === 0
              ? [1, 0.55, 0.55, 1]
              : index === 1
                ? [0.55, 1, 0.55, 0.55]
                : [0.55, 0.55, 1, 0.55],
        });

        return (
          <Animated.View
            key={baseColor}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: baseColor,
              opacity: reducedMotion ? 1 : opacity,
              marginRight: index < colors.length - 1 ? DOT_GAP : 0,
            }}
          />
        );
      })}
    </View>
  );
}
