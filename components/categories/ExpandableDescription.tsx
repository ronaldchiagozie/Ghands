import { ChevronDown } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';

import { Colors, useReducedMotion } from '@/lib/designSystem';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLLAPSED_LINES = 2;

type ExpandableDescriptionProps = {
  text: string;
  /** Announced on the control, so it says which category it expands. */
  label?: string;
};

/**
 * A category description that stays two lines until somebody wants the rest.
 *
 * The text was pinned to 80% of its column, which wrapped it earlier than it
 * needed to and made every card taller than its content. Full width and two
 * lines gives a row that is the same height whatever the description says, so
 * the list scans as a list rather than a stack of different-sized blocks.
 *
 * The control only appears when there is genuinely more to read, measured from
 * the laid-out text rather than guessed from its length: something that does
 * nothing on half the rows is worse than nothing at all.
 */
export default function ExpandableDescription({ text, label }: ExpandableDescriptionProps) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealShift = useRef(new Animated.Value(-6)).current;
  const chevronSpin = useRef(new Animated.Value(0)).current;

  /**
   * Measured once, while collapsed. onTextLayout reports the lines actually
   * drawn, so more than the cap means the text is being cut off.
   */
  const handleTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (expanded || isTruncated) return;
      if (event.nativeEvent.lines.length > COLLAPSED_LINES) setIsTruncated(true);
    },
    [expanded, isTruncated],
  );

  const toggle = useCallback(() => {
    const next = !expanded;

    if (!reducedMotion) {
      /**
       * The row's height changes, and LayoutAnimation is what makes that a
       * movement rather than a jump. The text sliding in is animated
       * separately, because a height change on its own reads as the card
       * growing while the words simply appear.
       */
      LayoutAnimation.configureNext({
        duration: 220,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.scaleXY,
        },
      });
    }

    setExpanded(next);

    if (reducedMotion) {
      revealOpacity.setValue(next ? 1 : 0);
      revealShift.setValue(0);
      chevronSpin.setValue(next ? 1 : 0);
      return;
    }

    revealOpacity.setValue(next ? 0 : 1);
    revealShift.setValue(next ? -6 : 0);

    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: next ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(revealShift, {
        toValue: next ? 0 : -6,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(chevronSpin, {
        toValue: next ? 1 : 0,
        duration: 200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [expanded, reducedMotion, revealOpacity, revealShift, chevronSpin]);

  const rotate = chevronSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const body = (
    <Text
      onTextLayout={handleTextLayout}
      numberOfLines={expanded ? undefined : COLLAPSED_LINES}
      ellipsizeMode="tail"
      style={{
        fontSize: 12,
        color: Colors.textSecondaryDark,
        lineHeight: 17,
        fontFamily: 'Poppins-Regular',
      }}
    >
      {text}
    </Text>
  );

  return (
    <View style={{ marginBottom: 4 }}>
      {expanded ? (
        <Animated.View style={{ opacity: revealOpacity, transform: [{ translateY: revealShift }] }}>
          {body}
        </Animated.View>
      ) : (
        body
      )}

      {isTruncated ? (
        <Pressable
          onPress={toggle}
          /**
           * The row around this selects the category. React Native gives the
           * touch to the innermost responder, so this claims it explicitly
           * rather than relying on that: reading a description should never
           * also pick the service.
           */
          onStartShouldSetResponder={() => true}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded
              ? `Show less${label ? ` about ${label}` : ''}`
              : `Read more${label ? ` about ${label}` : ''}`
          }
          hitSlop={8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <Text style={{ fontSize: 11.5, fontFamily: 'Poppins-Medium', color: Colors.accent }}>
              {expanded ? 'Less' : 'More'}
            </Text>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <ChevronDown size={13} color={Colors.accent} strokeWidth={2.4} />
            </Animated.View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
