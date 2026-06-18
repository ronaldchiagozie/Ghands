import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { AI_CAROUSEL_PAGINATION } from './aiAssistantTheme';

type AiCarouselPaginationProps = {
  scrollX: Animated.Value;
  itemCount: number;
  itemStride: number;
  trackWidth: number;
  style?: StyleProp<ViewStyle>;
};

export default function AiCarouselPagination({
  scrollX,
  itemCount,
  itemStride,
  trackWidth,
  style,
}: AiCarouselPaginationProps) {
  const reducedMotion = useReducedMotion();
  const segmentWidth = itemCount > 0 ? trackWidth / itemCount : trackWidth;
  const maxOffset = Math.max(itemStride * (itemCount - 1), 1);

  const indicatorX = scrollX.interpolate({
    inputRange: [0, maxOffset],
    outputRange: [0, segmentWidth * Math.max(itemCount - 1, 0)],
    extrapolate: 'clamp',
  });

  const fallbackIndex = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      fallbackIndex.setValue(0);
    }
  }, [fallbackIndex, reducedMotion]);

  const translateX = reducedMotion ? fallbackIndex : indicatorX;

  return (
    <View
      style={[
        {
          marginTop: AI_CAROUSEL_PAGINATION.marginTop,
          alignSelf: 'stretch',
        },
        style,
      ]}
    >
      <View
        style={{
          height: AI_CAROUSEL_PAGINATION.trackHeight,
          borderRadius: AI_CAROUSEL_PAGINATION.trackHeight,
          backgroundColor: AI_CAROUSEL_PAGINATION.trackColor,
          overflow: 'hidden',
        }}
      >
        {itemCount > 1 ? (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: segmentWidth,
              height: AI_CAROUSEL_PAGINATION.trackHeight,
              borderRadius: AI_CAROUSEL_PAGINATION.trackHeight,
              backgroundColor: AI_CAROUSEL_PAGINATION.indicatorColor,
              transform: [{ translateX }],
            }}
          />
        ) : (
          <View
            style={{
              width: segmentWidth,
              height: AI_CAROUSEL_PAGINATION.trackHeight,
              borderRadius: AI_CAROUSEL_PAGINATION.trackHeight,
              backgroundColor: AI_CAROUSEL_PAGINATION.indicatorColor,
            }}
          />
        )}
      </View>
    </View>
  );
}
