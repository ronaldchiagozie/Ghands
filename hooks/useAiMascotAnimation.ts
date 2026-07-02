import { AI_ANIMATION } from '@/components/ai/aiAssistantTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export function useAiMascotAnimation() {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 40)).current;
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.8)).current;
  const rotateX = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const floatLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [entranceComplete, setEntranceComplete] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setEntranceComplete(true);
      return;
    }

    const bounceIn = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: AI_ANIMATION.mascotEntranceMs,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: AI_ANIMATION.mascotEntranceMs,
        easing: Easing.out(Easing.bounce),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: AI_ANIMATION.mascotEntranceMs,
        easing: Easing.out(Easing.bounce),
        useNativeDriver: true,
      }),
    ]);

    bounceIn.start(({ finished }) => {
      if (!finished) return;

      Animated.timing(rotateX, {
        toValue: 1,
        duration: AI_ANIMATION.mascotSomersaultMs,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished: flipFinished }) => {
        if (!flipFinished) return;

        setEntranceComplete(true);

        floatLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(floatY, {
              toValue: -AI_ANIMATION.mascotFloatDistance,
              duration: AI_ANIMATION.mascotFloatHalfMs,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(floatY, {
              toValue: 0,
              duration: AI_ANIMATION.mascotFloatHalfMs,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        floatLoopRef.current.start();
      });
    });

    return () => {
      bounceIn.stop();
      floatLoopRef.current?.stop();
    };
  }, [floatY, opacity, reducedMotion, rotateX, scale, translateY]);

  const rotateXDeg = rotateX.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animatedStyle = {
    opacity,
    transform: [
      { perspective: 800 },
      { translateY: Animated.add(translateY, floatY) },
      { scale },
      { rotateX: rotateXDeg },
    ],
  };

  return { animatedStyle, entranceComplete };
}
