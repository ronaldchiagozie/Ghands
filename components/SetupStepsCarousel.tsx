import { ArrowRight, Clock } from 'lucide-react-native';
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
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>{title}</Text>
        <Text
          style={{ fontSize: 12, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark, fontVariant: ['tabular-nums'] }}
        >
          {done} of {total} done
        </Text>
      </View>
      {subtitle ? (
        <Text style={{ fontSize: 12.5, lineHeight: 18, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginTop: 2 }}>
          {subtitle}
        </Text>
      ) : null}
      <View
        style={{ height: 4, borderRadius: 2, backgroundColor: Colors.backgroundGray, marginTop: 10, marginBottom: 12, overflow: 'hidden' }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: done }}
      >
        <View style={{ width: `${Math.max(progress * 100, 3)}%`, height: '100%', borderRadius: 2, backgroundColor: Colors.accent }} />
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
          renderItem={({ item, index: position }) => (
            <StepCard step={item} width={cardWidth} position={position + 1} count={steps.length} />
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

function StepCard({ step, width, position, count }: { step: SetupStep; width: number; position: number; count: number }) {
  const review = step.status === 'review';
  const Icon = review ? Clock : step.icon;
  const pressable = !review && !!step.onPress;

  const body = (
    <View style={{ width, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 14, backgroundColor: Colors.white, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            backgroundColor: review ? REVIEW_BG : Colors.successLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Icon size={16} color={review ? REVIEW_FG : Colors.accent} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{ flex: 1, fontSize: 14, lineHeight: 19, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}
              numberOfLines={1}
            >
              {step.title}
            </Text>
            <Text
              style={{ marginLeft: 6, fontSize: 10.5, fontFamily: 'Poppins-Medium', color: review ? REVIEW_FG : Colors.textTertiary }}
            >
              {review ? 'In review' : `${position} of ${count}`}
            </Text>
          </View>
          <Text
            style={{ fontSize: 12, lineHeight: 17, fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark }}
            numberOfLines={1}
          >
            {step.description}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 10,
          height: 34,
          borderRadius: 9,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          backgroundColor: review ? REVIEW_BG : pressable ? Colors.accent : Colors.backgroundGray,
        }}
      >
        <Text
          style={{
            fontSize: 12.5,
            fontFamily: 'Poppins-SemiBold',
            color: review ? REVIEW_FG : pressable ? Colors.white : Colors.textSecondaryDark,
          }}
        >
          {review ? 'Waiting for review' : step.actionLabel}
        </Text>
        {pressable ? <ArrowRight size={14} color={Colors.white} strokeWidth={2.2} /> : null}
      </View>
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
      accessibilityLabel={`${step.title}. ${step.description}. ${step.actionLabel}`}
      android_ripple={{ color: Colors.backgroundGray, borderless: false }}
    >
      {body}
    </Pressable>
  );
}
