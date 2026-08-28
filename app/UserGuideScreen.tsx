import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { haptics } from '@/hooks/useHaptics';
import appLogo from '@/assets/images/icon.png';
import { BorderRadius, Colors, MIN_TOUCH_TARGET } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STEP_COUNT = 10;

interface GuideStep {
  id: number;
  title: string;
  description: string;
  image: any;
  isIntro?: boolean;
}

// Intro page + 10 illustration pages
const GUIDE_STEPS: GuideStep[] = [
  {
    id: 0,
    title: 'How to Book a Service',
    description:
      "This app helps you find trusted service providers for your home or office, whether you need repairs, installations, or inspections. Request up to three providers, compare offers, and chat in the app. You'll also see tips and promotions when available. Everything you need is a few taps away.\n\nFollow this guide to book a service step by step.",
    image: null,
    isIntro: true,
  },
  {
    id: 1,
    title: 'Home Screen',
    description:
      'Choose a service category that matches what you need, or use the search bar to find it quickly.',
    image: require('@/assets/mockups/home screen.png'),
  },
  {
    id: 2,
    title: 'Request Service',
    description:
      "You'll see a list of available services. Select the one you need, or change it if you want something different.",
    image: require('@/assets/mockups/Request service screen.png'),
  },
  {
    id: 3,
    title: 'Job Details',
    description:
      'Type a short description of the job and confirm your location. This helps the app find qualified providers close to you.',
    image: require('@/assets/mockups/job details.png'),
  },
  {
    id: 4,
    title: 'Set Date & Time',
    description:
      'Pick a convenient date and time for the inspection. When ready, tap "Find Providers" to start the matchmaking process.',
    image: require('@/assets/mockups/date & time .png'),
  },
  {
    id: 5,
    title: 'Add Pictures',
    description:
      'You can take or upload pictures of the issue. This helps providers understand the problem and give accurate quotes.',
    image: require('@/assets/mockups/add photos.png'),
  },
  {
    id: 6,
    title: 'Select Providers',
    description:
      'Matched providers will appear on the map. Select at least one and up to three providers to request inspections from.',
    image: require('@/assets/mockups/select provider.png'),
  },
  {
    id: 7,
    title: 'Review Quotes',
    description:
      "Once providers review your request, they'll send in their quotations. You can compare prices, service details, and timelines before making your choice.",
    image: require('@/assets/mockups/Review quotes.png'),
  },
  {
    id: 8,
    title: 'Payment Pending',
    description:
      'After accepting a quotation, your payment will be processed. The payment is held safely in escrow until the job is completed.',
    image: require('@/assets/mockups/Pending payment.png'),
  },
  {
    id: 9,
    title: 'Booking Complete',
    description:
      "You'll see a confirmation when your booking is in, plus a job progress tracker. Manage the job from the Jobs tab.",
    image: require('@/assets/mockups/booking complete.png'),
  },
  {
    id: 10,
    title: 'Wallet Dashboard',
    description:
      'Manage your wallet balance, view transaction history, and top up funds when needed. All payments are secure and transparent.',
    image: require('@/assets/mockups/Wallet dashboard.png'),
  },
];

export default function UserGuideScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const imageSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    imageSlideAnim.setValue(50);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(imageSlideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep, fadeAnim, imageSlideAnim]);

  const handleNext = () => {
    if (currentStep < GUIDE_STEPS.length - 1) {
      haptics.light();
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      haptics.light();
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = () => {
    haptics.light();
    if (currentStep === 0) {
      setCurrentStep(1);
    } else {
      handleNext();
    }
  };

  const handleDone = () => {
    haptics.light();
    router.back();
  };

  const currentStepData = GUIDE_STEPS[currentStep];
  const isIntro = currentStepData.isIntro;
  const isLastStep = currentStep === GUIDE_STEPS.length - 1;
  const stepProgressLabel = isIntro ? null : `Step ${currentStepData.id} of ${STEP_COUNT}`;

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="User Guide" onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)} />

      <View style={styles.container}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {isIntro ? (
            <View style={styles.introContainer}>
              <ScrollView
                style={styles.introScroll}
                contentContainerStyle={styles.introScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.bookIconContainer}>
                  <Image source={appLogo} style={styles.appLogo} />
                </View>

                <Text style={styles.introTitle}>{currentStepData.title}</Text>

                <View style={styles.descriptionContainer}>
                  <Text style={styles.descriptionText}>{currentStepData.description}</Text>
                </View>
              </ScrollView>

              <View style={styles.introButtonContainer}>
                <TouchableOpacity
                  onPress={handleContinue}
                  activeOpacity={0.85}
                  style={styles.continueButton}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                  <ChevronRight size={18} color={Colors.white} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>{currentStepData.id}</Text>
                </View>
                <View style={styles.stepTitleWrap}>
                  <Text style={styles.stepTitle}>{currentStepData.title}</Text>
                  {stepProgressLabel ? (
                    <Text style={styles.stepProgress}>{stepProgressLabel}</Text>
                  ) : null}
                </View>
              </View>

              <ScrollView
                style={styles.stepScroll}
                contentContainerStyle={styles.stepScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Animated.View
                  style={[
                    styles.imageContainer,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: imageSlideAnim }],
                    },
                  ]}
                >
                  <Image
                    source={currentStepData.image}
                    style={styles.mockupImage}
                    resizeMode="contain"
                  />
                </Animated.View>

                <View style={styles.descriptionWrapper}>
                  <Text style={styles.stepDescription}>{currentStepData.description}</Text>
                </View>
              </ScrollView>

              <View style={styles.navigationContainer}>
                <TouchableOpacity
                  onPress={handlePrevious}
                  disabled={currentStep === 1}
                  activeOpacity={0.85}
                  style={[styles.navBtnSecondary, currentStep === 1 && styles.navBtnDisabled]}
                >
                  <Text
                    style={[
                      styles.navBtnSecondaryText,
                      currentStep === 1 && styles.navBtnTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                {isLastStep ? (
                  <TouchableOpacity
                    onPress={handleDone}
                    activeOpacity={0.85}
                    style={styles.navBtnPrimary}
                  >
                    <Text style={styles.navBtnPrimaryText}>Done</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={styles.navBtnPrimary}>
                    <Text style={styles.navBtnPrimaryText}>Next</Text>
                    <ChevronRight size={16} color={Colors.white} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setCurrentStep(0);
                }}
                activeOpacity={0.7}
                style={styles.backToTopContainer}
              >
                <Text style={styles.backToTopText}>Back to intro</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  introContainer: {
    flex: 1,
    paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
    paddingBottom: 20,
  },
  introScroll: {
    flex: 1,
  },
  introScrollContent: {
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  bookIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appLogo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  introTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  descriptionContainer: {
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.xl,
    padding: 16,
    width: '100%',
  },
  descriptionText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
    lineHeight: 20,
    textAlign: 'left',
  },
  introButtonContainer: {
    paddingTop: 12,
  },
  continueButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.xl,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
    paddingTop: 16,
    paddingBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: Colors.white,
  },
  stepTitleWrap: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  stepProgress: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    marginTop: 2,
  },
  stepScroll: {
    flex: 1,
  },
  stepScrollContent: {
    paddingBottom: 8,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    width: '100%',
    minHeight: SCREEN_WIDTH * 0.55,
  },
  mockupImage: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.72,
    backgroundColor: 'transparent',
  },
  descriptionWrapper: {
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  navBtnSecondary: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnSecondaryText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  navBtnPrimary: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: BorderRadius.default,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimaryText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.white,
  },
  navBtnDisabled: {
    opacity: 0.45,
  },
  navBtnTextDisabled: {
    color: Colors.textSecondaryDark,
  },
  backToTopContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  backToTopText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: Colors.accent,
  },
});
