import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { SlideData } from '../lib/assets';
import { Colors, runParallel, runTiming, useReducedMotion } from '../lib/designSystem';

interface OnboardingSlideProps {
  slide: SlideData;
  isActive: boolean;
  /** True while a swipe is in flight and this is the incoming slide. */
  revealed?: boolean;
  /** When set (e.g. tablet phone lane), use instead of full window — fixes clipped / crooked slides */
  contentWidth?: number;
  contentHeight?: number;
}

export default function OnboardingSlide({
  slide,
  isActive,
  revealed = false,
  contentWidth,
  contentHeight,
}: OnboardingSlideProps) {
  const win = useWindowDimensions();
  const windowWidth = contentWidth ?? win.width;
  const windowHeight = contentHeight ?? win.height;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleSlideAnim = useRef(new Animated.Value(30)).current;
  const descSlideAnim = useRef(new Animated.Value(30)).current;
  const reducedMotion = useReducedMotion();
  /** Tracks whether the text is already on screen, so a committed swipe doesn't re-run the entrance. */
  const isVisibleRef = useRef(false);

  const styles = useMemo(() => {
    const isSmallScreen = windowWidth < 375;
    const isMediumScreen = windowWidth >= 375 && windowWidth < 414;
    const scale = isSmallScreen ? 0.85 : isMediumScreen ? 0.92 : 1.0;

    return StyleSheet.create({
      root: {
        flex: 1,
        width: windowWidth,
        height: windowHeight,
      },
      heroZone: {
        /**
         * The illustration is the whole point of the slide, so it gets the room.
         * It was rendering at 78% width inside a zone with 7% top padding, which
         * left it small against a large field of black.
         */
        height: windowHeight * 0.64,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        paddingTop: windowHeight * 0.035,
      },
      illustration: {
        width: windowWidth * 0.94,
        height: '100%',
        zIndex: 1,
      },
      contentZone: {
        height: windowHeight * 0.36,
        paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 20 : 24,
        paddingTop: windowHeight < 760 ? 22 * scale : 28 * scale,
        paddingBottom: windowHeight < 700 ? 20 * scale : 32 * scale,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
      },
      textBlock: {
        width: '100%',
      },
      title: {
        fontSize: 32 * scale,
        fontFamily: 'Poppins-Bold',
        color: Colors.white,
        marginBottom: 12 * scale,
        paddingHorizontal: isSmallScreen ? 4 : 0,
        lineHeight: 40 * scale,
        letterSpacing: -0.5,
      },
      description: {
        fontSize: 16 * scale,
        fontFamily: 'Poppins-Regular',
        color: 'rgba(255, 255, 255, 0.9)',
        maxWidth: isSmallScreen ? '95%' : '85%',
        marginBottom: 16 * scale,
        paddingHorizontal: isSmallScreen ? 4 : 0,
        lineHeight: 24 * scale,
        letterSpacing: 0.2,
      },
    });
  }, [windowWidth, windowHeight, contentWidth, contentHeight]);

  useEffect(() => {
    // Mid-drag neighbour: show instantly, otherwise the swipe drags in a blank panel.
    if (revealed && !isActive) {
      fadeAnim.setValue(1);
      titleSlideAnim.setValue(0);
      descSlideAnim.setValue(0);
      isVisibleRef.current = true;
      return;
    }

    if (isActive) {
      if (reducedMotion) {
        fadeAnim.setValue(1);
        titleSlideAnim.setValue(0);
        descSlideAnim.setValue(0);
        isVisibleRef.current = true;
        return;
      }

      // Only replay the rise-into-place entrance when the slide isn't already on
      // screen — committing a swipe would otherwise flash the text back to zero.
      if (!isVisibleRef.current) {
        fadeAnim.setValue(0);
        titleSlideAnim.setValue(30);
        descSlideAnim.setValue(30);
      }
      isVisibleRef.current = true;

      runParallel(reducedMotion, [
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleSlideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]);

      const descTimer = setTimeout(() => {
        runTiming(reducedMotion, descSlideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        });
      }, reducedMotion ? 0 : 150);

      return () => clearTimeout(descTimer);
    }

    isVisibleRef.current = false;

    if (reducedMotion) {
      fadeAnim.setValue(0);
      titleSlideAnim.setValue(-30);
      descSlideAnim.setValue(-30);
      return;
    }

    runParallel(reducedMotion, [
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(titleSlideAnim, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(descSlideAnim, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);
  }, [isActive, revealed, fadeAnim, titleSlideAnim, descSlideAnim, reducedMotion]);

  return (
    <SafeAreaView style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width={windowWidth} height={windowHeight}>
        <Defs>
          <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#E8EBE3" />
            <Stop offset="12%" stopColor="#D9DED2" />
            <Stop offset="26%" stopColor="#C6D2B6" />
            <Stop offset="38%" stopColor="#B0C98A" />
            <Stop offset="48%" stopColor="#96BE5E" />
            <Stop offset="57%" stopColor="#74A238" />
            <Stop offset="65%" stopColor="#527A22" />
            <Stop offset="72%" stopColor="#345215" />
            <Stop offset="79%" stopColor="#1E330D" />
            <Stop offset="86%" stopColor="#101C07" />
            <Stop offset="93%" stopColor="#070D03" />
            <Stop offset="100%" stopColor="#000000" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#gradient)" />
      </Svg>

      <View style={styles.heroZone}>
        <Image source={slide.image} style={styles.illustration} resizeMode="contain" />
      </View>

      <View style={styles.contentZone}>
        <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateY: titleSlideAnim }] }]}>
          <Text style={styles.title} maxFontSizeMultiplier={1.25}>
            {slide.title}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateY: descSlideAnim }] }]}>
          <Text style={styles.description} maxFontSizeMultiplier={1.3}>
            {slide.description}
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
