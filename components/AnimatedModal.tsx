import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Spacing, useReducedMotion } from '@/lib/designSystem';
import { applyDefaultStatusBar } from '@/utils/statusBar';

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
  /** Lifts sheet above the keyboard (email/forms) */
  keyboardAware?: boolean;
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
  keyboardAware = false,
}: AnimatedModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible || !keyboardAware) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      const windowHeight = Dimensions.get('window').height;
      setKeyboardInset(Math.max(0, windowHeight - event.endCoordinates.screenY));
    };
    const onHide = () => setKeyboardInset(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      setKeyboardInset(0);
    };
  }, [visible, keyboardAware]);

  useEffect(() => {
    if (!visible) {
      applyDefaultStatusBar();
      return;
    }
    return () => {
      applyDefaultStatusBar();
    };
  }, [visible]);

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

  const sheetBottomPad = keyboardInset > 0 ? keyboardInset + 8 : Math.max(insets.bottom, Spacing.lg);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {dismissible ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={StyleSheet.absoluteFill}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  opacity: backdropAnim,
                  backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
                },
              ]}
            />
          </Pressable>
        ) : (
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.backdrop,
              {
                opacity: backdropAnim,
                backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
              },
            ]}
          />
        )}

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.content,
            styles.contentAboveBackdrop,
            keyboardAware ? styles.contentFit : styles.contentTall,
            !keyboardAware && { minHeight: `${minHeightPercent}%` },
            keyboardAware && { paddingBottom: sheetBottomPad },
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
          <View pointerEvents="auto" style={styles.sheetInner}>
          {keyboardAware ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.keyboardScroll}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
          </View>
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
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  contentAboveBackdrop: {
    zIndex: 2,
    elevation: 8,
  },
  contentTall: {
    width: '100%',
  },
  sheetInner: {
    flex: 1,
    width: '100%',
  },
  contentFit: {
    maxHeight: '70%',
    width: '100%',
  },
  keyboardScroll: {
    flexGrow: 1,
    paddingBottom: Spacing.sm,
  },
});

