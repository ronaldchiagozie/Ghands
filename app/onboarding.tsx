import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { StatusBar, View } from 'react-native';
import OnboardingCarousel from '../components/OnboardingCarousel';
import useOnboarding from '../hooks/useOnboarding';
import { DESIGN_TOKENS, ONBOARDING_SLIDES } from '../lib/assets';

export default function OnboardingScreen() {
  const router = useRouter();
  
  const {
    currentSlideIndex,
    setCurrentSlideIndex,
    nextSlide,
    skipOnboarding,
    completeOnboarding,
  } = useOnboarding();

  /** Guards a double-tap on Get Started / Skip from firing two navigations. */
  const isLeavingRef = useRef(false);

  const leaveOnboarding = async (finish: () => Promise<void>) => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    try {
      await finish();
    } finally {
      // Account type is chosen next, which is what routes into the right signup screen.
      router.replace('/ClientTypeSelectionScreen');
    }
  };

  const handleNext = async () => {
    if (currentSlideIndex === ONBOARDING_SLIDES.length - 1) {
      await leaveOnboarding(completeOnboarding);
    } else {
      nextSlide();
    }
  };

  const handleSkip = async () => {
    await leaveOnboarding(skipOnboarding);
  };

  const handleSlideChange = (index: number) => {
    setCurrentSlideIndex(index);
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: DESIGN_TOKENS.colors.background,
    }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
        hidden={false}
        animated={true}
      />
      
      <OnboardingCarousel
        slides={ONBOARDING_SLIDES}
        currentIndex={currentSlideIndex}
        onSlideChange={handleSlideChange}
        onNext={handleNext}
        onSkip={handleSkip}
        isLastSlide={currentSlideIndex === ONBOARDING_SLIDES.length - 1}
      />
    </View>
  );
}