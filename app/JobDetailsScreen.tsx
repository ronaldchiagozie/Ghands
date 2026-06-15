import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, ArrowRight, Clock, MapPin } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors } from '@/lib/designSystem';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useUserLocation } from '@/hooks/useUserLocation';
import { serviceRequestService, locationService, authService } from '@/services/api';
import { haptics } from '@/hooks/useHaptics';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
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
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ jobTitle?: string; description?: string }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [locationData, setLocationData] = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

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
    navigateBack(router, NAV_FALLBACK.clientRequest);
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

      showSuccess('Job details updated!');
      haptics.success();

      // Navigate to DateTimeScreen with requestId
      setTimeout(() => {
        router.push({
          pathname: '/DateTimeScreen' as any,
          params: {
            requestId: params.requestId,
            categoryName: params.categoryName,
          },
        } as any);
      }, 1000);
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

  const handleJobTitleChange = useCallback((text: string) => {
    setJobTitle(text);
    if (errors.jobTitle) {
      setErrors((prev) => ({ ...prev, jobTitle: undefined }));
    }
  }, [errors.jobTitle]);

  const handleDescriptionChange = useCallback((text: string) => {
    if (text.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(text);
      if (errors.description) {
        setErrors((prev) => ({ ...prev, description: undefined }));
      }
    }
  }, [errors.description]);

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
        <View className="px-4 pb-2" style={{ paddingTop: 20 }}>
          <View className="flex-row items-center mb-6">
            <TouchableOpacity
              onPress={handleBack}
              className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100"
            >
              <ArrowLeft size={20} color={Colors.surfaceDark} />
            </TouchableOpacity>
            <Text className="text-xl text-black" style={{ fontFamily: 'Poppins-Bold' }}>
              Job details
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        >
          <View className="mb-8 rounded-2xl bg-gray-100 px-5 py-5 border border-[#D7FF6B]/30">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-[#000] items-center justify-center mr-2">
                  <MapPin size={16} color="#81b60eff" />
                </View>
                <Text className="text-base text-black" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  Current Location
                </Text>
              </View>
              <TouchableOpacity onPress={handleChangeLocation} className='bg-black px-4 py-2  rounded-md' activeOpacity={0.7}>
                <Text className="text-sm text-[#81b60eff]" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-base text-black mb-1" style={{ fontFamily: 'Poppins-Bold' }}>
              {parsedLocation.street}
            </Text>
            {parsedLocation.city && (
              <Text className="text-sm text-gray-600 mb-4" style={{ fontFamily: 'Poppins-Medium' }}>
                {parsedLocation.city}
              </Text>
            )}

            <View className="flex-row items-center">
              <View className="flex-row items-center mr-4">
                <MapPin size={14} color={Colors.accent} />
                <Text className="text-xs text-gray-600 ml-1" style={{ fontFamily: 'Poppins-Medium' }}>
                  GPS Verified
                </Text>
              </View>
              <View className="flex-row items-center">
                <Clock size={14} color={Colors.iconMuted} />
                <Text className="text-xs text-gray-600 ml-1" style={{ fontFamily: 'Poppins-Medium' }}>
                  2 min ago
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-sm text-black mb-3" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Job Title <Text className="text-[#EF4444]">*</Text>
            </Text>
            <TextInput
              value={jobTitle}
              onChangeText={handleJobTitleChange}
              placeholder="e.g., Kitchen faucet repair, Electrical outlet..."
              className={`rounded-xl border bg-white px-5 py-4 text-base text-black ${
                errors.jobTitle ? 'border-[#EF4444]' : 'border-gray-200'
              }`}
              placeholderTextColor={Colors.placeholder}
              style={{ fontFamily: 'Poppins-Medium' }}
              maxLength={MAX_JOB_TITLE_LENGTH}
            />
            {errors.jobTitle ? (
              <Text className="text-xs text-[#EF4444] mt-2" style={{ fontFamily: 'Poppins-Medium' }}>
                {errors.jobTitle}
              </Text>
            ) : (
              <Text className="text-xs text-gray-500 mt-2" style={{ fontFamily: 'Poppins-Regular' }}>
                Be specific about what needs to be done ({jobTitle.length}/{MAX_JOB_TITLE_LENGTH}).
              </Text>
            )}
          </View>

          <View className="mb-8">
            <Text className="text-sm text-black mb-3" style={{ fontFamily: 'Poppins-SemiBold' }}>
              Description <Text className="text-[#EF4444]">*</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Describe the issue in detail..."
              multiline
              numberOfLines={6}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className={`rounded-xl border bg-white px-5 py-4 text-base text-black ${
                errors.description ? 'border-[#EF4444]' : 'border-gray-200'
              }`}
              placeholderTextColor={Colors.placeholder}
              style={{
                fontFamily: 'Poppins-Medium',
                minHeight: 140,
                textAlignVertical: 'top',
              }}
            />
            <View className="flex-row items-center justify-between mt-3">
              {errors.description ? (
                <Text className="text-xs text-[#EF4444]" style={{ fontFamily: 'Poppins-Medium' }}>
                  {errors.description}
                </Text>
              ) : (
                <Text className="text-xs text-gray-500" style={{ fontFamily: 'Poppins-Regular' }}>
                  Describe the issue in detail (min {MIN_DESCRIPTION_LENGTH} characters).
                </Text>
              )}
              <Text
                className={`text-xs ${descriptionCount >= MAX_DESCRIPTION_LENGTH ? 'text-[#EF4444]' : 'text-gray-500'}`}
                style={{ fontFamily: 'Poppins-Medium' }}
              >
                {descriptionCount}/{MAX_DESCRIPTION_LENGTH}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View className="px-4 pb-5">
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canProceed}
            activeOpacity={canProceed ? 0.85 : 1}
            className={`rounded-xl py-4 items-center justify-center flex-row ${
              canProceed ? 'bg-black' : 'bg-gray-200'
            }`}
            style={{
              opacity: canProceed ? 1 : 0.6,
            }}
          >
            {isUpdating ? (
              <>
                <ActivityIndicator size="small" color="#D7FF6B" style={{ marginRight: 8 }} />
                <Text
                  className="text-base text-[#D7FF6B]"
                  style={{ fontFamily: 'Poppins-SemiBold' }}
                >
                  Updating...
                </Text>
              </>
            ) : (
              <>
                <Text
                  className={`text-base mr-2 ${canProceed ? 'text-[#D7FF6B]' : 'text-gray-400'}`}
                  style={{ fontFamily: 'Poppins-SemiBold' }}
                >
                  Next
                </Text>
                <ArrowRight size={18} color={canProceed ? '#D7FF6B' : '#9CA3AF'} />
              </>
            )}
          </TouchableOpacity>
        </View>
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
