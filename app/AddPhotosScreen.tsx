import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Plus, X } from 'lucide-react-native';
import { navigateBookingStepBack } from '@/utils/bookingFlowNavigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

const BOOKING_PHOTO_URIS_KEY = '@ghands:booking_photo_uris';

interface PhotoItem {
  id: string;
  uri: string;
  selected: boolean;
}

export default function AddPhotosScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const IMAGE_SIZE = (screenWidth - 48) / 3 - 8;
  const params = useLocalSearchParams<{ 
    requestId?: string;
    categoryName?: string;
    selectedDateTime?: string; 
    selectedDate?: string; 
    selectedTime?: string;
    serviceType?: string;
    location?: string;
    photoCount?: string;
    preserveData?: string;
    fromAiAssistant?: string;
    bookingOrigin?: string;
    conversationId?: string;
  }>();
  const { toast, showError, showWarning, hideToast } = useToast();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isFindingProviders, setIsFindingProviders] = useState(false);
  
  // Restore photo count from params if editing
  useEffect(() => {
    if (params.preserveData === 'true' && params.photoCount) {
      const count = parseInt(params.photoCount, 10);
      // You can restore selected photos count here if needed
      // For now, we just ensure the count is preserved
    }
  }, [params]);

  useEffect(() => {
    if (params.fromAiAssistant !== 'true') return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(BOOKING_PHOTO_URIS_KEY);
        if (!raw || cancelled) return;
        const uris = JSON.parse(raw) as unknown;
        if (!Array.isArray(uris)) return;
        const valid = uris.filter((u): u is string => typeof u === 'string' && u.length > 0);
        if (valid.length === 0) return;
        const imported = valid.map((uri) => ({
          id: `photo-ai-${Date.now()}-${Math.random()}`,
          uri,
          selected: true,
        }));
        setPhotos(imported);
        setSelectedPhotos(new Set(imported.map((p) => p.id)));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.fromAiAssistant]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const spinnerAnim = useRef(new Animated.Value(0)).current;
  const findingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    let loopingAnimation: Animated.CompositeAnimation | null = null;
    if (isFindingProviders) {
      loopingAnimation = Animated.loop(
        Animated.timing(spinnerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      );
      spinnerAnim.setValue(0);
      loopingAnimation.start();
    } else {
      spinnerAnim.stopAnimation(() => {
        spinnerAnim.setValue(0);
      });
    }

    return () => {
      loopingAnimation?.stop();
    };
  }, [isFindingProviders, spinnerAnim]);

  useEffect(() => {
    return () => {
      if (findingTimeoutRef.current) {
        clearTimeout(findingTimeoutRef.current);
      }
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Camera roll permissions are required to upload images');
      return false;
    }
    return true;
  }, [showError]);

  const requestCameraPermissions = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showError('Camera permissions are required to take photos');
      return false;
    }
    return true;
  }, [showError]);

  const handleOpenGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newPhotos = result.assets.map((asset) => ({
        id: `photo-${Date.now()}-${Math.random()}`,
        uri: asset.uri,
        selected: true,
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
      setSelectedPhotos((prev) => {
        const newSet = new Set(prev);
        newPhotos.forEach((photo) => newSet.add(photo.id));
        return newSet;
      });
    }
  }, []);

  const handleOpenCamera = useCallback(async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newPhotos = result.assets.map((asset) => ({
        id: `photo-${Date.now()}-${Math.random()}`,
        uri: asset.uri,
        selected: true,
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
      setSelectedPhotos((prev) => {
        const newSet = new Set(prev);
        newPhotos.forEach((photo) => newSet.add(photo.id));
        return newSet;
      });
    }
  }, [requestCameraPermissions]);

  const handleUploadPhotos = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    // For now, directly open gallery. In a full implementation, you'd show a bottom sheet
    handleOpenGallery();
  }, [requestPermissions, handleOpenGallery]);

  const handleTogglePhoto = useCallback((photoId: string) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  const handleRemovePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      newSet.delete(photoId);
      return newSet;
    });
  }, []);

  const handleDone = useCallback(() => {
    if (isFindingProviders) {
      return;
    }
    // Photos are now optional - allow proceeding without photos
    setIsFindingProviders(true);

    if (findingTimeoutRef.current) {
      clearTimeout(findingTimeoutRef.current);
    }

    findingTimeoutRef.current = setTimeout(async () => {
      setIsFindingProviders(false);
      // Store photo URIs for preview in Booking Summary
      const selectedUris = photos
        .filter((p) => selectedPhotos.has(p.id))
        .map((p) => p.uri);
      try {
        await AsyncStorage.setItem(BOOKING_PHOTO_URIS_KEY, JSON.stringify(selectedUris));
      } catch {
        // Non-fatal; preview just won't show
      }
      // Push so back from map returns to Add photos; booking stack stays intact
      router.push({
        pathname: '/ServiceMapScreen' as any,
        params: {
          requestId: params.requestId, // Pass requestId for provider selection
          categoryName: params.categoryName, // Pass categoryName (primary)
          serviceType: params.serviceType || params.categoryName, // Use categoryName as fallback
          selectedDateTime: params.selectedDateTime,
          selectedDate: params.selectedDate,
          selectedTime: params.selectedTime,
          photoCount: selectedPhotos.size.toString(),
          location: params.location,
          fromAiAssistant: params.fromAiAssistant,
          bookingOrigin: params.bookingOrigin,
          conversationId: params.conversationId,
        },
      } as any);
    }, 500);
  }, [isFindingProviders, selectedPhotos, photos, router, params]);

  const goBackToDateTime = useCallback(() => {
    if (!params.requestId) {
      navigateBookingStepBack(router, params);
      return;
    }
    router.replace({
      pathname: '/DateTimeScreen' as any,
      params: {
        requestId: params.requestId,
        categoryName: params.categoryName,
        selectedDate: params.selectedDate,
        selectedTime: params.selectedTime,
        selectedDateTime: params.selectedDateTime,
        serviceType: params.serviceType,
        location: params.location,
        photoCount: params.photoCount,
        fromAiAssistant: params.fromAiAssistant,
        bookingOrigin: params.bookingOrigin,
        conversationId: params.conversationId,
      },
    } as any);
  }, [params, router]);

  const handleCancel = useCallback(() => {
    goBackToDateTime();
  }, [goBackToDateTime]);

  const handleBack = useCallback(() => {
    goBackToDateTime();
  }, [goBackToDateTime]);

  const animatedStyles = useRef({
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  }).current;

  const spin = spinnerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Photos are optional, so user can always proceed
  const canProceed = true;

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <Animated.View style={[animatedStyles, { flex: 1 }]}>
        <ScreenHeader title="Add photos" onBack={handleBack} backgroundColor={Colors.backgroundLight} />

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View
            className="items-center mb-6"
            style={{
              backgroundColor: Colors.sageSurface,
              borderRadius: BorderRadius.sageHero,
              borderWidth: 1,
              borderColor: Colors.borderSage,
              padding: Spacing.xl,
            }}
          >
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: Colors.sageTint }}
            >
              <Camera size={34} color={Colors.accent} />
            </View>
            <Text className="text-lg mb-2 text-center" style={{ fontFamily: 'Poppins-Bold', color: Colors.textPrimary }}>
              Add photos of the issue
            </Text>
            <Text className="text-sm text-center" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted, lineHeight: 20 }}>
              Help providers understand the problem better. You can skip this step if you don&apos;t have photos.
            </Text>
          </View>

          <View className="mb-6">
            <Button
              title="Upload Photos"
              onPress={handleUploadPhotos}
              variant="primary"
              size="large"
              fullWidth
              icon={<Plus size={20} color={Colors.white} />}
              iconPosition="left"
            />
          </View>

          {photos.length > 0 && (
            <View className="mb-6">
              <Text className="text-black mb-3" style={{ fontFamily: 'Poppins-Bold', fontSize: 15 }}>
                Selected photos ({selectedPhotos.size})
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {photos.map((photo) => {
                  const isSelected = selectedPhotos.has(photo.id);
                  return (
                    <TouchableOpacity
                      key={photo.id}
                      onPress={() => handleTogglePhoto(photo.id)}
                      activeOpacity={0.8}
                      className="relative"
                      style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
                    >
                      <Image
                        source={{ uri: photo.uri }}
                        className="w-full h-full rounded-xl"
                        resizeMode="cover"
                      />
                      <View
                        className="absolute inset-0 rounded-xl border-2"
                        style={{
                          borderColor: isSelected ? Colors.accent : 'transparent',
                          backgroundColor: isSelected ? Colors.successLight : 'transparent',
                        }}
                      >
                        {isSelected && (
                          <View
                            className="absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center"
                            style={{ backgroundColor: Colors.accent }}
                          >
                            <View className="w-3 h-3 rounded-full bg-white" />
                          </View>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(photo.id);
                        }}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/50 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                      >
                        <X size={14} color={Colors.white} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {photos.length === 0 && (
            <View
              className="mb-6"
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.lg,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text className="text-black mb-3" style={{ fontFamily: 'Poppins-Bold', fontSize: 15 }}>
                Photo preview
              </Text>
              <View className="flex-row gap-2">
              {[1, 2, 3].map((index) => (
                <View
                  key={index}
                  className="rounded-xl border-2 border-dashed items-center justify-center"
                  style={{
                    width: IMAGE_SIZE,
                    height: IMAGE_SIZE,
                    borderColor: Colors.borderStrong,
                    backgroundColor: Colors.surfaceSubtle,
                  }}
                >
                  <Camera size={24} color={Colors.tabInactive} />
                </View>
              ))}
              </View>
            </View>
          )}

          <View
            className="rounded-2xl px-4 py-4 mb-6"
            style={{
              backgroundColor: Colors.warningLight,
              borderWidth: 1,
              borderColor: Colors.warning,
            }}
          >
            <View className="flex-row items-center mb-2">
              <Camera size={18} color={Colors.warningForeground} />
              <Text className="text-sm ml-2" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.warningForeground }}>
                Photo Tips
              </Text>
            </View>
            <View className="ml-6">
              <Text className="text-xs mb-1" style={{ fontFamily: 'Poppins-Medium', color: Colors.warningForeground }}>
                • Take clear, well-lit photos
              </Text>
              <Text className="text-xs mb-1" style={{ fontFamily: 'Poppins-Medium', color: Colors.warningForeground }}>
                • Include surrounding area for context
              </Text>
              <Text className="text-xs" style={{ fontFamily: 'Poppins-Medium', color: Colors.warningForeground }}>
                • Show the problem from multiple angles
              </Text>
            </View>
          </View>
        </ScrollView>

        <View
          className="px-4 pb-5 gap-3"
          style={{
            backgroundColor: Colors.backgroundLight,
            borderTopWidth: 1,
            borderTopColor: 'rgba(17,24,39,0.06)',
          }}
        >
          <Button
            title={
              isFindingProviders
                ? 'Matching…'
                : selectedPhotos.size > 0
                  ? 'Continue'
                  : 'Skip & Continue'
            }
            onPress={handleDone}
            variant="secondary"
            size="large"
            fullWidth
            disabled={!canProceed || isFindingProviders}
            loading={isFindingProviders}
          />

          <Button title="Cancel request" onPress={handleCancel} variant="outline" size="large" fullWidth />
        </View>
      </Animated.View>


      {/* Finding Providers Modal */}
      <Modal
        visible={isFindingProviders}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.lg,
              padding: Spacing.xxxl,
              alignItems: 'center',
              minWidth: 280,
              marginHorizontal: 40,
            }}
          >
            <Animated.View
              style={{
                width: 76,
                height: 76,
                borderRadius: BorderRadius.full,
                backgroundColor: Colors.sageTint,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: spin }],
              }}
            >
              <Image source={require('../assets/images/plumbericon2.png')} style={{ width: 42, height: 42, resizeMode: 'contain' }} />
            </Animated.View>
            <Text
              style={{
                marginTop: 20,
                fontSize: 18,
                fontFamily: 'Poppins-SemiBold',
                color: Colors.textPrimary,
              }}
            >
              Finding providers…
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                fontFamily: 'Poppins-Medium',
                color: Colors.textSecondaryDark,
                textAlign: 'center',
              }}
            >
              Sit tight while we match you with trusted professionals nearby.
            </Text>
          </View>
        </View>
      </Modal>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
    </SafeAreaWrapper>
  );
}

