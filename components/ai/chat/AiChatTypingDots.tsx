import { AI_CHAT_UI } from '@/components/ai/aiAssistantTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * Handy thinking.
 *
 * Three dots that only changed opacity, which from a arm's length away is
 * three dots doing nothing. They travel now: each one lifts, grows and
 * brightens in turn, a beat behind the one before it, so the movement reads as
 * a wave crossing the bubble rather than three lights blinking.
 *
 * The stagger is the whole effect. Evenly spaced starts would give a
 * metronome; holding each dot down for most of the cycle and passing the lift
 * along gives something closer to breathing.
 */

const DOT_SIZE = 8;
const DOT_GAP = 9;
const CYCLE_MS = 1150;
/** How far into the cycle each dot begins, as a fraction. */
const STAGGER = 0.16;
const LIFT = 5;

export default function AiChatTypingDots() {
  const reducedMotion = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      wave.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, wave]);

  const colors = AI_CHAT_UI.typingDots;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: DOT_SIZE + LIFT * 2,
      }}
    >
      {colors.map((baseColor, index) => {
        /**
         * One shared clock, read at three offsets. Each dot's window is short
         * and the rest of its cycle sits at rest, which is what keeps the
         * three from looking like they are pulsing together.
         */
        const start = index * STAGGER;
        const input = [0, start, start + 0.12, start + 0.26, 1];

        const translateY = wave.interpolate({
          inputRange: input,
          outputRange: [0, 0, -LIFT, 0, 0],
        });
        const scale = wave.interpolate({
          inputRange: input,
          outputRange: [1, 1, 1.32, 1, 1],
        });
        const opacity = wave.interpolate({
          inputRange: input,
          outputRange: [0.4, 0.4, 1, 0.4, 0.4],
        });

        return (
          <Animated.View
            key={baseColor}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: baseColor,
              marginRight: index < colors.length - 1 ? DOT_GAP : 0,
              opacity: reducedMotion ? 1 : opacity,
              transform: reducedMotion ? undefined : [{ translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}
