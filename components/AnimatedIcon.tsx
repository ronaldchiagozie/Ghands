import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { DESIGN_TOKENS } from '../lib/assets';
import { runTiming, useReducedMotion } from '../lib/designSystem';

interface AnimatedIconProps {
  icon: 'location' | 'tracking' | 'booking';
  size?: number;
  color?: string;
  animate?: boolean;
}

const ICON_MAP = {
  'location': '◎',
  'tracking': '●',
  'booking': '✓',
};

export default function AnimatedIcon({ 
  icon, 
  size = 40, 
  color = DESIGN_TOKENS.colors.accent,
  animate = true 
}: AnimatedIconProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (animate && !reducedMotion) {
      const pulseAnimation = () => {
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]).start(() => pulseAnimation());
      };

      pulseAnimation();
    } else {
      scaleAnim.setValue(1);
    }

    runTiming(reducedMotion, opacityAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });
  }, [animate, scaleAnim, opacityAnim, reducedMotion]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View 
        style={{ 
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        <View
          style={{
            width: size + 20,
            height: size + 20,
            backgroundColor: 'rgba(216, 255, 46, 0.15)',
            borderRadius: (size + 20) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'rgba(216, 255, 46, 0.4)',
          }}
        >
          <Text
            style={{
              fontSize: size * 0.7,
              color: color,
              fontWeight: 'bold',
            }}
          >
            {ICON_MAP[icon]}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}