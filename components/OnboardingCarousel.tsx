import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { SlideData } from '../lib/assets';
import OnboardingSlide from './OnboardingSlide';
import { Colors } from '../lib/designSystem';
import { motionDuration, runParallel, runTiming, useReducedMotion } from '../lib/designSystem';
import { PHONE_LANE_MAX_WIDTH, useIsTablet } from '@/lib/tabletLayout';

interface OnboardingCarouselProps {
  slides: SlideData[];
  currentIndex: number;
  onSlideChange: (index: number) => void;
  onNext: () => void;
  onSkip: () => void;
  isLastSlide: boolean;
}

export default function OnboardingCarousel({
  slides,
  currentIndex,
  onSlideChange,
  onNext,
  onSkip,
  isLastSlide,
}: OnboardingCarouselProps) {
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = useIsTablet();
  /** Measured phone-lane (tablet) or full screen — must match slide width or carousel looks “crooked” */
  const [lane, setLane] = useState<{ w: number; h: number } | null>(null);
  const contentW = lane?.w ?? (isTablet ? Math.min(winW, PHONE_LANE_MAX_WIDTH) : winW);
  const contentH = lane?.h ?? winH;
  /** Slide layout height excludes bottom controls + carousel padding so text isn’t clipped */
  const ONBOARDING_CONTROLS_RESERVE = 138;
  const slideHeight = Math.max(420, contentH - ONBOARDING_CONTROLS_RESERVE);
  const translateX = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setLane((prev) => {
      if (prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5) return prev;
      return { w: width, h: height };
    });
  };

  useEffect(() => {
    const target = -currentIndex * contentW;
    runTiming(reducedMotion, translateX, {
      toValue: target,
      duration: 400,
      useNativeDriver: true,
    });
  }, [currentIndex, contentW, translateX, reducedMotion]);

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {/* Skip Button - Top Right */}
      <Pressable style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.carouselContainer}>
        <Animated.View
          style={[
            styles.slidesContainer,
            {
              width: slides.length * contentW,
              height: slideHeight,
              transform: [{ translateX }],
            },
          ]}
        >
          {slides.map((slide, index) => (
            <OnboardingSlide
              key={slide.id}
              slide={slide}
              isActive={index === currentIndex}
              contentWidth={contentW}
              contentHeight={slideHeight}
            />
          ))}
        </Animated.View>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.paginationContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.pill,
                index === currentIndex ? styles.pillActive : styles.pillInactive,
              ]}
            />
          ))}
        </View>

        <Pressable style={styles.ctaButton} onPress={onNext}>
          <Text style={styles.ctaText}>{isLastSlide ? 'Get Started' : 'Next'}</Text>
          {!isLastSlide && <ChevronRight size={18} color={Colors.black} style={{ marginLeft: 8 }} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E07',
  },
  skipButton: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 14, 7, 0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 0.76,
  },
  skipText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  carouselContainer: {
    flex: 1,
  },
  slidesContainer: {
    flexDirection: 'row',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  pill: {
    height: 8,
    borderRadius: 4,
  },
  pillActive: {
    width: 32,
    backgroundColor: Colors.accent,
  },
  pillInactive: {
    width: 8,
    backgroundColor: '#1B5E20',
  },
  ctaButton: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 0.76,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.black,
  },
});
