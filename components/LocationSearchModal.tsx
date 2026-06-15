import AnimatedModal from '@/components/AnimatedModal';
import { Button } from '@/components/ui/Button';
import { BorderRadius, Colors, Spacing, MIN_TOUCH_TARGET} from '@/lib/designSystem';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useToast } from '@/hooks/useToast';
import { locationService, authService, LocationSearchResult, UpdateLocationPayload } from '@/services/api';
import Toast from '@/components/Toast';
import * as Location from 'expo-location';
import { Search, Send, X, MapPin } from 'lucide-react-native';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';

interface LocationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected?: (location: string) => void;
}

export default function LocationSearchModal({ visible, onClose, onLocationSelected }: LocationSearchModalProps) {
  const { location, setLocation, refreshLocation } = useUserLocation();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery(location || '');
      setSelectedLocation(null);
      setSearchResults([]);
    }
  }, [visible, location]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await locationService.searchLocations(searchQuery.trim());
          setSearchResults(results);
          // If no results and query is long enough, it might be API configuration issue
          // But don't show error - allow manual entry
        } catch (error) {
          console.error('Search error:', error);
          // Don't show error toast - allow user to type manually
          // The search will just return empty results gracefully
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400); // 400ms debounce
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectLocation = (result: LocationSearchResult) => {
    setSelectedLocation(result);
    setSearchQuery(result.fullAddress);
    setSearchResults([]);
  };

  const handleUseCurrentLocation = async () => {
    try {
      setIsGettingCurrentLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        showError('Location permission is required to use current location.');
        setIsGettingCurrentLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;
      
      // Get address from API
      const locationDetails = await locationService.getCurrentLocation(latitude, longitude);
      
      setSelectedLocation({
        placeId: locationDetails.placeId || `lat_${latitude}_${longitude}`,
        placeName: locationDetails.city || locationDetails.address,
        fullAddress: locationDetails.formattedAddress,
        address: locationDetails.address,
      });
      
      setSearchQuery(locationDetails.formattedAddress);
      setSearchResults([]);
      showSuccess('Current location detected!');
    } catch (error) {
      console.error('Error getting current location:', error);
      showError('Failed to get current location. Please enter manually.');
    } finally {
      setIsGettingCurrentLocation(false);
    }
  };

  const handleSave = async () => {
    if (!selectedLocation && !searchQuery.trim()) {
      showError('Please select or enter a location');
      return;
    }

    setIsSaving(true);

    try {
      let locationToSave: LocationSearchResult | undefined;
      let locationText = '';

      if (selectedLocation) {
        // Use selected location with placeId
        locationToSave = selectedLocation;
        locationText = locationToSave.fullAddress;
      } else {
        // User typed manually, try to get details from search results
        const firstResult = searchResults[0];
        if (firstResult) {
          locationToSave = firstResult;
          locationText = locationToSave.fullAddress;
        } else {
          // Fallback: save as text only
          locationText = searchQuery.trim();
        }
      }

      // Try to save to API first if user is signed in (optional)
      const userId = await authService.getUserId();
      if (userId && locationToSave?.placeId) {
        try {
          let payload: UpdateLocationPayload;
          if (locationToSave.placeId.startsWith('lat_')) {
            const m = locationToSave.placeId.match(/lat_([\d.-]+)_([\d.-]+)/);
            if (m?.[1] != null && m?.[2] != null) {
              const lat = parseFloat(m[1]);
              const lng = parseFloat(m[2]);
              if (!isNaN(lat) && !isNaN(lng)) {
                payload = {
                  placeId: locationToSave.placeId,
                  formattedAddress: locationToSave.fullAddress,
                  address: locationToSave.address,
                  latitude: lat,
                  longitude: lng,
                };
              } else {
                payload = { placeId: locationToSave.placeId };
              }
            } else {
              payload = { placeId: locationToSave.placeId };
            }
          } else {
            const details = await locationService.getLocationDetails(locationToSave.placeId);
            payload = {
              placeId: details.placeId || locationToSave.placeId,
              address: details.address || locationToSave.address,
              formattedAddress: details.formattedAddress || locationToSave.fullAddress,
              latitude: details.latitude,
              longitude: details.longitude,
              city: details.city,
              state: details.state,
              country: details.country,
            };
          }
          await locationService.saveUserLocation(userId, payload);
        } catch (apiError: any) {
          // API save failed, but local save will still succeed - log warning but don't fail
          console.warn('Failed to save location to API, but saved locally:', apiError.message);
          if (__DEV__) {
            console.warn('API Error details:', {
              status: apiError.status,
              message: apiError.message,
            });
          }
        }
      }

      // Always update local storage (works without sign-in, keeps cache in sync)
      if (locationText) {
        await setLocation(locationText);
      }

      if (onLocationSelected) {
        onLocationSelected(locationText);
      }
      
      showSuccess('Location saved successfully!');
      
      setTimeout(() => {
        onClose();
        refreshLocation();
        setIsSaving(false);
      }, 1000);
    } catch (error: any) {
      console.error('Error saving location:', error);
      showError(error.message || 'Failed to save location. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <>
      <AnimatedModal visible={visible} onClose={onClose} animationType="slide">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Change Address</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  placeholder="Search for location..."
                  placeholderTextColor={Colors.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSave}
                  style={styles.searchInput}
                  autoCapitalize="none"
                />
                {isSearching && (
                  <ActivityIndicator size="small" color={Colors.accent} style={styles.searchLoader} />
                )}
              </View>
              <TouchableOpacity
                style={styles.searchButton}
                activeOpacity={0.7}
                onPress={handleSave}
              >
                <Search size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <View style={styles.resultsContainer}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={result.placeId}
                    style={[
                      styles.resultItem,
                      index === searchResults.length - 1 && styles.resultItemLast,
                    ]}
                    onPress={() => handleSelectLocation(result)}
                    activeOpacity={0.7}
                  >
                    <MapPin size={16} color={Colors.accent} style={styles.resultIcon} />
                    <View style={styles.resultContent}>
                      <Text style={styles.resultName}>{result.placeName}</Text>
                      <Text style={styles.resultAddress} numberOfLines={1}>
                        {result.fullAddress}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Use Current Location */}
            <TouchableOpacity
              onPress={handleUseCurrentLocation}
              style={styles.currentLocationButton}
              activeOpacity={0.7}
              disabled={isGettingCurrentLocation}
            >
              {isGettingCurrentLocation ? (
                <ActivityIndicator size="small" color={Colors.accent} style={styles.currentLocationIcon} />
              ) : (
                <Send size={20} color={Colors.accent} style={styles.currentLocationIcon} />
              )}
              <Text style={styles.currentLocationText}>
                {isGettingCurrentLocation ? 'Getting location...' : 'Use my current location'}
              </Text>
            </TouchableOpacity>

            {/* Selected Location Display */}
            {selectedLocation && (
              <View style={styles.selectedLocationContainer}>
                <MapPin size={16} color={Colors.accent} style={styles.selectedIcon} />
                <View style={styles.selectedContent}>
                  <Text style={styles.selectedName}>{selectedLocation.placeName}</Text>
                  <Text style={styles.selectedAddress} numberOfLines={2}>
                    {selectedLocation.fullAddress}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Save Button */}
          <View style={styles.actions}>
            <Button
              title={isSaving ? 'Saving...' : 'Save location'}
              onPress={handleSave}
              variant="primary"
              size="large"
              fullWidth
              loading={isSaving}
              disabled={isSaving || (!selectedLocation && !searchQuery.trim())}
            />
          </View>
        </View>
      </AnimatedModal>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  searchInputContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundGray,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
  },
  searchLoader: {
    marginLeft: Spacing.sm,
  },
  searchButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultItemLast: {
    borderBottomWidth: 0,
  },
  resultIcon: {
    marginRight: Spacing.md,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  resultAddress: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  currentLocationIcon: {
    marginRight: Spacing.md,
  },
  currentLocationText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: Colors.accent,
  },
  selectedLocationContainer: {
    backgroundColor: '#FFF9E6',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  selectedIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  selectedContent: {
    flex: 1,
  },
  selectedName: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  selectedAddress: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    lineHeight: 18,
  },
  actions: {
    marginTop: Spacing.lg,
  },
});
