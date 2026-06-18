import AiQuickActionCard from '@/components/ai/AiQuickActionCard';
import { PHONE_LANE_MAX_WIDTH } from '@/lib/tabletLayout';
import React, { useMemo, useRef } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { AI_QUICK_ACTIONS, type AiQuickAction } from './aiAssistantTheme';

const HORIZONTAL_GUTTER = 20;
const CARD_GAP = 12;
const CARD_WIDTH_RATIO = 0.48;
const CAROUSEL_HEIGHT = 142;

type AiQuickActionCarouselProps = {
  onActionPress: (action: AiQuickAction) => void;
};

function resolveLayoutWidth(windowWidth: number) {
  const width = windowWidth > 0 ? windowWidth : Dimensions.get('window').width;
  return Math.min(width, PHONE_LANE_MAX_WIDTH);
}

export default function AiQuickActionCarousel({ onActionPress }: AiQuickActionCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const layoutWidth = resolveLayoutWidth(windowWidth);
  const cardWidth = Math.round(layoutWidth * CARD_WIDTH_RATIO);
  const itemStride = cardWidth + CARD_GAP;

  const snapOffsets = useMemo(
    () => AI_QUICK_ACTIONS.map((_, index) => index * itemStride),
    [itemStride]
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const nearest = snapOffsets.reduce((prev, curr) =>
      Math.abs(curr - x) < Math.abs(prev - x) ? curr : prev
    );
    scrollRef.current?.scrollTo({ x: nearest, animated: true });
  };

  if (cardWidth < 120) {
    return null;
  }

  return (
    <View style={{ paddingBottom: 8 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ height: CAROUSEL_HEIGHT, flexGrow: 0 }}
        contentContainerStyle={{
          paddingHorizontal: HORIZONTAL_GUTTER,
          paddingRight: HORIZONTAL_GUTTER,
        }}
      >
        {AI_QUICK_ACTIONS.map((action) => (
          <View
            key={action.id}
            style={{
              width: cardWidth,
              height: CAROUSEL_HEIGHT,
              marginRight: CARD_GAP,
            }}
          >
            <AiQuickActionCard
              action={action}
              width={cardWidth}
              height={CAROUSEL_HEIGHT}
              onPress={onActionPress}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export { CARD_GAP };
