import { ArrowRight, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { SURFACE_STYLES } from '@/lib/surfaceStyles';

type ResumeBookingCardProps = {
  categoryName?: string;
  stepLabel: string;
  onResume: () => void;
  onDiscard: () => void;
};

/**
 * Offers back a booking that was interrupted.
 *
 * The server keeps an unfinished booking as a draft, which is what stopped
 * abandoned taps showing up as pending jobs. But a draft nobody can see is also
 * a draft nobody can finish: whoever got a phone call while picking a time came
 * back to a home screen that behaved as though none of it had happened, and
 * started again from the category.
 *
 * Sage rather than white so it reads as a live thing to act on, against the
 * white cards around it. Dismissing it is as easy as continuing — an offer that
 * cannot be refused becomes clutter by the second day.
 */
export default function ResumeBookingCard({
  categoryName,
  stepLabel,
  onResume,
  onDiscard,
}: ResumeBookingCardProps) {
  const service = categoryName?.trim();

  return (
    <View
      style={{
        ...SURFACE_STYLES.homeCard,
        backgroundColor: Colors.accent,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onResume}
        accessibilityRole="button"
        accessibilityLabel={
          service
            ? `Continue booking ${service}. Next: ${stepLabel}`
            : `Continue your booking. Next: ${stepLabel}`
        }
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      >
        {/**
         * Layout on an inner View, never a function style on the Pressable —
         * NativeWind wraps every element here and flattens those, which is what
         * stacked AccountSetupCard's rows and stripped the alert buttons.
         */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingVertical: 16,
            gap: 14,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                letterSpacing: 0.6,
                color: 'rgba(255,255,255,0.72)',
                marginBottom: 3,
              }}
            >
              PICK UP WHERE YOU LEFT OFF
            </Text>

            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.white,
                letterSpacing: -0.2,
              }}
            >
              {service ? `Your ${service} booking` : 'Your unfinished booking'}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                fontSize: 12.5,
                lineHeight: 18,
                fontFamily: 'Poppins-Regular',
                color: 'rgba(255,255,255,0.82)',
                marginTop: 1,
              }}
            >
              Next: {stepLabel}
            </Text>
          </View>

          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowRight size={18} color={Colors.white} strokeWidth={2.2} />
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={onDiscard}
        accessibilityRole="button"
        accessibilityLabel="Discard this unfinished booking"
        hitSlop={10}
        style={{ position: 'absolute', top: 8, right: 8 }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.4} />
        </View>
      </Pressable>
    </View>
  );
}
