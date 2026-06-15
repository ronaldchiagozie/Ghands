import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { Colors, runParallel, useReducedMotion } from '@/lib/designSystem';
import { useNarrowOverlayMaxWidth } from '@/lib/tabletLayout';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void; // Optional - will use no-op function if not provided
  visible: boolean;
}

const TOAST_CONFIG = {
  success: {
    bgColor: Colors.white,
    borderColor: '#BBF7D0',
    textColor: Colors.success,
    icon: 'checkmark-circle' as const,
    iconColor: Colors.successIcon,
  },
  error: {
    bgColor: Colors.white,
    borderColor: '#FECACA',
    textColor: Colors.errorForeground,
    icon: 'close-circle' as const,
    iconColor: Colors.errorBright,
  },
  info: {
    bgColor: Colors.white,
    borderColor: '#BFDBFE',
    textColor: '#1E40AF',
    icon: 'information-circle' as const,
    iconColor: '#3B82F6',
  },
  warning: {
    bgColor: Colors.white,
    borderColor: '#FDE68A',
    textColor: Colors.warningForeground,
    icon: 'warning' as const,
    iconColor: Colors.warning,
  },
};

export default function Toast({ message, type = 'info', duration = 3000, onClose, visible }: ToastProps) {
  const toastMaxWidth = useNarrowOverlayMaxWidth(32);
  // Ensure onClose is always a function
  const safeOnClose = onClose || (() => {});
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        slideAnim.setValue(0);
        opacityAnim.setValue(1);
      } else {
        runParallel(reducedMotion, [
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]);
      }

      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      handleClose();
    }
  }, [visible, duration, reducedMotion]);

  const handleClose = () => {
    if (reducedMotion) {
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
      safeOnClose();
      return;
    }

    runParallel(reducedMotion, [
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ], () => {
      safeOnClose();
    });
  };

  if (!visible) return null;

  const config = TOAST_CONFIG[type];

  return (
    <View
      className="absolute top-12 left-4 right-4 z-50"
      style={{
        pointerEvents: 'box-none',
      }}
    >
      <Animated.View
        style={{
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        }}
      >
        <View
          className="rounded-2xl px-4 py-4 flex-row items-center shadow-lg"
          style={{
            backgroundColor: config.bgColor,
            borderWidth: 1,
            borderColor: config.borderColor,
            maxWidth: toastMaxWidth,
            alignSelf: 'center',
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons name={config.icon} size={24} color={config.iconColor} />
          <Text
            className="flex-1 ml-3 text-sm"
            style={{
              fontFamily: 'Poppins-Medium',
              color: config.textColor,
            }}
            maxFontSizeMultiplier={1.35}
          >
            {message}
          </Text>
          <TouchableOpacity onPress={handleClose} className="ml-2" activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={config.textColor} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

