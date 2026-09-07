import { ArrowRight, Clock, Hammer } from 'lucide-react-native';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';
import { resolveCategoryImageSource } from '@/utils/categoryIcons';

type ResumeBookingCardProps = {
  categoryName?: string;
  /** What they wrote, when they got as far as writing it. */
  jobTitle?: string | null;
  /** The day they picked, already formatted, when they picked one. */
  scheduleLabel?: string | null;
  stepLabel: string;
  progress: { done: number; total: number };
  /** Hours until the draft is deleted, only once that is close. */
  hoursLeft?: number | null;
  onResume: () => void;
  onDiscard: () => void;
};

/**
 * The booking somebody was in the middle of.
 *
 * Rebuilt from a solid sage banner that said "PICK UP WHERE YOU LEFT OFF" and
 * nothing else. Three things were wrong with it.
 *
 * It shouted. A block of accent colour is the loudest thing the home screen
 * can do, and it sat directly above the setup checklist, so two cards competed
 * for the same attention. An unfinished booking is an invitation, not an alert,
 * so this is a sage tint on white: distinct from the white card below without
 * outranking everything around it.
 *
 * It was generic. "Your unfinished booking" describes any booking. This shows
 * the one they made: the trade's own icon, the title they typed, the day they
 * chose. Recognising your own job takes no reading.
 *
 * It hid the progress. The step was named but the position was not, so there
 * was no way to tell a booking one tap from done from one barely started. The
 * segments are discrete on purpose, because the steps are: "three of four" is
 * something you can hold in your head, and a percentage is not.
 */
export default function ResumeBookingCard({
  categoryName,
  jobTitle,
  scheduleLabel,
  stepLabel,
  progress,
  hoursLeft,
  onResume,
  onDiscard,
}: ResumeBookingCardProps) {
  const service = categoryName?.trim();
  const categoryIcon = resolveCategoryImageSource(service, jobTitle ?? undefined);

  const heading = jobTitle?.trim() || (service ? `${service} booking` : 'Your booking');
  const detail = scheduleLabel?.trim() || stepLabel;

  return (
    <View
      style={{
        ...SURFACE_STYLES.homeCard,
        backgroundColor: Colors.successLight,
        borderColor: 'rgba(79, 103, 57, 0.22)',
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onResume}
        accessibilityRole="button"
        accessibilityLabel={`Continue ${heading}. ${progress.done} of ${progress.total} steps done. Next: ${stepLabel}`}
        android_ripple={{ color: 'rgba(79, 103, 57, 0.10)' }}
      >
        {/**
         * Layout on an inner View, never a function style on the Pressable.
         * NativeWind wraps every element here and flattens those, which is what
         * stacked AccountSetupCard's rows and stripped the alert buttons.
         */}
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                backgroundColor: Colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {categoryIcon ? (
                <Image
                  source={categoryIcon}
                  style={{ width: 26, height: 26, resizeMode: 'contain' }}
                />
              ) : (
                <Hammer size={20} color={Colors.accent} strokeWidth={2} />
              )}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 15.5,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  letterSpacing: -0.2,
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
                  color: Colors.successForeground,
                  marginTop: 1,
                }}
              >
                {detail}
              </Text>
            </View>
          </View>

          {/**
            * One segment per step, filled to where they stopped. Segments rather
            * than a bar because you can count them, and counting is the thing
            * that tells you whether finishing is worth starting now.
            */}
          <View
            style={{ flexDirection: 'row', gap: 4, marginTop: 14 }}
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

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontFamily: 'Poppins-Medium',
                color: Colors.successForeground,
                fontVariant: ['tabular-nums'],
              }}
            >
              {progress.done} of {progress.total} done
            </Text>

            {/**
              * Only when it is close. A countdown running from twenty hours is
              * pressure applied to somebody who has done nothing wrong; a few
              * hours before it disappears is something they would want to know.
              */}
            {hoursLeft != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Clock size={11} color={Colors.textSecondaryDark} strokeWidth={2.2} />
                <Text
                  style={{
                    fontSize: 11.5,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  {hoursLeft}h left
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg,
            paddingTop: 12,
            paddingBottom: 12,
            marginTop: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(79, 103, 57, 0.16)',
          }}
        >
          {/**
            * A labelled control, not the 26px X this replaces. Discarding now
            * deletes the draft on the server rather than hiding it, and a
            * destructive action sitting unlabelled in the corner of a tappable
            * card is one somebody hits by accident reaching for the card.
            */}
          <Pressable
            onPress={onDiscard}
            accessibilityRole="button"
            accessibilityLabel="Discard this booking"
            hitSlop={10}
          >
            <View style={{ paddingVertical: 4, paddingRight: 12 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textSecondaryDark,
                }}
              >
                Discard
              </Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontSize: 13.5,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.accent,
              }}
            >
              Continue
            </Text>
            <ArrowRight size={16} color={Colors.accent} strokeWidth={2.4} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
