import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import Toast from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { haptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { useUserLocation } from '@/hooks/useUserLocation';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { LocationSearchResult, LocationDetails, locationService, authService, UpdateLocationPayload } from '@/services/api';
import { AuthError } from '@/utils/errors';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { appendAddressBookExtra } from '@/utils/addressBookExtras';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Search, Send } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LocationSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    next?: string;
    categoryName?: string; // Add categoryName support
    serviceType?: string;
    selectedDateTime?: string;
    selectedDate?: string;
    selectedTime?: string;
    photoCount?: string;
    location?: string;
  }>();
  const next = params?.next;
  const { location, setLocation, refreshLocation } = useUserLocation();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [selectedLocationDetails, setSelectedLocationDetails] = useState<LocationDetails | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }, []);

  useEffect(() => {
    if (location) {
      setSearchQuery(location);
    }
  }, [location]);

  // Debounced location search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is too short, clear results
    if (!searchQuery || (typeof searchQuery === 'string' && searchQuery.trim().length < 2)) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    // Set searching state
    setIsSearching(true);
    setShowResults(true);
    setSearchError(null);

    // Debounce search by 400ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const query = typeof searchQuery === 'string' ? searchQuery.trim() : '';
        if (!query) {
          setIsSearching(false);
          return;
        }
        
        const results = await locationService.searchLocations(query);
        
        // Check if we got valid results
        if (results && Array.isArray(results) && results.length > 0) {
          setSearchResults(results);
          setSearchError(null);
        } else {
          // Empty results - no locations found for this query
          setSearchResults([]);
          setSearchError(null); // Clear error, just show "no results" message
        }
        setIsSearching(false);
      } catch (error: any) {
        if (error instanceof AuthError) {
          await handleAuthErrorRedirect(router);
          return;
        }
        if (__DEV__) {
          console.error('Error searching locations:', error);
        }
        setSearchResults([]);
        setIsSearching(false);
        
        // Extract error message
        const errorMessage = error.details?.data?.error || error.details?.error || error.message || '';
        const isNetworkError = errorMessage.includes('Network') || 
                              errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('Network request failed');
        const isGoogleApiKeyError = errorMessage.includes('API key') || 
                                     errorMessage.includes('REQUEST_DENIED') ||
                                     errorMessage.includes('Google Maps');
        
        if (isNetworkError) {
          setSearchError('Unable to connect. Please check your internet connection and try again.');
          if (__DEV__) {
            console.error('Network error during location search:', error);
          }
        } else if (isGoogleApiKeyError) {
          setSearchError('Location search is temporarily unavailable. Please enter your location manually.');
          if (__DEV__) {
            console.warn('⚠️ Backend Google Maps API Key Missing - Location search disabled.');
          }
        } else {
          setSearchError('Unable to search locations. Please try again or enter manually.');
          if (__DEV__) {
            console.error('Location search error:', {
              message: error.message,
              status: error.status,
              details: error.details,
              query: searchQuery,
            });
          }
        }
      }
    }, 400);

    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleBack = () => {
    haptics.light();
    router.back();
  };

  const handleSelectLocation = async (result: LocationSearchResult) => {
    haptics.light();
    setSelectedLocation(result);
    setSearchQuery(result.fullAddress);
    setShowResults(false);
    
    // Get full details (coordinates, city, state, country) from API
    if (result.placeId && !result.placeId.startsWith('lat_')) {
      try {
        const details = await locationService.getLocationDetails(result.placeId);
        setSelectedLocationDetails(details);
      } catch (error) {
        setSelectedLocationDetails(null);
      }
    } else {
      setSelectedLocationDetails(null);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      haptics.light();
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        showError('Location permission is required to use current location.');
        return;
      }

      setIsSearching(true);
      
      // Use highest accuracy for precise location with optimal settings
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // Most accurate GPS (within 10 meters)
        maximumAge: 5000, // Accept location up to 5 seconds old (fresher data)
        timeout: 20000, // Wait up to 20 seconds for accurate location
        mayShowUserSettingsDialog: true, // Allow user to enable location services if disabled
      });

      const { latitude, longitude } = currentLocation.coords;
      
      
      // Validate coordinates - reject obviously wrong locations (like San Francisco default)
      // Nigeria coordinates range: Latitude: 4.0 to 14.0, Longitude: 2.7 to 14.7
      // San Francisco: 37.785834, -122.406417 (should be rejected if user is in Nigeria)
      const isLikelyNigeria = latitude >= 4.0 && latitude <= 14.0 && longitude >= 2.7 && longitude <= 14.7;
      const isLikelySanFrancisco = Math.abs(latitude - 37.785834) < 0.1 && Math.abs(longitude - (-122.406417)) < 0.1;
      
      
      // If coordinates look like San Francisco default and user is likely in Nigeria, warn
      if (isLikelySanFrancisco && !isLikelyNigeria && __DEV__) {
        console.warn('Simulator default location detected');
      }
      
      // Use API for reverse geocoding
      try {
        const locationDetails = await locationService.getCurrentLocation(latitude, longitude);
        
        // If we get here, we have a valid address from the API
        // Generate placeId from coordinates if not provided by reverse geocoding
        const placeId = locationDetails.placeId || `lat_${latitude}_${longitude}`;
        
        const result: LocationSearchResult = {
          placeId: placeId,
          placeName: locationDetails.city || locationDetails.formattedAddress || 'Current Location',
          fullAddress: locationDetails.formattedAddress,
          address: locationDetails.city && locationDetails.state 
            ? `${locationDetails.city}, ${locationDetails.state}`
            : locationDetails.formattedAddress,
        };
        
        setSelectedLocation(result);
        setSelectedLocationDetails(locationDetails);
        setSearchQuery(locationDetails.formattedAddress);
        setShowResults(false);
        
        // Automatically save to backend if user is signed in
        // BUT: Skip auto-save for providers (they save via providerService.updateLocation in ProviderProfileSetupScreen)
        const isProvider = next === 'provider-profile-setup';
        
        
        if (!isProvider) {
          // Only auto-save for regular users, not providers
          const userId = await authService.getUserId();
          if (userId) {
            try {
              const payload: UpdateLocationPayload = {
                placeId: locationDetails.placeId,
                address: locationDetails.address,
                formattedAddress: locationDetails.formattedAddress,
                latitude: locationDetails.latitude || latitude,
                longitude: locationDetails.longitude || longitude,
                city: locationDetails.city,
                state: locationDetails.state,
                country: locationDetails.country,
              };
              await locationService.saveUserLocation(userId, payload);
              // Also save locally
              await setLocation(locationDetails.formattedAddress);
              await refreshLocation();
            } catch (saveError: any) {
              // Log but don't fail - location is still selected
              // Still save locally
              await setLocation(locationDetails.formattedAddress);
            }
          } else {
            // Save locally even if not signed in
            await setLocation(locationDetails.formattedAddress);
          }
        } else {
          // For providers: Only save locally, will be saved to provider endpoint in ProviderProfileSetupScreen
          await setLocation(locationDetails.formattedAddress);
        }
        
        showSuccess('Current location detected and saved!');
      } catch (error: any) {
        if (__DEV__) {
          console.error('Error getting current location:', error);
        }
        
        // Check error type
        const errorMessage = error.details?.data?.error || error.details?.error || error.message || '';
        const isNetworkError = errorMessage.includes('Network') || 
                              errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('Network request failed');
        const isGoogleApiKeyError = errorMessage.includes('API key') || 
                                     errorMessage.includes('REQUEST_DENIED') ||
                                     errorMessage.includes('Google Maps');
        
        if (isNetworkError) {
          showError('Unable to connect. Please check your internet connection and try again.');
        } else if (isGoogleApiKeyError) {
          showError('Location service is temporarily unavailable. Please search for your location manually.');
        } else {
          // Show more specific error message if available
          const userMessage = errorMessage && errorMessage.length < 100 
            ? errorMessage 
            : 'Unable to get address for your location. Please search for your location manually.';
          showError(userMessage);
        }
      }
    } catch (error) {
      showError('Failed to get current location. Please enter manually.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedLocation && (!searchQuery || (typeof searchQuery === 'string' && !searchQuery.trim()))) {
      showError('Please select or enter a location');
      return;
    }

    setIsSaving(true);
    haptics.light();

    try {
      // Check if this is a provider profile setup (providers don't use user location endpoint)
      const isProvider = next === 'provider-profile-setup';
      
      if (isProvider) {
        // For providers: Just save locally and navigate, location will be saved via providerService.updateLocation in ProviderProfileSetupScreen
        if (selectedLocation?.fullAddress) {
          await setLocation(selectedLocation.fullAddress);
        } else if (searchQuery && typeof searchQuery === 'string') {
          await setLocation(searchQuery.trim());
        }
        
        
        showSuccess('Location selected!');
        haptics.success();
        
        setTimeout(() => {
          handleNavigation();
        }, 1000);
        setIsSaving(false);
        return;
      }
      
      // For regular users: Save to user location endpoint
      const userId = await authService.getUserId();
      
      if (!userId) {
        // If no user ID, just save locally
        if (searchQuery && typeof searchQuery === 'string') {
          await setLocation(searchQuery.trim());
        }
        showSuccess('Location saved successfully!');
        setTimeout(() => {
          handleNavigation();
        }, 1000);
        setIsSaving(false);
        return;
      }

      // If we have a selected location with placeId, use it
      if (selectedLocation?.placeId) {
        try {
          let payload: UpdateLocationPayload;
          if (selectedLocationDetails) {
            payload = {
              placeId: selectedLocationDetails.placeId || selectedLocation.placeId,
              address: selectedLocationDetails.address,
              formattedAddress: selectedLocationDetails.formattedAddress || selectedLocation.fullAddress,
              latitude: selectedLocationDetails.latitude,
              longitude: selectedLocationDetails.longitude,
              city: selectedLocationDetails.city,
              state: selectedLocationDetails.state,
              country: selectedLocationDetails.country,
            };
          } else if (selectedLocation.placeId.startsWith('lat_')) {
            const coordMatch = selectedLocation.placeId.match(/lat_([\d.-]+)_([\d.-]+)/);
            if (coordMatch?.[1] != null && coordMatch?.[2] != null) {
              const lat = parseFloat(coordMatch[1]);
              const lng = parseFloat(coordMatch[2]);
              if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                payload = {
                  placeId: selectedLocation.placeId,
                  formattedAddress: selectedLocation.fullAddress,
                  address: selectedLocation.address,
                  latitude: lat,
                  longitude: lng,
                };
              } else {
                throw new Error('Invalid coordinates extracted from placeId');
              }
            } else {
              throw new Error('Invalid generated placeId format');
            }
          } else {
            const details = await locationService.getLocationDetails(selectedLocation.placeId);
            payload = {
              placeId: details.placeId || selectedLocation.placeId,
              address: details.address || selectedLocation.address,
              formattedAddress: details.formattedAddress || selectedLocation.fullAddress,
              latitude: details.latitude,
              longitude: details.longitude,
              city: details.city,
              state: details.state,
              country: details.country,
            };
          }
          await locationService.saveUserLocation(userId, payload);
          
          // Also save locally for offline access
          await setLocation(selectedLocation.fullAddress);
          
          // Refresh location in hook
          await refreshLocation();

          if (next === 'AddressBookScreen') {
            try {
              await appendAddressBookExtra({
                fullAddress: (payload.formattedAddress || selectedLocation.fullAddress || '').trim(),
                placeId: payload.placeId,
                latitude: payload.latitude,
                longitude: payload.longitude,
              });
            } catch {
              /* non-fatal */
            }
          }
          
          
          showSuccess('Location saved successfully!');
          haptics.success();
          
          setTimeout(() => {
            handleNavigation();
          }, 1000);
        } catch (error: any) {
          // Fallback to local storage
          await setLocation(selectedLocation.fullAddress);
          if (next === 'AddressBookScreen') {
            try {
              await appendAddressBookExtra({
                fullAddress: selectedLocation.fullAddress.trim(),
                placeId: selectedLocation.placeId,
              });
            } catch {
              /* ignore */
            }
          }
          showSuccess('Location saved locally!');
          setTimeout(() => {
            handleNavigation();
          }, 1000);
        }
      } else {
        // If no placeId, try to get location details from search query
        // For now, just save locally
        await setLocation(searchQuery.trim());
        if (next === 'AddressBookScreen' && typeof searchQuery === 'string' && searchQuery.trim()) {
          try {
            await appendAddressBookExtra({ fullAddress: searchQuery.trim() });
          } catch {
            /* ignore */
          }
        }
        showSuccess('Location saved successfully!');
        setTimeout(() => {
          handleNavigation();
        }, 1000);
      }
    } catch (error: any) {
      if (error instanceof AuthError) {
        await handleAuthErrorRedirect(router);
        return;
      }
      if (__DEV__) {
        console.error('Error saving location:', error);
      }
      const errorMessage = getSpecificErrorMessage(error, 'save_location');
      showError(errorMessage);
      haptics.error();
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavigation = async () => {
    if (next === 'ProfileSetupScreen') {
      router.replace('/ProfileSetupScreen');
    } else if (next === 'provider-profile-setup') {
      // Navigate back to ProviderProfileSetupScreen with EXACT location data from API
      // Get address from selectedLocation or searchQuery - MUST be a non-empty string
      let locationData: string = '';
      
      if (selectedLocation?.fullAddress && typeof selectedLocation.fullAddress === 'string' && selectedLocation.fullAddress.trim()) {
        locationData = selectedLocation.fullAddress.trim();
      } else if (selectedLocation?.address && typeof selectedLocation.address === 'string' && selectedLocation.address.trim()) {
        locationData = selectedLocation.address.trim();
      } else if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        locationData = searchQuery.trim();
      }
      
      // VALIDATE: Ensure we have a valid address string before proceeding
      if (!locationData || locationData.length === 0) {
        showError('Please select or enter a valid location address');
        setIsSaving(false);
        return;
      }
      
      // Clean the address: remove extra whitespace, newlines, tabs, etc.
      locationData = locationData.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Ensure address is still valid after cleaning
      if (!locationData || locationData.length === 0) {
        showError('Please select or enter a valid location address');
        setIsSaving(false);
        return;
      }
      
      const placeIdData = selectedLocation?.placeId || null;
      
      // Get EXACT coordinates from API (use stored details or fetch if needed)
      let exactLatitude: number | undefined;
      let exactLongitude: number | undefined;
      
      // First, use stored location details if available (from handleSelectLocation)
      if (selectedLocationDetails?.latitude && selectedLocationDetails?.longitude) {
        exactLatitude = selectedLocationDetails.latitude;
        exactLongitude = selectedLocationDetails.longitude;
      } else if (placeIdData && !placeIdData.startsWith('lat_')) {
        // Fetch exact coordinates from API if not already stored
        try {
          const locationDetails = await locationService.getLocationDetails(placeIdData);
          exactLatitude = locationDetails.latitude;
          exactLongitude = locationDetails.longitude;
        } catch (error) {
          // Silently fail - will use placeId only
        }
      } else if (placeIdData && placeIdData.startsWith('lat_')) {
        // Extract coordinates from generated placeId
        const coordMatch = placeIdData.match(/lat_([\d.-]+)_([\d.-]+)/);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
          exactLatitude = parseFloat(coordMatch[1]);
          exactLongitude = parseFloat(coordMatch[2]);
        }
      }
      
      router.replace({
        pathname: '/ProviderProfileSetupScreen',
        params: {
          location: locationData, // NOW GUARANTEED TO BE A NON-EMPTY STRING
          placeId: placeIdData || undefined,
          formattedAddress: locationData, // Same as location (cleaned)
          latitude: exactLatitude?.toString(),
          longitude: exactLongitude?.toString(),
        },
      } as any);
    } else if (next === 'AddressBookScreen') {
      router.back();
    } else if (next === 'ServiceMapScreen') {
      // Get coordinates if available
      let latitude: string | undefined;
      let longitude: string | undefined;
      
      if (selectedLocationDetails?.latitude && selectedLocationDetails?.longitude) {
        latitude = selectedLocationDetails.latitude.toString();
        longitude = selectedLocationDetails.longitude.toString();
      } else if (selectedLocation?.placeId) {
        // Try to get coordinates from placeId
        try {
          if (selectedLocation.placeId.startsWith('lat_')) {
            // Extract coordinates from generated placeId
            const coordMatch = selectedLocation.placeId.match(/lat_([\d.-]+)_([\d.-]+)/);
            if (coordMatch && coordMatch[1] && coordMatch[2]) {
              latitude = coordMatch[1];
              longitude = coordMatch[2];
            }
          } else {
            // Fetch coordinates from API using placeId
            const locationDetails = await locationService.getLocationDetails(selectedLocation.placeId);
            latitude = locationDetails.latitude.toString();
            longitude = locationDetails.longitude.toString();
          }
        } catch (error) {
          // If we can't get coordinates, still navigate - ServiceMapScreen will try to get them
        }
      }
      
      // Navigate back to ServiceMapScreen with all booking params preserved
      router.replace({
        pathname: '/ServiceMapScreen' as any,
        params: {
          categoryName: params.categoryName, // Pass categoryName (primary)
          serviceType: params.serviceType || params.categoryName, // Use categoryName as fallback
          selectedDateTime: params.selectedDateTime,
          selectedDate: params.selectedDate,
          selectedTime: params.selectedTime,
          photoCount: params.photoCount,
          location: (searchQuery && typeof searchQuery === 'string') ? searchQuery.trim() : '', // Updated location
          latitude: latitude, // Pass coordinates
          longitude: longitude, // Pass coordinates
        },
      } as any);
    } else {
      router.back();
    }
  };

  const renderSearchResult = ({ item }: { item: LocationSearchResult }) => (
    <TouchableOpacity
      onPress={() => handleSelectLocation(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: Colors.backgroundGray,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <MapPin size={20} color={Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: Colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {item.placeName}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Poppins-Regular',
            color: Colors.textSecondaryDark,
          }}
        >
          {item.fullAddress}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <Animated.View 
        style={{ 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          flex: 1,
        }}
      >
        <ScreenHeader title="Find location" onBack={handleBack} backgroundColor={Colors.backgroundLight} />

        <View style={{ flex: 1 }}>
          {/* Search Input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 16,
              gap: 12,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.xl,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: showResults ? Colors.accent : Colors.border,
              }}
            >
              <TextInput
                placeholder="Search for a location..."
                placeholderTextColor={Colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleConfirm}
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textPrimary,
                }}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={{
                width: 48,
                height: 48,
                backgroundColor: Colors.black,
                borderRadius: BorderRadius.default,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
              onPress={handleConfirm}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Search size={20} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>

          {/* Use Current Location */}
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            disabled={isSearching}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 16,
              opacity: isSearching ? 0.5 : 1,
            }}
            activeOpacity={0.7}
          >
            <Send size={20} color={Colors.accent} style={{ marginRight: 12 }} />
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.accent,
              }}
            >
              {isSearching ? 'Getting location...' : 'Use my current location'}
            </Text>
          </TouchableOpacity>

          {/* Search Results */}
          {showResults && searchQuery && typeof searchQuery === 'string' && searchQuery.trim().length >= 2 && (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.white,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              {isSearching && searchResults.length === 0 && !searchError ? (
                <View
                  style={{
                    padding: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    Searching...
                  </Text>
                </View>
              ) : searchError ? (
                <View
                  style={{
                    padding: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.error,
                      textAlign: 'center',
                      marginBottom: 8,
                    }}
                  >
                    {searchError}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      textAlign: 'center',
                    }}
                  >
                    You can still type and save your location manually.
                  </Text>
                </View>
              ) : searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  renderItem={renderSearchResult}
                  keyExtractor={(item) => item.placeId}
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                />
              ) : (
                <View
                  style={{
                    padding: 20,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    No locations found. Try a different search.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Selected Location Display */}
          {selectedLocation && !showResults && (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 100,
              }}
            >
              <View
                style={{
                  backgroundColor: '#FFF9E6',
                  borderRadius: BorderRadius.xl,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                    marginBottom: 4,
                  }}
                >
                  {selectedLocation.placeName}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    lineHeight: 20,
                  }}
                >
                  {selectedLocation.fullAddress}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Save Button */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            backgroundColor: Colors.white,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          <Button
            title={isSaving ? 'Saving...' : 'Save location'}
            onPress={handleConfirm}
            variant="primary"
            size="large"
            fullWidth
            loading={isSaving}
            disabled={isSaving || (!selectedLocation && (!searchQuery || (typeof searchQuery === 'string' && !searchQuery.trim())))}
          />
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
