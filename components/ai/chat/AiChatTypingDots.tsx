import { AI_COLORS } from '@/components/ai/aiAssistantTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

export default function AiChatTypingDots() {
  const reducedMotion = useReducedMotion();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
      return;
    }

    const animateDot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: -3,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 120);
    const a3 = animateDot(dot3, 240);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3, reducedMotion]);

  const dots = [dot1, dot2, dot3];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 4, height: 18 }}>
      {dots.map((translateY, index) => (
        <Animated.View
          key={index}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: AI_COLORS.accent,
            transform: [{ translateY }],
            marginRight: index < dots.length - 1 ? 6 : 0,
          }}
        />
      ))}
    </View>
  );
}
