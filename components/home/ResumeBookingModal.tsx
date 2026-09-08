import { BlurView } from 'expo-blur';
import { ArrowRight, Check } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors, useReducedMotion } from '@/lib/designSystem';
import { getCategoryIcon } from '@/utils/categoryIcons';

type ResumeBookingModalProps = {
  visible: boolean;
  categoryName?: string;
  jobTitle?: string | null;
  scheduleLabel?: string | null;
  stepLabel: string;
  /** Named steps, so the timeline says what each one was. */
  steps: string[];
  progress: { done: number; total: number };
  onResume: () => void;
  onDismiss: () => void;
};

const GLASS_SURFACE = 'rgba(255, 255, 255, 0.82)';
const GLASS_EDGE = 'rgba(255, 255, 255, 0.66)';
const TRACK = 'rgba(79, 103, 57, 0.20)';

/**
 * Offers a half-finished booking back on the way into the app.
 *
 * It interrupts, which is a real cost, so it is gated hard: once per booking,
 * never for one barely started, and saying no keeps the draft. Those rules live
 * in bookingResume; this is only the surface.
 *
 * Glass rather than a solid card. The point of frosting the backdrop instead of
 * blacking it out is that the app stays visible underneath: this reads as a
 * note laid over what you were doing rather than a wall put in front of it,
 * which is the honest weight for something you can wave away.
 */
export default function ResumeBookingModal({
  visible,
  categoryName,
  jobTitle,
  scheduleLabel,
  stepLabel,
  steps,
  progress,
  onResume,
  onDismiss,
}: ResumeBookingModalProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.94)).current;
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const service = categoryName?.trim();
  /**
   * The trade's own icon, by the same route every other list uses: painted
   * artwork where there is some, a drawn glyph where there is not, initials
   * only for a name that means nothing.
   *
   * This used to reach for the painted artwork alone and fall back to a
   * hammer, so a booking for any of the trades nobody has painted was offered
   * back under a generic tool - the one card that has to be recognisably
   * theirs, showing the one icon that belongs to nobody.
   */
  const CategoryIcon = getCategoryIcon(service, jobTitle ?? undefined);
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
     * that something was kept for them.
     */
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 190,
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
      <BlurView
        intensity={Platform.OS === 'android' ? 40 : 26}
        tint="dark"
        /** Android has no native backdrop blur without this. */
        experimentalBlurMethod="dimezisBlurView"
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={{
            flex: 1,
            /**
             * A little darkness under the blur, not instead of it. Blur alone
             * leaves light content underneath too bright to read the card over.
             */
            backgroundColor: 'rgba(12, 16, 10, 0.28)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 26,
          }}
        >
          <Animated.View style={{ width: '100%', opacity, transform: [{ scale }] }}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View
                style={{
                  backgroundColor: GLASS_SURFACE,
                  borderRadius: 26,
                  borderWidth: 1,
                  borderColor: GLASS_EDGE,
                  paddingHorizontal: 22,
                  paddingTop: 24,
                  paddingBottom: 16,
                  shadowColor: '#0B0F08',
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.22,
                  shadowRadius: 30,
                  elevation: 12,
                  overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255, 255, 255, 0.78)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.9)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <CategoryIcon />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 17,
                        fontFamily: 'Poppins-Bold',
                        color: Colors.textPrimary,
                        letterSpacing: -0.3,
                      }}
                    >
                      {heading}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12.5,
                        lineHeight: 18,
                        fontFamily: 'Poppins-Regular',
                        color: Colors.textSecondaryDark,
                        marginTop: 1,
                      }}
                    >
                      {detail}
                    </Text>
                  </View>
                </View>

                {/**
                  * A timeline rather than a bar. The booking is a route with
                  * named stops, so the shape that tells the truth is the one
                  * that shows which stops are behind you and what the next one
                  * is called.
                  */}
                <View style={{ marginTop: 20, marginBottom: 4 }}>
                  {steps.map((label, index) => {
                    const done = index < progress.done;
                    const current = index === progress.done;
                    const last = index === steps.length - 1;

                    return (
                      <View key={label} style={{ flexDirection: 'row' }}>
                        <View style={{ width: 22, alignItems: 'center' }}>
                          <View
                            style={{
                              width: done || current ? 18 : 12,
                              height: done || current ? 18 : 12,
                              borderRadius: 9,
                              marginTop: done || current ? 0 : 3,
                              backgroundColor: done ? Colors.accent : 'transparent',
                              borderWidth: current ? 2.5 : done ? 0 : 2,
                              borderColor: current ? Colors.accent : TRACK,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {done ? <Check size={11} color={Colors.white} strokeWidth={3.2} /> : null}
                          </View>
                          {!last ? (
                            <View
                              style={{
                                width: 2,
                                flex: 1,
                                minHeight: 14,
                                backgroundColor: done ? Colors.accent : TRACK,
                                marginVertical: 2,
                              }}
                            />
                          ) : null}
                        </View>

                        <Text
                          style={{
                            flex: 1,
                            fontSize: 13,
                            lineHeight: 18,
                            fontFamily: current ? 'Poppins-SemiBold' : 'Poppins-Regular',
                            color: current
                              ? Colors.textPrimary
                              : done
                                ? Colors.successForeground
                                : Colors.textTertiary,
                            marginLeft: 10,
                            paddingBottom: last ? 0 : 10,
                          }}
                        >
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Pressable
                  onPress={onResume}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue ${heading}`}
                  style={{ marginTop: 18 }}
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
                      style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.white }}
                    >
                      Continue booking
                    </Text>
                    <ArrowRight size={17} color={Colors.white} strokeWidth={2.4} />
                  </View>
                </Pressable>

                {/**
                  * Not "Discard". Saying no here means "not right now", and the
                  * draft is waiting in Jobs. Offering to delete somebody's work
                  * inside an interruption they did not ask for is the wrong
                  * moment to put that in front of them.
                  */}
                <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Not now">
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
      </BlurView>
    </Modal>
  );
}
