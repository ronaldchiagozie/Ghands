import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';

import { ONBOARDING_SLIDES } from '@/lib/assets';

export const ONBOARDING_STORAGE_KEY = '@app:onboarding_complete';

interface UseOnboardingReturn {
  isOnboardingComplete: boolean;
  isLoading: boolean;
  currentSlideIndex: number;
  setCurrentSlideIndex: (index: number) => void;
  nextSlide: () => void;
  previousSlide: () => void;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

/** Derived, not hardcoded: a mismatch with ONBOARDING_SLIDES strands the user on the last slide. */
const TOTAL_SLIDES = ONBOARDING_SLIDES.length;

export default function useOnboarding(): UseOnboardingReturn {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        setIsOnboardingComplete(value === 'true');
      } catch {
        setIsOnboardingComplete(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkOnboardingStatus();
  }, []);

  const nextSlide = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentSlideIndex < TOTAL_SLIDES - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  }, [currentSlideIndex]);

  const previousSlide = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  }, [currentSlideIndex]);

  const completeOnboarding = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setIsOnboardingComplete(true);
    } catch {
      setIsOnboardingComplete(true);
    }
  }, []);

  const skipOnboarding = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setIsOnboardingComplete(true);
    } catch {
      setIsOnboardingComplete(true);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
      setIsOnboardingComplete(false);
      setCurrentSlideIndex(0);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    isOnboardingComplete,
    isLoading,
    currentSlideIndex,
    setCurrentSlideIndex,
    nextSlide,
    previousSlide,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
  };
}