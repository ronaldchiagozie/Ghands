import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, Fonts, Spacing, runSpring, runTiming, useReducedMotion } from '@/lib/designSystem';

interface AnimatedStatusChipProps {
  status: string;
  statusColor: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  variant?: 'chip' | 'text';
  /** Fully rounded pill (timeline badges, etc.) */
  pill?: boolean;
}

/**
 * Animated status chip with smooth color and scale transitions
 * Used for job states, booking status, etc.
 */
export default function AnimatedStatusChip({
  status,
  statusColor,
  textColor,
  size = 'medium',
  animated = true,
  variant = 'chip',
  pill = false,
}: AnimatedStatusChipProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animated && !reducedMotion;

  useEffect(() => {
    if (shouldAnimate) {
      runSpring(reducedMotion, scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      });

      runTiming(reducedMotion, colorAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      });
    } else {
      scaleAnim.setValue(1);
      colorAnim.setValue(1);
    }
  }, [shouldAnimate, scaleAnim, colorAnim, reducedMotion]);

  const scale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const sizeStyles = {
    small: {
      paddingHorizontal: Spacing.xs + 2,
      paddingVertical: Spacing.xs,
      fontSize: 10,
    },
    medium: {
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: Spacing.xs + 2,
      fontSize: 12,
    },
    large: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 14,
    },
  };

  const currentSize = sizeStyles[size];

  const isTextOnly = variant === 'text';

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          backgroundColor: isTextOnly ? 'transparent' : statusColor,
          transform: [{ scale }],
          borderRadius: isTextOnly ? 0 : pill ? BorderRadius.full : BorderRadius.default,
          borderWidth: pill && !isTextOnly ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: pill && !isTextOnly ? 'rgba(45, 65, 24, 0.12)' : 'transparent',
        },
        currentSize,
        isTextOnly
          ? {
              paddingHorizontal: 0,
              paddingVertical: 0,
              alignSelf: 'flex-start',
            }
          : null,
      ]}
    >
      <Text
        style={[
          Fonts.label,
          {
            color: textColor || Colors.textPrimary,
            fontSize: currentSize.fontSize,
          },
        ]}
      >
        {status}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
  },
});



