import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { useRouter } from 'expo-router';
import { MapPin, Plus } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import * as Location from 'expo-location';
import { useUserLocation } from '@/hooks/useUserLocation';
import { locationService, authService } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Colors, MIN_TOUCH_TARGET, Spacing, TOUCH_HIT_SLOP } from '@/lib/designSystem';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';

export default function LocationPermissionScreen() {
  const router = useRouter();
  const { setLocation } = useUserLocation();
  const { toast, showError, showSuccess, hideToast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleAllowLocation = async () => {
    setIsRequesting(true);

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setIsRequesting(false);
        showAppAlert(
          'Permission Denied',
          'Location permission is required to find nearby services. You can enter your location manually instead.',
          [
            { text: 'Enter Manually', onPress: handleManualEntry },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      setIsRequesting(false);
      setIsGettingLocation(true);
      showSuccess('Location access granted. Getting your location…');

      // Get current location with highest accuracy and optimal settings
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // Most accurate GPS (within 10 meters)
        maximumAge: 5000, // Accept location up to 5 seconds old (fresher data)
        timeout: 20000, // Wait up to 20 seconds for accurate location
        mayShowUserSettingsDialog: true, // Allow user to enable location services if disabled
      });
      
      // Validate coordinates - check if they look like default/mock location
      if (__DEV__) {
        const isLikelyNigeria = location.coords.latitude >= 4.0 && location.coords.latitude <= 14.0 &&
          location.coords.longitude >= 2.7 && location.coords.longitude <= 14.7;
        const isLikelySanFrancisco = Math.abs(location.coords.latitude - 37.785834) < 0.1 &&
          Math.abs(location.coords.longitude - (-122.406417)) < 0.1;
        if (isLikelySanFrancisco && !isLikelyNigeria) {
          console.warn('Simulator default location detected');
        }
      }

      const { latitude, longitude } = location.coords;

      // Get address from API (reverse geocoding)
      const locationDetails = await locationService.getCurrentLocation(latitude, longitude);
      
      // Always save to local storage first (works without sign-in)
      await setLocation(locationDetails.formattedAddress);
      
      // Try to save to API if user is signed in (optional)
      const userId = await authService.getUserId();
      if (userId) {
        try {
          await locationService.saveUserLocation(userId, {
            placeId: locationDetails.placeId,
            address: locationDetails.address,
            formattedAddress: locationDetails.formattedAddress,
            latitude: locationDetails.latitude,
            longitude: locationDetails.longitude,
            city: locationDetails.city,
            state: locationDetails.state,
            country: locationDetails.country,
          });
        } catch (apiError: any) {
          // API save failed, but local save succeeded - log warning but don't fail
          if (__DEV__) {
            console.warn('Failed to save location to API, but saved locally:', apiError.message);
          }
        }
      }
      
      showSuccess('Location saved');
      
      // Navigate to profile setup after a brief delay
      setTimeout(() => {
        router.replace('/ProfileSetupScreen');
      }, 1500);

    } catch (error) {
      setIsRequesting(false);
      setIsGettingLocation(false);
      console.error('Error getting location:', error);
      showError('Failed to get your location. Please try entering it manually.');
      
      // Offer manual entry as fallback
      setTimeout(() => {
        showAppAlert(
          'Location Error',
          'We couldn\'t get your location automatically. Would you like to enter it manually?',
          [
            { text: 'Enter Manually', onPress: handleManualEntry },
            { text: 'Skip for Now', onPress: handleLater },
          ]
        );
      }, 2000);
    }
  };

  const handleManualEntry = () => {
    // Go to the search screen specifically to pick a location,
    // then continue to profile setup instead of coming back here.
    router.push({
      pathname: '/LocationSearchScreen',
      params: { next: 'ProfileSetupScreen' },
    } as any);
  };

  const handleLater = () => {
    // Skip location for now but still move forward
    // User can set location later in profile settings
    router.replace('/ProfileSetupScreen');
  };

  return (
    <SafeAreaWrapper>
      <View className="flex-1 justify-center items-center px-8">
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            marginBottom: Spacing.xxl,
          }}
        >
          <View
            style={{
              width: 128,
              height: 128,
              backgroundColor: Colors.accent,
              borderRadius: 64,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <MapPin size={48} color={Colors.black} />
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 32,
                height: 32,
                backgroundColor: Colors.black,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={16} color={Colors.white} />
            </View>
          </View>
        </Animated.View>
        <Animated.Text
          style={{
            opacity: fadeAnim,
            fontSize: 24,
            fontFamily: 'Poppins-ExtraBold',
            color: Colors.textPrimary,
            textAlign: 'center',
            marginBottom: Spacing.lg,
            lineHeight: 32,
          }}
        >
          Your location?
        </Animated.Text>
        <Animated.Text
          style={{
            opacity: fadeAnim,
            fontSize: 16,
            fontFamily: 'Poppins-Regular',
            color: Colors.textPrimary,
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: Spacing.huge,
          }}
        >
          We need your location to find nearby services and improve your experience.
        </Animated.Text>
        {/* Loading State */}
        {(isRequesting || isGettingLocation) && (
          <Animated.View 
            style={{ 
              opacity: fadeAnim,
              marginBottom: Spacing.lg,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text
              style={{
                marginTop: Spacing.md,
                fontSize: 16,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
              }}
            >
              {isRequesting ? 'Requesting permission...' : 'Getting your location...'}
            </Text>
          </Animated.View>
        )}

        {/* Allow Location Button */}
        {!isRequesting && !isGettingLocation && (
          <Animated.View 
            style={{ 
              opacity: fadeAnim,
              width: '100%',
              marginBottom: Spacing.lg,
            }}
          >
            <Button
              title="Allow Location Access"
              onPress={handleAllowLocation}
              variant="secondary"
              size="large"
              fullWidth
            />
          </Animated.View>
        )}

        {/* Manual Entry Button */}
        {!isRequesting && !isGettingLocation && (
          <Animated.View 
            style={{ 
              opacity: fadeAnim,
              width: '100%',
              marginBottom: Spacing.xxl,
            }}
          >
            <Button
              title="Enter location manually"
              onPress={handleManualEntry}
              variant="outline"
              size="large"
              fullWidth
            />
          </Animated.View>
        )}

        {/* I'll do this later Link */}
        {!isRequesting && !isGettingLocation && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
              onPress={handleLater}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Skip setting your location for now"
              hitSlop={TOUCH_HIT_SLOP}
              style={{
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: Spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: 'Poppins-Medium',
                  color: Colors.textPrimary,
                  textAlign: 'center',
                  textDecorationLine: 'underline',
                }}
              >
                I&apos;ll do this later
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}
