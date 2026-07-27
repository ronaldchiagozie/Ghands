import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowRight, Clock, MapPin } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Button } from '@/components/ui/Button';
import { Colors, useKeyboardAvoidingOffset } from '@/lib/designSystem';
import { ScreenHeader } from '@/components/ScreenHeader';
import Toast from '@/components/Toast';
import HandyDraftChip, { type HandyChipState } from '@/components/ai/HandyDraftChip';
import { useToast } from '@/hooks/useToast';
import { useUserLocation } from '@/hooks/useUserLocation';
import { serviceRequestService, locationService, authService, aiService } from '@/services/api';
import { haptics } from '@/hooks/useHaptics';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { generateHandyJobDraft } from '@/utils/handyJobDraft';
import { navigateBack, NAV_FALLBACK } from '@/utils/navigation';

const MAX_DESCRIPTION_LENGTH = 500;
const MIN_DESCRIPTION_LENGTH = 10;
const MIN_JOB_TITLE_LENGTH = 3;
const MAX_JOB_TITLE_LENGTH = 200;

export default function JobDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string; categoryName?: string }>();
  const { location, refreshLocation } = useUserLocation();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const keyboardOffset = useKeyboardAvoidingOffset();
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ jobTitle?: string; description?: string }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [locationData, setLocationData] = useState<any>(null);
  const [handyAvailable, setHandyAvailable] = useState(false);
  const [handyState, setHandyState] = useState<HandyChipState>('idle');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const hasSubmittedRef = useRef(false);
  const handyUndoRef = useRef<{ jobTitle: string; description: string } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Hide the chip outright when the assistant is down rather than offering a
  // control that can only fail.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const status = await aiService.getStatus();
        if (!cancelled) setHandyAvailable(Boolean(status?.available));
      } catch {
        if (!cancelled) setHandyAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Load location details if we have a saved location
  const loadLocationDetails = useCallback(async () => {
    try {
      const userId = await authService.getUserId();
      if (userId) {
        const savedLocation = await locationService.getUserLocation(userId);
        if (savedLocation) {
          const newLocationData = {
            placeId: savedLocation.placeId,
            formattedAddress: savedLocation.fullAddress,
            address: savedLocation.address,
            city: savedLocation.city,
            state: savedLocation.state,
            country: savedLocation.country,
            latitude: savedLocation.latitude,
            longitude: savedLocation.longitude,
          };
          setLocationData(newLocationData);
          return true; // Location found
        }
      }
    } catch {
      // Location not set in API
    }
    return false; // Location not found
  }, []);

  // Load location on mount
  useEffect(() => {
    loadLocationDetails();
  }, [loadLocationDetails]);

  // Refresh location when screen comes into focus (e.g., returning from LocationSearchScreen)
  useFocusEffect(
    useCallback(() => {
      // Small delay to ensure API has updated after location change
      const refreshLocationData = async () => {
        // Refresh location hook first (local storage)
        await refreshLocation();
        // Small delay to ensure API has processed the update
        await new Promise(resolve => setTimeout(resolve, 300));
        // Then load location details from API
        await loadLocationDetails();
      };
      refreshLocationData();
    }, [loadLocationDetails, refreshLocation])
  );

  const handleBack = useCallback(() => {
    haptics.light();
    navigateBack(router, NAV_FALLBACK.clientHome);
  }, [router]);

  const handleChangeLocation = useCallback(() => {
    haptics.light();
    router.push({
      pathname: '/LocationSearchScreen' as any,
      params: {
        next: 'JobDetailsScreen',
        requestId: params.requestId,
        categoryName: params.categoryName,
      },
    } as any);
  }, [router, params]);

  const handleNext = useCallback(async () => {
    const newErrors: { jobTitle?: string; description?: string } = {};
    
    // Validation
    if (!jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    } else if (jobTitle.trim().length < MIN_JOB_TITLE_LENGTH) {
      newErrors.jobTitle = `Job title must be at least ${MIN_JOB_TITLE_LENGTH} characters`;
    } else if (jobTitle.trim().length > MAX_JOB_TITLE_LENGTH) {
      newErrors.jobTitle = `Job title must be less than ${MAX_JOB_TITLE_LENGTH} characters`;
    }
    
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    } else if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
    } else if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`;
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showError('Please fill in all required fields correctly');
      haptics.error();
      return;
    }

    if (!params.requestId) {
      showError('Request ID is missing. Please go back and try again.');
      haptics.error();
      return;
    }
    
    setIsUpdating(true);
    haptics.light();

    try {
      const userId = await authService.getUserId();
      
      if (!userId) {
        showError('Unable to identify your account. Please sign out and sign in again.');
        haptics.error();
        setIsUpdating(false);
        return;
      }

      const requestId = parseInt(params.requestId, 10);
      if (isNaN(requestId)) {
        showError('Invalid request ID');
        haptics.error();
        setIsUpdating(false);
        return;
      }

      // Check if user has a saved location - backend requires it
      // Try to load location if we don't have it yet
      if (!locationData) {
        // Try to get saved location one more time
        const locationFound = await loadLocationDetails();
        
        if (!locationFound) {
          // Still no location - check if we have location from hook (local storage)
          if (location) {
            // We have location text but not full details - API should use saved location
            // Allow proceeding - backend will use user's saved location if available
            if (__DEV__) {
            }
          } else {
            // No location at all - redirect to location screen
            showError('Please set your location first to continue with booking.');
            haptics.error();
            setTimeout(() => {
              router.push({
                pathname: '/LocationSearchScreen' as any,
                params: {
                  next: 'JobDetailsScreen',
                  requestId: params.requestId,
                  categoryName: params.categoryName,
                },
              } as any);
            }, 1500);
            setIsUpdating(false);
            return;
          }
        }
      }

      // Prepare location data
      // If we don't have locationData, don't send location in payload
      // Backend will use user's saved location automatically
      let locationPayload: any = undefined;
      if (locationData) {
        locationPayload = {
          placeId: locationData.placeId,
          address: locationData.address || locationData.formattedAddress?.split(',')[0],
          formattedAddress: locationData.formattedAddress,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          city: locationData.city,
          state: locationData.state,
          country: locationData.country,
        };
      } else {
        // No location data - backend should use user's saved location
        // Don't send location payload, let backend handle it
        if (__DEV__) {
        }
      }

      // Update job details (Step 2)
      // userId is automatically extracted from token, don't send it
      const updateResponse = await serviceRequestService.updateJobDetails(requestId, {
        jobTitle: jobTitle.trim(),
        description: description.trim(),
        location: locationPayload,
      });

      hasSubmittedRef.current = true;
      showSuccess('Job details updated');
      haptics.success();

      // Navigate to DateTimeScreen with requestId
      setTimeout(() => {
        router.push({
          pathname: '/DateTimeScreen' as any,
          params: {
            requestId: params.requestId,
            categoryName: params.categoryName,
            bookingOrigin: 'jobDetails',
          },
        } as any);
      }, 300);
    } catch (error: any) {
      if (__DEV__) {
        console.error('❌ Error in handleNext (updateJobDetails):', {
          requestId: params.requestId,
          error: error instanceof Error ? error.message : error,
          status: error?.status,
          details: error?.details,
        });
      }
      const errorMessage = getSpecificErrorMessage(error, 'update_job_details');
      showError(errorMessage);
      haptics.error();
    } finally {
      setIsUpdating(false);
    }
  }, [jobTitle, description, location, locationData, params, router, showError, showSuccess]);

  // Undo only means "undo the fill". Once the user starts editing, reverting to
  // the pre-fill snapshot would throw away their own words instead.
  const dropHandyUndo = useCallback(() => {
    if (handyUndoRef.current) {
      handyUndoRef.current = null;
      setHandyState('idle');
    }
  }, []);

  const handleJobTitleChange = useCallback((text: string) => {
    setJobTitle(text);
    dropHandyUndo();
    if (errors.jobTitle) {
      setErrors((prev) => ({ ...prev, jobTitle: undefined }));
    }
  }, [dropHandyUndo, errors.jobTitle]);

  const handleDescriptionChange = useCallback((text: string) => {
    if (text.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(text);
      dropHandyUndo();
      if (errors.description) {
        setErrors((prev) => ({ ...prev, description: undefined }));
      }
    }
  }, [dropHandyUndo, errors.description]);

  const handleHandyDraft = useCallback(async () => {
    if (handyState === 'pending') return;

    haptics.light();
    const snapshot = { jobTitle, description };
    setHandyState('pending');

    const result = await generateHandyJobDraft({
      categoryName: params.categoryName,
      jobTitleHint: jobTitle,
      descriptionHint: description,
      minTitleLength: MIN_JOB_TITLE_LENGTH,
      maxTitleLength: MAX_JOB_TITLE_LENGTH,
      minDescriptionLength: MIN_DESCRIPTION_LENGTH,
      maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
    });

    // The screen stays mounted behind a push, so a late result must not
    // overwrite fields for a request that has already been submitted.
    if (!isMountedRef.current || hasSubmittedRef.current) return;

    if (!result.ok) {
      setHandyState(handyUndoRef.current ? 'filled' : 'idle');
      showError(result.error);
      haptics.error();
      return;
    }

    handyUndoRef.current = snapshot;
    setJobTitle(result.draft.jobTitle);
    setDescription(result.draft.description);
    setErrors({});
    setHandyState('filled');
    haptics.success();
  }, [description, handyState, jobTitle, params.categoryName, showError]);

  const handleHandyUndo = useCallback(() => {
    const snapshot = handyUndoRef.current;
    if (!snapshot) return;

    haptics.light();
    handyUndoRef.current = null;
    setJobTitle(snapshot.jobTitle);
    setDescription(snapshot.description);
    setHandyState('idle');
  }, []);

  const parsedLocation = useMemo(() => {
    if (locationData?.formattedAddress) {
      const parts = locationData.formattedAddress.split(',').map((p: string) => p.trim());
      if (parts.length >= 2) {
        return {
          street: parts[0],
          city: parts.slice(1).join(', '),
        };
      }
      return {
        street: locationData.formattedAddress,
        city: '',
      };
    }

    if (!location) {
      return {
        street: 'No location set',
        city: 'Please set your location',
      };
    }

    const parts = location.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      return {
        street: parts[0],
        city: parts.slice(1).join(', '),
      };
    }
    return {
      street: location,
      city: '',
    };
  }, [location, locationData]);

  const descriptionCount = description.length;
  const canProceed = 
    jobTitle.trim().length >= MIN_JOB_TITLE_LENGTH && 
    jobTitle.trim().length <= MAX_JOB_TITLE_LENGTH &&
    description.trim().length >= MIN_DESCRIPTION_LENGTH && 
    description.trim().length <= MAX_DESCRIPTION_LENGTH &&
    !isUpdating;

  const animatedStyles = useMemo(
    () => ({
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    }),
    [fadeAnim, slideAnim]
  );

  return (
    <SafeAreaWrapper>
      <Animated.View style={[animatedStyles, { flex: 1 }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardOffset}
        >
        <ScreenHeader title="Job details" onBack={handleBack} />

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        >
          <View
            className="mb-8 rounded-2xl px-5 py-5 border"
            style={{ backgroundColor: Colors.sageTint, borderColor: Colors.borderSage }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-2"
                  style={{ backgroundColor: Colors.white }}
                >
                  <MapPin size={16} color={Colors.accent} />
                </View>
                <Text className="text-base text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  Current Location
                </Text>
              </View>
              <Button
                title="Change"
                onPress={handleChangeLocation}
                variant="secondary"
                size="small"
              />
            </View>

            <Text className="text-base text-black mb-1" style={{ fontFamily: 'Poppins-Bold' }}>
              {parsedLocation.street}
            </Text>
            {parsedLocation.city && (
              <Text className="text-sm mb-4" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
                {parsedLocation.city}
              </Text>
            )}

            <View className="flex-row items-center">
              <View className="flex-row items-center mr-4">
                <MapPin size={14} color={Colors.accent} />
                <Text className="text-xs ml-1" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
                  GPS Verified
                </Text>
              </View>
              <View className="flex-row items-center">
                <Clock size={14} color={Colors.iconMuted} />
                <Text className="text-xs ml-1" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
                  2 min ago
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-sm text-black"
                style={{ fontFamily: 'Poppins-SemiBold', flexShrink: 1 }}
              >
                Job Title <Text style={{ color: Colors.error }}>*</Text>
              </Text>
              {handyAvailable ? (
                <HandyDraftChip
                  state={handyState}
                  onPress={handleHandyDraft}
                  onUndo={handleHandyUndo}
                  disabled={isUpdating}
                />
              ) : null}
            </View>
            <TextInput
              value={jobTitle}
              onChangeText={handleJobTitleChange}
              placeholder="e.g., Kitchen faucet repair, Electrical outlet..."
              className="rounded-xl border bg-white px-5 py-4 text-base text-black"
              placeholderTextColor={Colors.placeholder}
              style={{
                fontFamily: 'Poppins-Medium',
                borderColor: errors.jobTitle ? Colors.error : Colors.border,
              }}
              maxLength={MAX_JOB_TITLE_LENGTH}
            />
            {errors.jobTitle ? (
              <Text className="text-xs mt-2" style={{ fontFamily: 'Poppins-Medium', color: Colors.error }}>
                {errors.jobTitle}
              </Text>
            ) : (
              <Text className="text-xs mt-2" style={{ fontFamily: 'Poppins-Regular', color: Colors.iconMuted }}>
                Be specific about what needs to be done ({jobTitle.length}/{MAX_JOB_TITLE_LENGTH}).
              </Text>
            )}
          </View>

          <View className="mb-8">
            <Text className="text-sm text-black mb-3" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Description <Text style={{ color: Colors.error }}>*</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Describe the issue in detail..."
              multiline
              numberOfLines={6}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="rounded-xl border bg-white px-5 py-4 text-base text-black"
              placeholderTextColor={Colors.placeholder}
              style={{
                fontFamily: 'Poppins-Medium',
                borderColor: errors.description ? Colors.error : Colors.border,
                minHeight: 140,
                textAlignVertical: 'top',
              }}
            />
            <View className="flex-row items-center justify-between mt-3">
              {errors.description ? (
                <Text className="text-xs" style={{ fontFamily: 'Poppins-Medium', color: Colors.error }}>
                  {errors.description}
                </Text>
              ) : (
                <Text className="text-xs" style={{ fontFamily: 'Poppins-Regular', color: Colors.iconMuted }}>
                  Describe the issue in detail (min {MIN_DESCRIPTION_LENGTH} characters).
                </Text>
              )}
              <Text
                className="text-xs"
                style={{
                  fontFamily: 'Poppins-Medium',
                  color: descriptionCount >= MAX_DESCRIPTION_LENGTH ? Colors.error : Colors.iconMuted,
                }}
              >
                {descriptionCount}/{MAX_DESCRIPTION_LENGTH}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View className="px-4 pb-5">
          <Button
            title={isUpdating ? 'Updating…' : 'Next'}
            onPress={handleNext}
            variant="secondary"
            size="large"
            fullWidth
            disabled={!canProceed || isUpdating}
            loading={isUpdating}
            icon={
              <ArrowRight
                size={18}
                color={!canProceed || isUpdating ? Colors.textTertiary : Colors.white}
              />
            }
            iconPosition="right"
          />
        </View>
        </KeyboardAvoidingView>
      </Animated.View>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}
