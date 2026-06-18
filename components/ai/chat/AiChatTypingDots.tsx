import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

export default function AiChatTypingDots() {
  const reducedMotion = useReducedMotion();
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (reducedMotion) {
      dot1.setValue(1);
      dot2.setValue(1);
      dot3.setValue(1);
      return;
    }

    const animateDot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 360,
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
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      {dots.map((opacity, index) => (
        <Animated.View
          key={index}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: '#111827',
            opacity,
            marginRight: index < dots.length - 1 ? 6 : 0,
          }}
        />
      ))}
    </View>
  );
}
