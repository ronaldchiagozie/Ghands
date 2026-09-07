import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AI_COLORS } from './aiAssistantTheme';

/**
 * What Handy shows while it is working.
 *
 * A stock spinner is the same grey ring every app on the phone draws, and it
 * appeared twice on the one screen that is meant to feel like its own thing:
 * connecting to Handy, and reopening a conversation. Both are moments where
 * somebody is waiting on the assistant specifically, which makes them the
 * moments most worth spending design on rather than the least.
 *
 * Two rings turning against each other around a core that breathes. The
 * counter-rotation is what stops it reading as a spinner: a single ring going
 * one way is a wait, two rings working against each other is something
 * thinking.
 */

type AiThinkingOrbProps = {
  size?: number;
  /** Sits under the orb in the assistant's own voice. Optional. */
  label?: string;
};

const OUTER_SPIN_MS = 1700;
const INNER_SPIN_MS = 2400;
const BREATH_MS = 1500;

export default function AiThinkingOrb({ size = 72, label }: AiThinkingOrbProps) {
  const reducedMotion = useReducedMotion();
  const outer = useRef(new Animated.Value(0)).current;
  const inner = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      outer.setValue(0);
      inner.setValue(0);
      breath.setValue(0.5);
      return;
    }

    const spin = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

    /**
     * The core breathes on its own clock rather than following either ring, so
     * the three never quite line up and the whole thing avoids the mechanical
     * feel of something on a single timer.
     */
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const animations = [spin(outer, OUTER_SPIN_MS), spin(inner, INNER_SPIN_MS), pulse];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [breath, inner, outer, reducedMotion]);

  const clockwise = outer.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  /** Against the outer ring, which is the whole trick. */
  const anticlockwise = inner.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  const coreScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.12] });
  const coreOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] });
  const haloScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.04] });

  const centre = size / 2;
  const outerRadius = centre - 3;
  const innerRadius = centre - 13;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/** A soft bloom that widens as the core shrinks, so the orb reads as breathing out. */}
        <Animated.View
          style={{
            position: 'absolute',
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: size,
            backgroundColor: AI_COLORS.neonGreen,
            opacity: reducedMotion ? 0.12 : haloOpacity,
            transform: reducedMotion ? undefined : [{ scale: haloScale }],
          }}
        />

        <Animated.View
          style={{
            position: 'absolute',
            transform: reducedMotion ? undefined : [{ rotate: clockwise }],
          }}
        >
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id="handyOrbOuter" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={AI_COLORS.neonGreen} stopOpacity="1" />
                <Stop offset="1" stopColor={AI_COLORS.accent} stopOpacity="0.35" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={centre}
              cy={centre}
              r={outerRadius}
              stroke="url(#handyOrbOuter)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              /** A third of the ring drawn, which leaves the turn legible. */
              strokeDasharray={`${outerCircumference * 0.32} ${outerCircumference}`}
            />
          </Svg>
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            transform: reducedMotion ? undefined : [{ rotate: anticlockwise }],
          }}
        >
          <Svg width={size} height={size}>
            <Circle
              cx={centre}
              cy={centre}
              r={innerRadius}
              stroke={AI_COLORS.accent}
              strokeOpacity={0.75}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${innerCircumference * 0.2} ${innerCircumference}`}
            />
          </Svg>
        </Animated.View>

        <Animated.View
          style={{
            width: size * 0.2,
            height: size * 0.2,
            borderRadius: size,
            backgroundColor: AI_COLORS.primary,
            opacity: reducedMotion ? 0.9 : coreOpacity,
            transform: reducedMotion ? undefined : [{ scale: coreScale }],
          }}
        />
      </View>

      {label ? (
        <Text
          style={{
            marginTop: 16,
            fontFamily: 'Poppins-Medium',
            fontSize: 13.5,
            letterSpacing: 0.1,
            color: AI_COLORS.subtle,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
