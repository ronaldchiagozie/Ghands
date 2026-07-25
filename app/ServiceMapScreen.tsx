import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import ServiceMap, { ProviderCategory, ServiceProvider } from '@/components/ServiceMap';
import BookingSummaryModal, { BookingSummaryData } from '@/components/BookingSummaryModal';
import { haptics } from '@/hooks/useHaptics';

const BOOKING_PHOTO_URIS_KEY = '@ghands:booking_photo_uris';
import { useUserLocation } from '@/hooks/useUserLocation';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { providerService, locationService, authService, serviceRequestService } from '@/services/api';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { normalizeCategoryName, isValidCategoryName } from '@/utils/categoryMapping';
import { formatSkillLabel } from '@/utils/formatSkillLabel';
import { formatDistance } from '@/utils/navigationUtils';
import { navigateBookingFlowToConfirmation } from '@/utils/navigation';
import { resolveProviderDisplayName } from '@/utils/providerDisplayName';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';
import { Colors, Spacing, BorderRadius, SHADOWS } from '@/lib/designSystem';
import { MapPin, AlertCircle, ArrowLeft } from 'lucide-react-native';
const MAX_SELECTION = 3;

// Dummy providers - only used in development mode for testing
const SAMPLE_PROVIDERS: ServiceProvider[] = __DEV__ ? [
  {
    id: 'provider-1',
    name: "Mike's Plumbing",
    category: 'Plumber',
    rating: 0,
    reviews: 0,
    distance: '0.8 miles away',
    availability: 'Available',
    image: require('../assets/images/plumbericon2.png'),
    coords: { latitude: 6.6018, longitude: 3.3515 },
  },
  {
    id: 'provider-2',
    name: 'Spark Electric Co.',
    category: 'Electrician',
    rating: 0,
    reviews: 0,
    distance: '1.1 miles away',
    availability: 'Available',
    image: require('../assets/images/electricianicon2.png'),
    coords: { latitude: 6.6128, longitude: 3.3615 },
  },
  {
    id: 'provider-3',
    name: 'Shine Auto Spa',
    category: 'Car Wash',
    rating: 0,
    reviews: 0,
    distance: '1.4 miles away',
    availability: 'Available',
    image: require('../assets/images/cleanericon.png'),
    coords: { latitude: 6.5965, longitude: 3.3472 },
  },
  {
    id: 'provider-4',
    name: 'Rapid Fix Plumbing',
    category: 'Plumber',
    rating: 0,
    reviews: 0,
    distance: '1.6 miles away',
    availability: 'Available',
    image: require('../assets/images/plumbericon.png'),
    coords: { latitude: 6.609, longitude: 3.3312 },
  },
  {
    id: 'provider-5',
    name: 'Bright Sparks',
    category: 'Electrician',
    rating: 0,
    reviews: 0,
    distance: '2.1 miles away',
    availability: 'Available',
    image: require('../assets/images/electricianicon.png'),
    coords: { latitude: 6.593, longitude: 3.3674 },
  },
] : [];


const ServiceMapScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string; // Request ID for provider selection
    selectedDateTime?: string;
    selectedDate?: string;
    selectedTime?: string;
    photoCount?: string;
    serviceType?: string;
    location?: string;
    categoryName?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const { location: savedLocation } = useUserLocation();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory>('All');
  const [selectedProviders, setSelectedProviders] = useState<ServiceProvider[]>([]);
  const [showList, setShowList] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [serviceLocation, setServiceLocation] = useState<string>(savedLocation || '');
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [serviceLocationCoords, setServiceLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [hasTriedLoadProviders, setHasTriedLoadProviders] = useState(false);
  const [bookingPhotoUris, setBookingPhotoUris] = useState<string[]>([]);
  
  // Booking data state - synced with params
  const [bookingData, setBookingData] = useState<{
    serviceType?: string;
    dateTime?: string;
    date?: string;
    time?: string;
    photoCount?: number;
    location?: string;
  }>({
    serviceType: params.serviceType,
    dateTime: params.selectedDateTime,
    date: params.selectedDate,
    time: params.selectedTime,
    photoCount: params.photoCount ? parseInt(params.photoCount, 10) : 0,
    location: params.location,
  });

  // Update booking data and photo URIs when params change (after editing)
  useFocusEffect(
    useCallback(() => {
      // Sync booking data with params whenever screen comes into focus
      setBookingData((prev) => ({
        serviceType: params.serviceType || prev.serviceType,
        dateTime: params.selectedDateTime || prev.dateTime,
        date: params.selectedDate || prev.date,
        time: params.selectedTime || prev.time,
        photoCount: params.photoCount ? parseInt(params.photoCount, 10) : prev.photoCount || 0,
        location: params.location || prev.location,
      }));
      
      // Update service location if location param was updated
      if (params.location) {
        setServiceLocation(params.location);
      }

      // Load photo URIs for Booking Summary preview
      AsyncStorage.getItem(BOOKING_PHOTO_URIS_KEY)
        .then((stored) => {
          if (stored) {
            try {
              const uris = JSON.parse(stored) as string[];
              setBookingPhotoUris(Array.isArray(uris) ? uris : []);
            } catch {
              setBookingPhotoUris([]);
            }
          } else {
            setBookingPhotoUris([]);
          }
        })
        .catch(() => setBookingPhotoUris([]));
    }, [params.serviceType, params.selectedDateTime, params.selectedDate, params.selectedTime, params.photoCount, params.location])
  );

  // Update serviceLocation when savedLocation changes
  useEffect(() => {
    if (!savedLocation) return;
    // Keep the map header/location text in sync with the latest saved location.
    // The previous logic only set it when serviceLocation was empty, which caused stale UI.
    if (savedLocation !== serviceLocation) {
      setServiceLocation(savedLocation);
    }
  }, [savedLocation, serviceLocation]);

  // Get coordinates from service location
  useEffect(() => {
    const getLocationCoordinates = async () => {
      // Priority 1: Coordinates from params (when returning from LocationSearchScreen)
      if (params.latitude && params.longitude) {
        const lat = parseFloat(params.latitude);
        const lng = parseFloat(params.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          setServiceLocationCoords({ latitude: lat, longitude: lng });
          return;
        }
      }

      // Priority 2: If we have location text, try to get from saved location API FIRST
      // This is more reliable than GPS which might be simulator default (San Francisco)
      if (serviceLocation) {
        try {
          const userId = await authService.getUserId();
          if (userId) {
            const savedLocation = await locationService.getUserLocation(userId);
            if (savedLocation?.latitude && savedLocation?.longitude) {
              setServiceLocationCoords({
                latitude: savedLocation.latitude,
                longitude: savedLocation.longitude,
              });
              return;
            }
          }
        } catch {
          // Continue to next priority if API fails
        }
      }
      
      // Priority 3: userLocation (GPS) - but only if it's NOT simulator default (San Francisco)
      if (userLocation) {
        // Check if GPS location is simulator default (San Francisco: 37.785834, -122.406417)
        const isSanFrancisco = Math.abs(userLocation.latitude - 37.785834) < 0.0001 && 
                              Math.abs(userLocation.longitude - (-122.406417)) < 0.0001;
        // Also check if coordinates are clearly not in Nigeria (Nigeria is roughly 4-14°N, 3-15°E)
        const isNotNigeria = userLocation.latitude < 0 || userLocation.latitude > 15 || 
                            userLocation.longitude < 0 || userLocation.longitude > 15;
        
        if (isSanFrancisco || isNotNigeria) {
          // Don't use simulator default - coordinates will remain null
        } else {
          setServiceLocationCoords(userLocation);
          return;
        }
      }
    };

    getLocationCoordinates();
  }, [serviceLocation, savedLocation, userLocation, params.latitude, params.longitude]);

  // Fetch nearby providers when we have category and coordinates
  useEffect(() => {
    const loadProviders = async () => {
      const categoryName = params.categoryName || params.serviceType;
      
      // Reset error state
      setHasTriedLoadProviders(false);
      setProviderError(null);
      
      if (!categoryName || !serviceLocationCoords) {
        // Don't show dummy data - show empty state instead
        setProviders([]);
        if (!categoryName) {
          setProviderError('Please select a service category');
        } else if (!serviceLocationCoords) {
          setProviderError('Please set your service location');
        }
        setHasTriedLoadProviders(true);
        return;
      }

      setIsLoadingProviders(true);
      try {
        // Normalize category name using mapping function
        // This converts display names like "Plumber", "Plumbing Service" to API format like "plumbing"
        const normalizedCategory = normalizeCategoryName(categoryName);
        const isValid = isValidCategoryName(categoryName);

        if (!normalizedCategory) {
          const errorMsg = `Invalid category name: "${categoryName}". Please select a valid service category.`;
          setProviderError(errorMsg);
          setProviders([]);
          setHasTriedLoadProviders(true);
          return;
        }

        const nearbyProviders = await providerService.getNearbyProviders(
          normalizedCategory,
          serviceLocationCoords.latitude,
          serviceLocationCoords.longitude,
          50 // maxDistanceKm
        );

        const providersArray = Array.isArray(nearbyProviders) ? nearbyProviders : [];

        // Only map if we have valid providers
        if (providersArray.length === 0) {
          setProviders([]);
          setProviderError(`No providers found nearby for "${categoryName}". Try expanding your search radius or selecting a different service category.`);
          return;
        }

        // Map API NearbyProvider to ServiceProvider format
        const mappedProviders: ServiceProvider[] = providersArray.map((provider, index) => {
          // Get icon for category
          const IconComponent = getCategoryIcon(normalizedCategory, categoryName, '');
          const categoryDisplayName = formatSkillLabel(
            categoryName.split(' ')[0] || normalizedCategory || 'Service'
          ) as ProviderCategory;

          const rawName = resolveProviderDisplayName(provider, {
            id: provider.id,
            categoryLabel: categoryName || normalizedCategory,
          });

          // Calculate approximate provider coordinates based on distance and angle
          // API doesn't return exact coordinates, so we distribute providers around service location
          const angle = (index * 45) * (Math.PI / 180); // Distribute providers around service location
          const distanceInDegrees = provider.distanceKm / 111; // Rough conversion: 1km ≈ 0.009 degrees
          
          return {
            id: `provider-${provider.id}`,
            providerId: provider.id, // Store real backend provider ID for API calls
            name: rawName,
            category: categoryDisplayName as ProviderCategory,
            rating: 4.5, // Default rating (API doesn't provide this yet)
            reviews: 0, // Default reviews (API doesn't provide this yet)
            distance:
              provider.distanceKm != null && Number.isFinite(provider.distanceKm) && provider.distanceKm >= 0
                ? `${formatDistance(provider.distanceKm)} away`
                : 'Distance unavailable',
            availability: provider.verified ? 'Available' : 'Busy',
            image: require('../assets/images/plumbericon2.png'), // Default icon - could use getCategoryIcon result
            coords: {
              latitude: serviceLocationCoords.latitude + (Math.cos(angle) * distanceInDegrees),
              longitude: serviceLocationCoords.longitude + (Math.sin(angle) * distanceInDegrees),
            },
          };
        });

        setProviders(mappedProviders);
        setProviderError(null);
      } catch (error: any) {
        setProviders([]);
        const errorMessage = error?.message || error?.details?.data?.error || 'Failed to load providers';
        setProviderError(`Unable to find providers at the moment. ${errorMessage}`);
      } finally {
        setIsLoadingProviders(false);
        setHasTriedLoadProviders(true);
      }
    };

    loadProviders();
  }, [params.categoryName, params.serviceType, serviceLocationCoords]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        // Use higher accuracy settings to get actual current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High, // High accuracy (within 100 meters)
          maximumAge: 5000, // Accept location up to 5 seconds old
          timeout: 15000, // Wait up to 15 seconds
        });
        
        if (isMounted) {
          setUserLocation({ 
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude 
          });
        }
      } catch {
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProviderSelect = useCallback(
    (provider: ServiceProvider) => {
      setSelectedProviders((prev) => {
        const exists = prev.find((item) => item.id === provider.id);
        if (exists) {
          haptics.light();
          return prev.filter((item) => item.id !== provider.id);
        }
        if (prev.length >= MAX_SELECTION) {
          haptics.warning();
          Alert.alert('Selection limit reached', `You can select up to ${MAX_SELECTION} providers.`);
          return prev;
        }
        haptics.selection();
        return [...prev, provider];
      });
    },
    []
  );

  const handleMapBack = useCallback(() => {
    haptics.light();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (params.requestId) {
      router.replace({
        pathname: '/AddPhotosScreen' as any,
        params: {
          requestId: params.requestId,
          categoryName: params.categoryName,
          serviceType: params.serviceType,
          selectedDateTime: params.selectedDateTime,
          selectedDate: params.selectedDate,
          selectedTime: params.selectedTime,
          photoCount: params.photoCount,
          location: params.location,
        },
      } as any);
    } else {
      router.replace('/(tabs)/categories' as any);
    }
  }, [router, params]);

  return (
    <SafeAreaWrapper>
      <View className="flex-1">
        {isLoadingProviders ? (
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text className="mt-4 text-gray-600" style={{ fontFamily: 'Poppins-Medium' }}>
              Finding nearby providers...
            </Text>
          </View>
        ) : !serviceLocationCoords ? (
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text className="mt-4 text-gray-600" style={{ fontFamily: 'Poppins-Medium' }}>
              Getting your location...
            </Text>
          </View>
        ) : hasTriedLoadProviders && !!serviceLocationCoords && providerError && providers.length === 0 ? (
          <View style={{ flex: 1, backgroundColor: Colors.white }}>
            {/* Back Button */}
            <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
              <TouchableOpacity
                onPress={() => {
                  // Navigate back to AddPhotosScreen explicitly
                  if (params.categoryName) {
                    router.replace({
                      pathname: '/AddPhotosScreen' as any,
                      params: {
                        categoryName: params.categoryName,
                        selectedDateTime: params.selectedDateTime,
                        selectedDate: params.selectedDate,
                        selectedTime: params.selectedTime,
                        photoCount: params.photoCount,
                        location: params.location,
                      },
                    } as any);
                  } else {
                    router.replace('/(tabs)/categories' as any);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Spacing.sm,
                }}
              >
                <ArrowLeft size={20} color={Colors.textPrimary} />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textPrimary,
                    marginLeft: Spacing.sm,
                  }}
                >
                  Back
                </Text>
              </TouchableOpacity>
            </View>

            {/* Empty State Content */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: Colors.backgroundGray,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: Spacing.lg,
                  ...SHADOWS.md,
                }}
              >
                <AlertCircle size={40} color={Colors.textPrimary} strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  marginBottom: Spacing.sm,
                  textAlign: 'center',
                }}
              >
                {providerError.includes('No providers') || providerError.includes('No providers found') 
                  ? 'No Providers Available' 
                  : 'Unable to Load Providers'}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textMuted,
                  textAlign: 'center',
                  marginBottom: Spacing.xl,
                  lineHeight: 22,
                  maxWidth: 300,
                }}
              >
                {providerError.includes('No providers') || providerError.includes('No providers found')
                  ? 'We couldn\'t find any providers in your area for this service. Try adjusting your location or check back later.'
                  : providerError.includes('location')
                  ? 'Please set your location to find nearby providers in your area.'
                  : providerError.includes('category')
                  ? 'Please select a service category to see available providers.'
                  : 'Unable to load providers. Please try again in a moment.'}
              </Text>
              
              {/* Action Buttons */}
              <View style={{ width: '100%', maxWidth: 300, gap: Spacing.md }}>
                {providerError.includes('location') && !serviceLocationCoords ? (
                  <Button
                    title="Set Location"
                    onPress={() => {
                      router.push('/LocationSearchScreen' as any);
                    }}
                    variant="primary"
                    size="medium"
                    fullWidth
                  />
                ) : (
                  <>
                    <Button
                      title={!serviceLocationCoords ? 'Set Location' : 'Try Again'}
                      onPress={() => {
                        const categoryName = params.categoryName || params.serviceType;
                        if (categoryName && serviceLocationCoords) {
                          setProviderError(null);
                          setIsLoadingProviders(true);
                          setServiceLocationCoords({ ...serviceLocationCoords });
                        } else if (!serviceLocationCoords) {
                          router.push('/LocationSearchScreen' as any);
                        }
                      }}
                      variant="primary"
                      size="medium"
                      fullWidth
                    />
                    <Button
                      title="Change Location"
                      onPress={() => {
                        router.push('/LocationSearchScreen' as any);
                      }}
                      variant="outline"
                      size="medium"
                      fullWidth
                    />
                  </>
                )}
              </View>
            </View>
          </View>
        ) : hasTriedLoadProviders && !!serviceLocationCoords && providers.length === 0 ? (
          <View style={{ flex: 1, backgroundColor: Colors.white }}>
            {/* Back Button */}
            <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
              <TouchableOpacity
                onPress={() => {
                  // Navigate back to AddPhotosScreen explicitly
                  if (params.categoryName) {
                    router.replace({
                      pathname: '/AddPhotosScreen' as any,
                      params: {
                        categoryName: params.categoryName,
                        selectedDateTime: params.selectedDateTime,
                        selectedDate: params.selectedDate,
                        selectedTime: params.selectedTime,
                        photoCount: params.photoCount,
                        location: params.location,
                      },
                    } as any);
                  } else {
                    router.replace('/(tabs)/categories' as any);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: Spacing.sm,
                }}
              >
                <ArrowLeft size={20} color={Colors.textPrimary} />
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textPrimary,
                    marginLeft: Spacing.sm,
                  }}
                >
                  Back
                </Text>
              </TouchableOpacity>
            </View>

            {/* Empty State Content */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: Colors.backgroundGray,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: Spacing.lg,
                  ...SHADOWS.md,
                }}
              >
                <MapPin size={40} color={Colors.textPrimary} strokeWidth={2} />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                  marginBottom: Spacing.sm,
                  textAlign: 'center',
                }}
              >
                No Providers Found
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textMuted,
                  textAlign: 'center',
                  marginBottom: Spacing.xl,
                  lineHeight: 22,
                  maxWidth: 300,
                }}
              >
                We couldn&apos;t find any providers nearby for this service. Try adjusting your location or selecting a different category.
              </Text>
              
              {/* Action Buttons */}
              <View style={{ width: '100%', maxWidth: 300, gap: Spacing.md }}>
                <Button
                  title="Change Location"
                  onPress={() => {
                    router.push('/LocationSearchScreen' as any);
                  }}
                  variant="primary"
                  size="medium"
                  fullWidth
                />
                <Button
                  title="Try Different Category"
                  onPress={() => {
                    // Navigate to categories screen explicitly
                    router.replace('/(tabs)/categories' as any);
                  }}
                  variant="outline"
                  size="medium"
                  fullWidth
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              onPress={handleMapBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{
                position: 'absolute',
                top: 12,
                left: 16,
                zIndex: 40,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 0.76,
              }}
              activeOpacity={0.85}
            >
              <ArrowLeft size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <ServiceMap
              providers={providers}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedProviders={selectedProviders}
              onProviderSelect={handleProviderSelect}
              showList={showList}
              onToggleList={() => setShowList((prev) => !prev)}
              userLocation={userLocation}
              serviceLocation={serviceLocation}
              onServiceLocationChange={setServiceLocation}
            />
          </View>
        )}
      </View>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
      {selectedProviders.length > 0 && (
        <View className="bg-white border-t border-gray-100 px-4 py-4 shadow-[0px_-8px_24px_rgba(15,23,42,0.08)]">
          <Text className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Poppins-Medium' }}>
            Selected providers ({selectedProviders.length}/{MAX_SELECTION})
          </Text>
          <View className="flex-row flex-wrap mb-3">
            {selectedProviders.map((provider) => (
              <View
                key={`selected-${provider.id}`}
                className="mr-2 mb-2 rounded-full bg-[#E3F4DF] px-3 py-1"
              >
                <Text className="text-xs text-[#1B4332]" style={{ fontFamily: 'Poppins-SemiBold' }}>
                  {provider.name}
                </Text>
              </View>
            ))}
          </View>
          <Button
            title="Confirm Booking"
            onPress={() => {
              haptics.light();
              setShowSummaryModal(true);
            }}
            variant="primary"
            size="large"
            fullWidth
          />
        </View>
      )}

      {/* Booking Summary Modal */}
      <BookingSummaryModal
        visible={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onConfirm={async () => {
          setShowSummaryModal(false);
          await AsyncStorage.removeItem(BOOKING_PHOTO_URIS_KEY);

          // If user selected a provider and we have requestId, call selectProvider API
          if (selectedProviders.length > 0 && params.requestId) {
            try {
              const requestId = parseInt(params.requestId, 10);
              const firstSelectedProvider = selectedProviders[0];
              
              // Use the real provider ID stored in providerId field
              const providerId = firstSelectedProvider.providerId;
              
              if (requestId && providerId) {
                await serviceRequestService.selectProvider(requestId, providerId);
                
                haptics.success();
                showSuccess('Provider selected! They have 5 minutes to accept.');
              }
            } catch (error: any) {
              // Show error but still proceed to confirmation screen
              showError('Failed to select provider. You can select one later from job details.');
              haptics.error();
            }
          }
          
          haptics.success();
          navigateBookingFlowToConfirmation(router, {
            requestId: params.requestId,
            serviceType: params.serviceType || params.categoryName,
            selectedDate: params.selectedDate,
            selectedTime: params.selectedTime,
            providerCount:
              selectedProviders.length > 0 ? String(selectedProviders.length) : undefined,
          });
        }}
        onEditService={(bookingData) => {
          const categoryHint =
            params.categoryName ||
            bookingData.serviceType ||
            params.serviceType ||
            '';
          router.push({
            pathname: '/(tabs)/categories' as any,
            params: {
              selectedCategoryId: categoryHint,
              returnToServiceMap: 'true',
              requestId: params.requestId,
              preserveData: 'true',
              serviceType: bookingData.serviceType || params.serviceType || '',
              selectedDateTime: bookingData.dateTime || params.selectedDateTime || '',
              selectedDate: bookingData.date || params.selectedDate || '',
              selectedTime: bookingData.time || params.selectedTime || '',
              photoCount: bookingData.photoCount?.toString() || params.photoCount || '',
              location: bookingData.location || serviceLocation || '',
              latitude: params.latitude || '',
              longitude: params.longitude || '',
            },
          } as any);
        }}
        onEditDateTime={(bookingData) => {
          router.push({
            pathname: '/DateTimeScreen' as any,
            params: {
              requestId: params.requestId,
              categoryName: params.categoryName || bookingData.serviceType,
              selectedDateTime: bookingData.dateTime || params.selectedDateTime,
              selectedDate: bookingData.date || params.selectedDate,
              selectedTime: bookingData.time || params.selectedTime,
              serviceType: bookingData.serviceType || params.serviceType,
              photoCount: bookingData.photoCount?.toString() || params.photoCount,
              location: bookingData.location || serviceLocation,
              preserveData: 'true',
              bookingOrigin: 'serviceMap',
            },
          } as any);
        }}
        onEditLocation={(bookingData) => {
          router.push({
            pathname: '/LocationSearchScreen' as any,
            params: {
              requestId: params.requestId,
              next: 'ServiceMapScreen',
              preserveData: 'true',
              serviceType: bookingData.serviceType || params.serviceType,
              selectedDateTime: bookingData.dateTime || params.selectedDateTime,
              selectedDate: bookingData.date || params.selectedDate,
              selectedTime: bookingData.time || params.selectedTime,
              photoCount: bookingData.photoCount?.toString() || params.photoCount,
              location: bookingData.location || serviceLocation,
            },
          } as any);
        }}
        onEditPhotos={(bookingData) => {
          router.push({
            pathname: '/AddPhotosScreen' as any,
            params: {
              requestId: params.requestId,
              categoryName: params.categoryName || bookingData.serviceType,
              selectedDateTime: bookingData.dateTime || params.selectedDateTime,
              selectedDate: bookingData.date || params.selectedDate,
              selectedTime: bookingData.time || params.selectedTime,
              serviceType: bookingData.serviceType || params.serviceType,
              location: bookingData.location || serviceLocation,
              photoCount: bookingData.photoCount?.toString() || params.photoCount,
              preserveData: 'true',
            },
          } as any);
        }}
        onEditProviders={(bookingData) => {
          // Stay on current screen, just close modal to allow editing
          // Selected providers are already in state, so user can modify them
          setShowSummaryModal(false);
        }}
        data={{
          serviceType: bookingData.serviceType || params.serviceType || 'Plumbing Service',
          dateTime: bookingData.dateTime || params.selectedDateTime,
          date: bookingData.date || params.selectedDate,
          time: bookingData.time || params.selectedTime,
          location: serviceLocation || bookingData.location || savedLocation || 'Location not set',
          photoCount: bookingData.photoCount ?? (params.photoCount ? parseInt(params.photoCount, 10) : 0),
          photoUris: bookingPhotoUris,
          selectedProviders: selectedProviders.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            image: p.image,
          })),
        }}
      />
    </SafeAreaWrapper>
  );
};

export default ServiceMapScreen;
