import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { SlideData } from '../lib/assets';
import OnboardingSlide from './OnboardingSlide';
import {
  BorderRadius,
  Colors,
  MIN_TOUCH_TARGET,
  TOUCH_HIT_SLOP,
  runTiming,
  useReducedMotion,
} from '../lib/designSystem';
import { PHONE_LANE_MAX_WIDTH, useIsTablet } from '@/lib/tabletLayout';

interface OnboardingCarouselProps {
  slides: SlideData[];
  currentIndex: number;
  onSlideChange: (index: number) => void;
  onNext: () => void;
  onSkip: () => void;
  isLastSlide: boolean;
}

/** Fraction of the lane a drag must cover to commit to the next slide. */
const SWIPE_COMMIT_RATIO = 0.22;
/** Velocity that commits a slide change even on a short flick. */
const SWIPE_COMMIT_VELOCITY = 0.35;
/** Resistance applied when dragging past the first or last slide. */
const EDGE_RESISTANCE = 0.3;

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
  const insets = useSafeAreaInsets();
  /** Measured phone-lane (tablet) or full screen — must match slide width or carousel looks “crooked” */
  const [lane, setLane] = useState<{ w: number; h: number } | null>(null);
  const contentW = lane?.w ?? (isTablet ? Math.min(winW, PHONE_LANE_MAX_WIDTH) : winW);
  const contentH = lane?.h ?? winH;
  /** Slide layout height excludes bottom controls + carousel padding so text isn’t clipped */
  const ONBOARDING_CONTROLS_RESERVE = 138;
  const slideHeight = Math.max(420, contentH - ONBOARDING_CONTROLS_RESERVE);
  const translateX = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  /** True mid-drag so the incoming slide is rendered visible instead of blank. */
  const [dragging, setDragging] = useState(false);

  /** Pan handlers are built once — read live values through refs. */
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;
  const contentWRef = useRef(contentW);
  contentWRef.current = contentW;
  const slideCountRef = useRef(slides.length);
  slideCountRef.current = slides.length;
  const dragBaseRef = useRef(0);

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

  const panResponder = useMemo(
    () => {
      const snapBack = () => {
        runTiming(reducedMotion, translateX, {
          toValue: -indexRef.current * contentWRef.current,
          duration: 220,
          useNativeDriver: true,
        });
      };

      return PanResponder.create({
        // Horizontal intent only, so vertical drags and taps still reach their targets.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragBaseRef.current = -indexRef.current * contentWRef.current;
          translateX.stopAnimation((value: number) => {
            dragBaseRef.current = value;
          });
          setDragging(true);
        },
        onPanResponderMove: (_e, g) => {
          const atStart = indexRef.current === 0 && g.dx > 0;
          const atEnd = indexRef.current === slideCountRef.current - 1 && g.dx < 0;
          const dx = atStart || atEnd ? g.dx * EDGE_RESISTANCE : g.dx;
          translateX.setValue(dragBaseRef.current + dx);
        },
        onPanResponderRelease: (_e, g) => {
          setDragging(false);
          const index = indexRef.current;
          const committed =
            Math.abs(g.dx) > contentWRef.current * SWIPE_COMMIT_RATIO ||
            Math.abs(g.vx) > SWIPE_COMMIT_VELOCITY;

          let next = index;
          if (committed && g.dx < 0) next = Math.min(index + 1, slideCountRef.current - 1);
          else if (committed && g.dx > 0) next = Math.max(index - 1, 0);

          // A real index change lets the currentIndex effect drive the settle animation.
          if (next !== index) onSlideChange(next);
          else snapBack();
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          snapBack();
        },
      });
    },
    [translateX, onSlideChange, reducedMotion],
  );

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {/* Skip Button - Top Right */}
      <Pressable
        style={[styles.skipButton, { top: insets.top + 8 }]}
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip onboarding"
        hitSlop={TOUCH_HIT_SLOP}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.carouselContainer} {...panResponder.panHandlers}>
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
              revealed={dragging && Math.abs(index - currentIndex) === 1}
              contentWidth={contentW}
              contentHeight={slideHeight}
            />
          ))}
        </Animated.View>
      </View>

      <View style={[styles.controlsContainer, { bottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.paginationContainer}>
          {slides.map((slide, index) => (
            <Pressable
              key={slide.id}
              onPress={() => onSlideChange(index)}
              hitSlop={{ top: 18, bottom: 18, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${index + 1} of ${slides.length}`}
              accessibilityState={{ selected: index === currentIndex }}
              style={[
                styles.pill,
                index === currentIndex ? styles.pillActive : styles.pillInactive,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={styles.ctaButton}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={isLastSlide ? 'Get started' : 'Next slide'}
        >
          <Text style={styles.ctaText}>{isLastSlide ? 'Get Started' : 'Next'}</Text>
          {!isLastSlide && (
            <ChevronRight size={18} color={Colors.white} style={{ marginLeft: 8 }} />
          )}
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
    right: 20,
    zIndex: 10,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(10, 14, 7, 0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
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
    borderRadius: BorderRadius.full,
  },
  pillActive: {
    width: 32,
    backgroundColor: Colors.accent,
  },
  pillInactive: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  ctaButton: {
    width: '100%',
    height: 46,
    borderRadius: BorderRadius.default,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
  },
});
