import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Colors, BorderRadius, Spacing } from '@/lib/designSystem';
import appLogo from '@/assets/images/icon.png';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
      "This app helps you find trusted service providers for your home or office. Whether you need repairs, installations, or inspections. You can easily request up to three providers, compare their offers, and chat with them right in the app. It's simple, fast, and designed to make getting help easier. You'll also find helpful tips, special offers, and promotions to make your experience even better. Everything you need is right here Just a few taps away!\n\nFollow this step-by-step guide to easily book your desired service through our app",
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
      "You'll see a confirmation message showing your booking was successful, along with a job progress tracker. You can manage your booking from the Jobs section.",
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
    // Fade animation for all content
    fadeAnim.setValue(0);
    
    // Slide up animation for image only
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
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = () => {
    // Skip intro and go to first step
    if (currentStep === 0) {
      setCurrentStep(1);
    } else {
      handleNext();
    }
  };

  const currentStepData = GUIDE_STEPS[currentStep];
  const isIntro = currentStepData.isIntro;
  const isLastStep = currentStep === GUIDE_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <SafeAreaWrapper>
      <ScreenHeader title="User Guide" onBack={() => router.back()} />

      <View style={styles.container}>
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
          }}
        >
          {isIntro ? (
            // Intro Page
            <View style={styles.introContainer}>
              <View style={styles.introContent}>
                {/* App logo in circular container */}
                <View style={styles.bookIconContainer}>
                  <Image
                    source={appLogo}
                    style={{ width: 80, height: 80, resizeMode: 'contain' }}
                  />
                </View>

                {/* Title */}
                <Text style={styles.introTitle}>{currentStepData.title}</Text>

                {/* Description */}
                <View style={styles.descriptionContainer}>
                  <Text style={styles.descriptionText} numberOfLines={10}>
                    {currentStepData.description}
                  </Text>
                  </View>
                </View>

              {/* Continue Button */}
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
            // Step Pages with Images - No scrolling, all visible
            <View style={styles.stepContainer}>
              {/* Step Number and Title */}
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>{currentStepData.id}</Text>
                </View>
                <Text style={styles.stepTitle}>{currentStepData.title}</Text>
              </View>

              {/* Phone Mockup Image - Shorter to fit on screen with slide animation */}
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

          {/* Description */}
              <View style={styles.descriptionWrapper}>
                <Text style={styles.stepDescription} numberOfLines={3}>
              {currentStepData.description}
            </Text>
          </View>

              {/* Navigation Buttons - At the bottom */}
              <View style={styles.navigationContainer}>
            <TouchableOpacity
              onPress={handlePrevious}
                  disabled={currentStep === 1}
              activeOpacity={0.85}
                  style={[styles.navButton, currentStep === 1 && styles.navButtonDisabled]}
            >
              <Text
                    style={[
                      styles.navButtonText,
                      currentStep === 1 && styles.navButtonTextDisabled,
                    ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

                <View style={styles.bookIcon}>
                  <BookOpen size={18} color={Colors.textPrimary} />
            </View>

            <TouchableOpacity
              onPress={handleNext}
                  disabled={isLastStep}
              activeOpacity={0.85}
                  style={[styles.navButton, isLastStep && styles.navButtonDisabled]}
            >
              <Text
                    style={[styles.navButtonText, isLastStep && styles.navButtonTextDisabled]}
              >
                Next
              </Text>
              <ChevronRight
                size={16}
                    color={isLastStep ? Colors.textSecondaryDark : Colors.textPrimary}
                    style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>

              {/* Back to Top Link */}
              <TouchableOpacity
                onPress={() => setCurrentStep(0)}
                activeOpacity={0.85}
                style={styles.backToTopContainer}
              >
                <Text style={styles.backToTopText}>Back to Top</Text>
              </TouchableOpacity>
          </View>
          )}
        </Animated.View>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  introContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  introContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: 16,
  },
  continueButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  stepTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    width: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  mockupImage: {
    width: SCREEN_WIDTH * 0.85,
    height: '100%',
    maxHeight: SCREEN_WIDTH * 0.9,
    backgroundColor: 'transparent',
  },
  descriptionWrapper: {
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    textDecorationLine: 'underline',
  },
  navButtonTextDisabled: {
    color: Colors.textSecondaryDark,
  },
  bookIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToTopContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backToTopText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: Colors.textSecondaryDark,
    textDecorationLine: 'underline',
  },
});
