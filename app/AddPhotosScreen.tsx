import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { Camera, Plus, Search, X } from 'lucide-react-native';
import { navigateBookingStepBack, returnToServiceMap } from '@/utils/bookingFlowNavigation';
import { trackBookingPhotoUpload } from '@/utils/bookingPhotoUploads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { resolveCategoryImageSource } from '@/utils/categoryIcons';
import { clearBookingResumePoint, rememberBookingStep } from '@/utils/bookingResume';
import { navigateBookingFlowToConfirmation } from '@/utils/navigation';
import { serviceRequestService } from '@/services/api';
import { haptics } from '@/hooks/useHaptics';
import { attachBookingPhotos } from '@/utils/bookingPhotoUpload';

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
    /**
     * Set by the Urgent action, and only when the backend kept the flag.
     * Changes what happens at the end of this screen - see handleContinue.
     */
    isUrgent?: string;
  }>();
  const { toast, showError, showWarning, hideToast } = useToast();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isFindingProviders, setIsFindingProviders] = useState(false);
  /** Guards a double tap on Continue before the navigation lands. */
  const continuingRef = useRef(false);
  
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
      /**
       * 0.6, down from 0.8. These are photographs of a leak or a cracked
       * tile, viewed by a provider at list size and at most full-screen on a
       * phone - the detail that 0.8 buys over 0.6 is not visible at either,
       * and at a typical 12-megapixel capture it is a megabyte per photo, on
       * a connection the customer is paying for by the megabyte.
       */
      quality: 0.6,
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
      /**
       * 0.6, down from 0.8. These are photographs of a leak or a cracked
       * tile, viewed by a provider at list size and at most full-screen on a
       * phone - the detail that 0.8 buys over 0.6 is not visible at either,
       * and at a typical 12-megapixel capture it is a megabyte per photo, on
       * a connection the customer is paying for by the megabyte.
       */
      quality: 0.6,
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

  /**
   * Continue goes straight to the map.
   *
   * This held the customer on a "Finding providers" pop-up - half a second on
   * a timer, then every photo uploading - before the map opened and showed two
   * loading pages of its own. Four loaders for one tap read as the app bouncing
   * between screens. The photos now upload behind the map, and the booking is
   * not sent to a provider until they have (utils/bookingPhotoUploads).
   */
  const handleDone = useCallback(async () => {
    if (isFindingProviders || continuingRef.current) {
      return;
    }
    continuingRef.current = true;

    const selectedUris = photos
      .filter((p) => selectedPhotos.has(p.id))
      .map((p) => p.uri);
    /** For the booking summary's preview on this device. */
    void AsyncStorage.setItem(BOOKING_PHOTO_URIS_KEY, JSON.stringify(selectedUris)).catch(() => undefined);

    const requestIdNum = parseInt(params.requestId ?? '', 10);
    const hasRequest = Number.isFinite(requestIdNum) && requestIdNum > 0;

    /** The step is answered the moment they press on, whatever the upload does next. */
    void rememberBookingStep('providers', params.requestId, {
      ...params,
      photoCount: selectedPhotos.size.toString(),
    });

    const upload =
      selectedUris.length > 0 && hasRequest
        ? trackBookingPhotoUpload(requestIdNum, attachBookingPhotos(requestIdNum, selectedUris))
        : null;

    /**
     * Urgent jobs skip the provider map entirely.
     *
     * An urgent booking is not sent to one provider and held there: confirm
     * alerts every qualifying provider nearby and the first to accept takes
     * it. There is nobody to choose, so it publishes here - after the photos,
     * so the providers racing to accept can see what the job is.
     */
    if (params.isUrgent === '1' && hasRequest) {
      setIsFindingProviders(true);
      try {
        const result = upload ? await upload : null;
        if (result && !result.complete) {
          showError(
            result.uploaded.length > 0
              ? 'Some photos could not be sent. You can add them again from the job later.'
              : 'Your photos could not be sent. The booking will continue without them.',
          );
        }
        await serviceRequestService.publishBooking(requestIdNum);
      } catch (error: any) {
        setIsFindingProviders(false);
        continuingRef.current = false;
        haptics.error();
        /**
         * Stops here rather than continuing. A booking that was not published
         * is invisible to every provider, and telling somebody their emergency
         * is on its way when it is not is the worst outcome this screen can
         * produce.
         */
        showError(error?.message || 'Your urgent booking could not be sent. Please try again.');
        return;
      }

      haptics.success();
      /** Published, so there is nothing left to come back to. */
      await clearBookingResumePoint();
      setIsFindingProviders(false);
      continuingRef.current = false;
      navigateBookingFlowToConfirmation(router, {
        requestId: params.requestId,
        serviceType: params.serviceType || params.categoryName,
        selectedDate: params.selectedDate,
        selectedTime: params.selectedTime,
        isUrgent: '1',
      });
      return;
    }

    continuingRef.current = false;
    haptics.light();

    /** Edited from the booking summary: back to that summary with the new count. */
    if (params.bookingOrigin === 'serviceMap') {
      returnToServiceMap(router, {
        requestId: params.requestId,
        categoryName: params.categoryName,
        serviceType: params.serviceType || params.categoryName,
        selectedDateTime: params.selectedDateTime,
        selectedDate: params.selectedDate,
        selectedTime: params.selectedTime,
        photoCount: selectedPhotos.size.toString(),
        location: params.location,
      });
      return;
    }

    // Push so back from map returns to Add photos; booking stack stays intact
    router.push({
      pathname: '/ServiceMapScreen' as any,
      params: {
        requestId: params.requestId,
        categoryName: params.categoryName,
        serviceType: params.serviceType || params.categoryName,
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
  }, [isFindingProviders, selectedPhotos, photos, router, params, showError]);

  /** Falls back to a neutral search glyph when the category has no art. */
  const categorySpinnerIcon = useMemo(
    () => resolveCategoryImageSource(params.categoryName, params.serviceType),
    [params.categoryName, params.serviceType],
  );

  const goBackToDateTime = useCallback(() => {
    /** Opened from the booking summary: back to it, not into the date step. */
    if (params.bookingOrigin === 'serviceMap' && router.canGoBack()) {
      router.back();
      return;
    }
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

          <View className="flex-row items-start mb-6 px-1">
            <Camera size={15} color={Colors.textTertiary} style={{ marginTop: 2 }} />
            <Text
              className="flex-1 ml-2 text-xs"
              style={{
                fontFamily: 'Poppins-Regular',
                color: Colors.textTertiary,
                lineHeight: 18,
              }}
            >
              Clear, well-lit photos from a few angles help providers quote accurately.
            </Text>
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
              {/**
                * The category being booked, not a plumber. This spinner shows
                * while providers are being found, so for a tiling or cleaning
                * job it was announcing the wrong trade back to the customer.
                */}
              {categorySpinnerIcon ? (
                <Image source={categorySpinnerIcon} style={{ width: 42, height: 42, resizeMode: 'contain' }} />
              ) : (
                <Search size={34} color={Colors.accent} strokeWidth={2} />
              )}
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

