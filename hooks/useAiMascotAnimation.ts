import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

const ENTRANCE_MS = 600;
const SOMERSAULT_MS = 500;
const FLOAT_HALF_MS = 1500;
const FLOAT_DISTANCE = 6;

export function useAiMascotAnimation() {
  const reducedMotion = useReducedMotion();
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
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTRANCE_MS,
        easing: Easing.out(Easing.bounce),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: ENTRANCE_MS,
        easing: Easing.out(Easing.bounce),
        useNativeDriver: true,
      }),
    ]);

    bounceIn.start(({ finished }) => {
      if (!finished) return;

      Animated.timing(rotateX, {
        toValue: 1,
        duration: SOMERSAULT_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished: flipFinished }) => {
        if (!flipFinished) return;

        setEntranceComplete(true);

        floatLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(floatY, {
              toValue: -FLOAT_DISTANCE,
              duration: FLOAT_HALF_MS,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(floatY, {
              toValue: 0,
              duration: FLOAT_HALF_MS,
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
  }, [floatY, reducedMotion, rotateX, scale, translateY]);

  const rotateXDeg = rotateX.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animatedStyle = {
    transform: [
      { perspective: 800 },
      { translateY: Animated.add(translateY, floatY) },
      { scale },
      { rotateX: rotateXDeg },
    ],
  };

  return { animatedStyle, entranceComplete };
}
