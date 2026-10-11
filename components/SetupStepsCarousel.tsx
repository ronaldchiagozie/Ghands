import { ChevronRight, Clock } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { Colors } from '@/lib/designSystem';

/**
 * What is left to set up, one step per card, swiped through sideways.
 * Identical in both apps.
 *
 * It replaces a column of rows that all said the same thing - five "Needed
 * before you can accept jobs" stacked into one tall block, which read as a
 * form to fill in rather than a few quick things to do. Each card now says
 * what the step is for and has its own button, and the next card peeks in
 * from the edge so it is obvious there are more.
 */

export type SetupStepIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type SetupStep = {
  key: string;
  title: string;
  /** One short line on what it is for - it is not wrapped, so keep it under ~32 characters. */
  description: string;
  icon: SetupStepIcon;
  /** The verb on the button: "Add details", "Start scan". */
  actionLabel: string;
  /** `review`: submitted and waiting on someone else; nothing to press. */
  status: 'todo' | 'review';
  /** Listed but not required; labelled so, instead of a step number. */
  optional?: boolean;
  onPress?: () => void;
};

type Props = {
  title: string;
  subtitle?: string;
  done: number;
  total: number;
  steps: SetupStep[];
  /**
   * The page's side margin. The row runs out to the screen edge by this much,
   * so the next card peeks in from the edge of the phone rather than being cut
   * off at the margin, while the first card still lines up with the page.
   */
  bleed?: number;
};

/** The share of the row one card takes, so the next one shows at the edge. */
const CARD_SHARE = 0.75;
/** On a tablet 75% of the row is far wider than a card needs to be. */
const MAX_CARD_WIDTH = 320;
const GAP = 12;

const REVIEW_BG = '#FFF7DF';
const REVIEW_FG = '#92400E';
const HAIRLINE = '#E5E7EB';

export function SetupStepsCarousel({ title, subtitle, done, total, steps, bleed = 0 }: Props) {
  const [rowWidth, setRowWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const single = steps.length === 1;
  const cardWidth = rowWidth
    ? single
      ? rowWidth
      : Math.min(Math.round(rowWidth * CARD_SHARE), MAX_CARD_WIDTH)
    : 0;
  const interval = cardWidth + GAP;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setRowWidth(Math.round(e.nativeEvent.layout.width));
  }, []);

  if (steps.length === 0) return null;
  const progress = total > 0 ? done / total : 0;

  return (
    <View style={{ marginBottom: 22 }} onLayout={onLayout}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            fontSize: 16,
            fontFamily: 'Poppins-Bold',
            color: Colors.textPrimary,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
        {/**
          * The count as a chip rather than loose grey text. It is the one
          * number in the section and it was drifting at the end of the line,
          * the same weight and colour as the sentence underneath it.
          */}
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: Colors.successLight,
          }}
        >
          <Text
            style={{
              fontSize: 11.5,
              fontFamily: 'Poppins-SemiBold',
              color: Colors.accent,
              fontVariant: ['tabular-nums'],
            }}
          >
            {done} of {total}
          </Text>
        </View>
      </View>
      {subtitle ? (
        <Text style={{ fontSize: 12.5, lineHeight: 18, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 3 }}>
          {subtitle}
        </Text>
      ) : null}
      {/**
        * Rounded at both ends, including the filled part, so a bar at ten per
        * cent reads as a small amount of progress rather than a chipped
        * sliver. A minimum width keeps it visible at zero.
        */}
      <View
        style={{ height: 5, borderRadius: 999, backgroundColor: Colors.backgroundGray, marginTop: 12, marginBottom: 14, overflow: 'hidden' }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
      >
        <View style={{ width: `${Math.max(progress * 100, 4)}%`, height: '100%', borderRadius: 999, backgroundColor: Colors.accent }} />
      </View>

      {cardWidth > 0 ? (
        <FlatList
          horizontal
          data={steps}
          keyExtractor={(step) => step.key}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!single}
          style={{ marginHorizontal: -bleed }}
          contentContainerStyle={{ paddingHorizontal: bleed }}
          snapToInterval={interval}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            /** The last card can not scroll a full step, so reaching the end counts as it. */
            const atEnd = contentOffset.x + layoutMeasurement.width >= contentSize.width - 2;
            const next = atEnd ? steps.length - 1 : Math.round(contentOffset.x / interval);
            if (next !== index && next >= 0 && next < steps.length) setIndex(next);
          }}
          scrollEventThrottle={32}
          renderItem={({ item }) => (
            <StepCard step={item} width={cardWidth} />
          )}
        />
      ) : null}

      {steps.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 }} accessibilityElementsHidden>
          {steps.map((step, i) => (
            <View
              key={step.key}
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? Colors.accent : '#D1D5DB',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StepCard({ step, width }: { step: SetupStep; width: number }) {
  const review = step.status === 'review';
  const Icon = review ? Clock : step.icon;
  const pressable = !review && !!step.onPress;

  /**
   * One row, and the row is the button.
   *
   * Each card used to carry a full-width filled green button under the text,
   * which made a card this size mostly button - and the button said "Add
   * photo" directly beneath a title that said "Add a profile photo". Two
   * thirds of the card was spent repeating the top third in a louder voice,
   * and an optional step ended up shouting harder than anything else on the
   * home screen.
   *
   * A chevron is the honest weight for it: it says the row goes somewhere
   * without claiming to be the most important thing on the page, it is the
   * convention everywhere else a list leads to a screen, and it halves the
   * height so more than one step is readable at a glance.
   */
  const body = (
    <View
      style={{
        width,
        borderWidth: 1,
        borderColor: HAIRLINE,
        borderRadius: 16,
        backgroundColor: Colors.white,
        paddingVertical: 13,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: review ? REVIEW_BG : Colors.successLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 11,
        }}
      >
        <Icon size={18} color={review ? REVIEW_FG : Colors.accent} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 19,
            fontFamily: 'Poppins-SemiBold',
            color: Colors.textPrimary,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {step.title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 17,
            fontFamily: 'Poppins-Regular',
            color: Colors.textSecondaryDark,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {step.description}
        </Text>
      </View>

      {/**
        * Only real state earns a label here. The counter this replaced said
        * "1 of 1" on a single card, under a header already reading "5 of 6
        * done" - a number that could only ever agree with itself.
        */}
      {review ? (
        <View
          style={{
            marginLeft: 10,
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: REVIEW_BG,
          }}
        >
          <Text style={{ fontSize: 10.5, fontFamily: 'Poppins-SemiBold', color: REVIEW_FG }}>
            In review
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
          {step.optional ? (
            <Text
              style={{
                fontSize: 10.5,
                fontFamily: 'Poppins-Medium',
                color: Colors.textTertiary,
                marginRight: 6,
              }}
            >
              Optional
            </Text>
          ) : null}
          {pressable ? (
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: Colors.successLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={15} color={Colors.accent} strokeWidth={2.4} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  if (!pressable) {
    return <View accessibilityLabel={`${step.title}. ${step.description}`}>{body}</View>;
  }
  /** Visuals on the inner View: NativeWind drops a Pressable's own layout styles. */
  return (
    <Pressable
      onPress={step.onPress}
      accessibilityRole="button"
      /** The action verb lives here now that the button it sat on is gone. */
      accessibilityLabel={`${step.title}. ${step.description}. ${step.actionLabel}`}
      android_ripple={{ color: Colors.backgroundGray, borderless: false }}
    >
      {body}
    </Pressable>
  );
}
