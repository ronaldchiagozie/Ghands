import { ArrowRight, Hammer } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing, useReducedMotion } from '@/lib/designSystem';
import { resolveCategoryImageSource } from '@/utils/categoryIcons';

type ResumeBookingModalProps = {
  visible: boolean;
  categoryName?: string;
  jobTitle?: string | null;
  scheduleLabel?: string | null;
  stepLabel: string;
  progress: { done: number; total: number };
  onResume: () => void;
  onDismiss: () => void;
};

/**
 * Offers a half-finished booking back on the way into the app.
 *
 * This interrupts, which is a real cost. An interstitial on launch is the most
 * resented pattern on a phone: it blocks the app to talk about something the
 * person may not have opened it for. Three things are what make it worth it
 * here, and removing any of them would make it the pattern everybody hates:
 *
 *  - It appears once per booking, not once per launch. Dismissing is an answer,
 *    not a snooze.
 *  - It only appears for a booking with real work in it. Tapping a category and
 *    closing the app has cost nothing, so offering that back is an interruption
 *    about nothing.
 *  - Dismissing keeps the draft. The home card is still there, so saying "not
 *    now" costs the customer nothing either.
 *
 * Centred rather than a sheet because it is a question, not a surface to work
 * on, and because a sheet reads as somewhere you were already heading.
 */
export default function ResumeBookingModal({
  visible,
  categoryName,
  jobTitle,
  scheduleLabel,
  stepLabel,
  progress,
  onResume,
  onDismiss,
}: ResumeBookingModalProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.94)).current;
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const service = categoryName?.trim();
  const categoryIcon = resolveCategoryImageSource(service, jobTitle ?? undefined);
  const heading = jobTitle?.trim() || (service ? `${service} booking` : 'Your booking');
  const detail = scheduleLabel?.trim() || stepLabel;

  useEffect(() => {
    if (!visible) {
      scale.setValue(reducedMotion ? 1 : 0.94);
      opacity.setValue(reducedMotion ? 1 : 0);
      return;
    }

    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    /**
     * Settles rather than bounces. This arrives unasked for, and a spring with
     * visible overshoot reads as pleased with itself when the honest tone is
     * "this was kept for you".
     */
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 120,
        friction: 18,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reducedMotion, opacity, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.42)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <Animated.View style={{ width: '100%', opacity, transform: [{ scale }] }}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.xl,
                paddingHorizontal: 22,
                paddingTop: 24,
                paddingBottom: 18,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: Colors.successLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                {categoryIcon ? (
                  <Image
                    source={categoryIcon}
                    style={{ width: 34, height: 34, resizeMode: 'contain' }}
                  />
                ) : (
                  <Hammer size={26} color={Colors.accent} strokeWidth={2} />
                )}
              </View>

              <Text
                style={{
                  fontSize: 19,
                  lineHeight: 26,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.3,
                }}
              >
                Carry on where you stopped?
              </Text>

              <Text
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginTop: 6,
                }}
              >
                {heading}. {detail}.
              </Text>

              <View
                style={{ flexDirection: 'row', gap: 4, marginTop: 18 }}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
              >
                {Array.from({ length: progress.total }).map((_, index) => (
                  <View
                    key={index}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor:
                        index < progress.done ? Colors.accent : 'rgba(79, 103, 57, 0.18)',
                    }}
                  />
                ))}
              </View>

              <Text
                style={{
                  fontSize: 11.5,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.successForeground,
                  marginTop: 7,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {progress.done} of {progress.total} done
              </Text>

              <Pressable
                onPress={onResume}
                accessibilityRole="button"
                accessibilityLabel={`Continue ${heading}`}
                style={{ marginTop: 20 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: Colors.accent,
                    borderRadius: BorderRadius.default,
                    paddingVertical: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.white,
                    }}
                  >
                    Continue booking
                  </Text>
                  <ArrowRight size={17} color={Colors.white} strokeWidth={2.4} />
                </View>
              </Pressable>

              {/**
                * Not "Discard". Saying no here means "not right now", and the
                * draft survives on the home card. Offering to delete somebody's
                * work inside an interruption they did not ask for is the wrong
                * moment to put that button in front of them.
                */}
              <Pressable
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Not now"
                style={{ marginTop: 4 }}
              >
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    Not now
                  </Text>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
