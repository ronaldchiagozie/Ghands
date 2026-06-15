import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { BorderRadius, Colors, Spacing, useReducedMotion } from '@/lib/designSystem';

interface AnimatedModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'slide' | 'fade';
  dismissible?: boolean;
  /** Backdrop darkness — default 0.38 */
  backdropOpacity?: number;
  /** Minimum sheet height as % of screen — default 75 */
  minHeightPercent?: number;
}

/**
 * Animated modal component with smooth slide-up animation
 * Similar to Uber/Airbnb modal behavior
 */
export default function AnimatedModal({
  visible,
  onClose,
  children,
  animationType = 'slide',
  dismissible = true,
  backdropOpacity = 0.38,
  minHeightPercent = 75,
}: AnimatedModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      const target = visible ? 1 : 0;
      slideAnim.setValue(target);
      fadeAnim.setValue(target);
      backdropAnim.setValue(target);
      return;
    }

    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim, backdropAnim, reducedMotion]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const scale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
              backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
            },
          ]}
        >
          {dismissible && (
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            { minHeight: `${minHeightPercent}%` },
            animationType === 'slide'
              ? {
                  transform: [{ translateY }, { scale }],
                  opacity: fadeAnim,
                }
              : {
                  opacity: fadeAnim,
                },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    backgroundColor: Colors.backgroundLight,
    borderTopLeftRadius: BorderRadius.default,
    borderTopRightRadius: BorderRadius.default,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    maxHeight: '95%',
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
});



