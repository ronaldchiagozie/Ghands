import { pendingBookingPhotoUpload, waitForBookingPhotoUpload } from '@/utils/bookingPhotoUploads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import ServiceMap, { ProviderCategory, ServiceProvider } from '@/components/ServiceMap';
import BookingSummaryModal, { BookingSummaryData } from '@/components/BookingSummaryModal';
import { haptics } from '@/hooks/useHaptics';

const BOOKING_PHOTO_URIS_KEY = '@ghands:booking_photo_uris';

/**
 * Where to send somebody when the publish call says the booking is incomplete.
 *
 * The backend returns a code naming the missing piece, which is the whole point
 * of having asked for codes: "Select a date and time before selecting a
 * provider" is not actionable from the map, but the date screen is.
 */
const BOOKING_STEP_FOR_CODE: Record<string, string> = {
  MISSING_JOB_DETAILS: '/JobDetailsScreen',
  MISSING_SCHEDULE: '/DateTimeScreen',
  MISSING_LOCATION: '/LocationSearchScreen',
};

const PUBLISH_ERROR_COPY: Record<string, string> = {
  MISSING_JOB_DETAILS: 'Add a title and description for the job first.',
  MISSING_SCHEDULE: 'Choose a date and time first.',
  MISSING_LOCATION: 'Set the address for this job first.',
  PROVIDER_NOT_SELECTED: 'Choose a provider before confirming.',
  PROVIDER_NOT_VERIFIED: 'That provider is not available right now. Please choose another.',
  REQUEST_NOT_SELECTABLE: 'This booking has already been sent. Check your jobs.',
};
import { useUserLocation } from '@/hooks/useUserLocation';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import { Button } from '@/components/ui/Button';
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
import { Colors, Spacing, BorderRadius } from '@/lib/designSystem';
import { MapPin, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { clearBookingResumePoint } from '@/utils/bookingResume';
import { navigateToClientHomeTab, resetStackTo } from '@/utils/navigation';
const MAX_SELECTION = 3;



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
  /**
   * What the booking itself says, for when the params do not say it.
   *
   * Continuing a draft - from the resume prompt, from the Jobs tab, from a
   * notification - arrives with a requestId and little else. This screen reads
   * the trade and the address off its params, so it drew no pins and reported
   * "Please select a service category" and "Please set your service location":
   * it asked somebody who had answered both questions to go back and answer
   * them, from the screen that comes after. The draft on the server holds both.
   */
  const [draftDetails, setDraftDetails] = useState<{
    categoryName?: string;
    location?: string;
    coords?: { latitude: number; longitude: number };
    date?: string;
    time?: string;
    photoCount?: number;
  } | null>(null);
  /**
   * Whether the device location attempt has finished, either way.
   *
   * This is the slowest of the four places a coordinate can come from - route
   * params, the draft, the account's saved address, and the GPS - so it is
   * the one that decides when "still looking" becomes "looked everywhere".
   */
  const [gpsSettled, setGpsSettled] = useState(false);
  /** Flipped once the lookup below has answered, however it answered. */
  const [draftLookupDone, setDraftLookupDone] = useState(false);
  
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

  /** Photos keep uploading after Add photos; say so here if they did not all make it. */
  useEffect(() => {
    const upload = params.requestId ? pendingBookingPhotoUpload(params.requestId) : null;
    if (!upload) return;
    let active = true;
    void upload.then((result) => {
      if (!active || result.complete) return;
      showError(
        result.uploaded.length > 0
          ? 'Some photos could not be sent. You can add them again from the job later.'
          : 'Your photos could not be sent. The booking will continue without them.',
      );
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.requestId]);

  /**
   * Fills in what the params left out, from the draft on the server.
   *
   * Only asks when something is actually missing, so the ordinary path
   * through the flow - where every screen hands the next one its params -
   * costs no extra request. Entirely best effort: a failure here leaves the
   * screen exactly as it was before, which is the state it used to be stuck in.
   */
  /**
   * Whether the params are thin enough to be worth asking the server about.
   *
   * Derived during render rather than tracked in state, because every "is
   * something missing" check below has to be right on the very first frame.
   * As a state flag set from inside the effect it was still false while the
   * first provider load ran, so that load reported "Please select a service
   * category" and the empty state flashed up before the draft it was waiting
   * for had even been asked for.
   */
  const needsDraftHydration = useMemo(() => {
    const requestId = parseInt(params.requestId ?? '', 10);
    if (!Number.isFinite(requestId) || requestId <= 0) return false;
    const hasCategory = !!(params.categoryName?.trim() || params.serviceType?.trim());
    const hasPlace = !!(params.location?.trim() || (params.latitude && params.longitude));
    return !(hasCategory && hasPlace);
  }, [params.requestId, params.categoryName, params.serviceType, params.location, params.latitude, params.longitude]);

  const isHydratingDraft = needsDraftHydration && !draftLookupDone;

  /**
   * Every place a coordinate could come from has now been tried.
   *
   * This used to be set the first time the coordinate effect ran, which is
   * before the draft, the account's saved address or the GPS have answered -
   * so the screen concluded it had no location within a frame of opening,
   * drew "Please set your service location", and then replaced it with the
   * map a second later when the real answer arrived. That is the flicker:
   * fallback, then a different fallback, then the map. Nothing may claim to
   * have looked everywhere until the slowest source has reported back.
   */
  const locationResolved = gpsSettled && !isHydratingDraft;

  /**
   * Whether to say nobody is covering this area.
   *
   * Only once everything has actually finished looking - the draft, the
   * coordinates and the provider fetch - so the card cannot appear in the
   * gap before the first result lands, which is the flicker this screen
   * kept producing.
   */
  const showNoProviders =
    !isLoadingProviders &&
    !isHydratingDraft &&
    hasTriedLoadProviders &&
    locationResolved &&
    providers.length === 0;

  useEffect(() => {
    if (!needsDraftHydration) return;
    const requestId = parseInt(params.requestId ?? '', 10);

    let active = true;
    (async () => {
      try {
        const request = await serviceRequestService.getRequestDetails(requestId);
        if (!active) return;

        const place = request.location ?? {};
        const latitude = Number(place.latitude);
        const longitude = Number(place.longitude);
        const images = (request as { images?: unknown }).images;

        setDraftDetails({
          categoryName: request.categoryName?.trim() || undefined,
          location: (place.formattedAddress || place.address || '').trim() || undefined,
          coords:
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { latitude, longitude }
              : undefined,
          date: request.scheduledDate || undefined,
          time: request.scheduledTime || undefined,
          photoCount: Array.isArray(images) ? images.length : undefined,
        });
      } catch {
        /* the screen behaves as it did before, and the empty states still offer a way out */
      } finally {
        if (active) setDraftLookupDone(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [needsDraftHydration, params.requestId]);

  /** The trade and the place, from the params first and the draft second. */
  const effectiveCategoryName =
    params.categoryName?.trim() || params.serviceType?.trim() || draftDetails?.categoryName || '';

  /** Feeds the draft's address into the header and the summary once it arrives. */
  useEffect(() => {
    if (!draftDetails?.location) return;
    setServiceLocation((current) => current || draftDetails.location || '');
  }, [draftDetails?.location]);

  useEffect(() => {
    if (!draftDetails) return;
    setBookingData((prev) => ({
      ...prev,
      serviceType: prev.serviceType || draftDetails.categoryName,
      date: prev.date || draftDetails.date,
      time: prev.time || draftDetails.time,
      location: prev.location || draftDetails.location,
      photoCount: prev.photoCount || draftDetails.photoCount || 0,
    }));
  }, [draftDetails]);

  // Update serviceLocation when savedLocation changes
  useEffect(() => {
    if (!savedLocation) return;
    /**
     * Unless this booking has an address of its own.
     *
     * The account's saved location is where the customer usually is. The
     * draft's is where this job is. They are often the same and sometimes
     * not, and this effect would overwrite the second with the first the
     * moment a resumed booking filled it in - so continuing a draft for a
     * job at your mother's house searched for providers near your flat.
     */
    if (draftDetails?.location) return;
    // Keep the map header/location text in sync with the latest saved location.
    // The previous logic only set it when serviceLocation was empty, which caused stale UI.
    if (savedLocation !== serviceLocation) {
      setServiceLocation(savedLocation);
    }
  }, [savedLocation, serviceLocation, draftDetails?.location]);

  /**
   * A fresh `{latitude, longitude}` object every time this effect merely
   * re-confirms the same coordinates was what turned "getting your
   * location" into a flicker: providers-loading (below) keys off this value
   * by reference, so an identical-looking coordinate pair still counted as
   * new and re-ran the whole nearby-providers fetch - spinner back to
   * spinner, screen state visibly resetting, on every re-run of this effect
   * rather than only when the coordinates actually moved.
   */
  const setCoordsIfChanged = useCallback((next: { latitude: number; longitude: number } | null) => {
    setServiceLocationCoords((prev) => {
      if (prev && next && prev.latitude === next.latitude && prev.longitude === next.longitude) {
        return prev;
      }
      return next;
    });
  }, []);

  // Get coordinates from service location
  useEffect(() => {
    const getLocationCoordinates = async () => {
      // Priority 1: Coordinates from params (when returning from LocationSearchScreen)
      if (params.latitude && params.longitude) {
        const lat = parseFloat(params.latitude);
        const lng = parseFloat(params.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          setCoordsIfChanged({ latitude: lat, longitude: lng });
          return;
        }
      }

      /**
       * Priority 1b: the address recorded on the booking itself.
       *
       * Ahead of the saved-location call below, because this is the address
       * for *this* job. The account's saved location is where they usually
       * are, which is not the same thing and is only a sensible guess.
       */
      if (draftDetails?.coords) {
        setCoordsIfChanged(draftDetails.coords);
        return;
      }

      // Priority 2: If we have location text, try to get from saved location API FIRST
      // This is more reliable than GPS which might be simulator default (San Francisco)
      // (Priority 1b above has already returned for a booking with its own address.)
      if (serviceLocation) {
        try {
          const userId = await authService.getUserId();
          if (userId) {
            const savedLocation = await locationService.getUserLocation(userId);
            if (savedLocation?.latitude && savedLocation?.longitude) {
              setCoordsIfChanged({
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
          setCoordsIfChanged(userLocation);
          return;
        }
      }
    };

    void getLocationCoordinates();
  }, [
    serviceLocation,
    savedLocation,
    userLocation,
    params.latitude,
    params.longitude,
    draftDetails?.coords,
    setCoordsIfChanged,
  ]);

  // Fetch nearby providers when we have category and coordinates
  useEffect(() => {
    const loadProviders = async () => {
      const categoryName = effectiveCategoryName;

      // Reset error state
      setHasTriedLoadProviders(false);
      setProviderError(null);

      /**
       * Nothing to search with yet. Not an error while the draft is still on
       * its way: reporting one here is what put "Please select a service
       * category" in front of somebody whose category was about to arrive.
       */
      if (!categoryName || !serviceLocationCoords) {
        setProviders([]);
        if (!categoryName && !isHydratingDraft) {
          setProviderError('Please select a service category');
        } else if (!serviceLocationCoords && locationResolved && !isHydratingDraft) {
          setProviderError('Please set your service location');
        }
        setHasTriedLoadProviders(!isHydratingDraft);
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

        /**
         * Refuse to draw a provider the server has told us is not approved.
         *
         * Only an explicit `false` counts. The backend now gates /nearby itself,
         * so `verified` comes back true for everyone and it has told us the field
         * is redundant there - which makes it exactly the kind of field that gets
         * dropped in a tidy-up. Testing it for truthiness would then hide every
         * provider on the map and report "none found nearby", with the server
         * behaving perfectly.
         *
         * Absent means "the server already handled this", which is now true.
         */
        const eligibleProviders = providersArray.filter((provider) => provider?.verified !== false);

        if (eligibleProviders.length === 0) {
          setProviders([]);
          setProviderError(
            `No providers found nearby for "${categoryName}". Try expanding your search radius or selecting a different service category.`,
          );
          return;
        }

        // Map API NearbyProvider to ServiceProvider format
        const mappedProviders: ServiceProvider[] = eligibleProviders.map((provider, index) => {
          // Get icon for category
          const IconComponent = getCategoryIcon(normalizedCategory, categoryName, '');
          const categoryDisplayName = formatSkillLabel(
            categoryName.split(' ')[0] || normalizedCategory || 'Service'
          ) as ProviderCategory;

          const rawName = resolveProviderDisplayName(provider, {
            id: provider.id,
            categoryLabel: categoryName || normalizedCategory,
          });

          /**
           * Real coordinates when the server sends them, which it now does.
           *
           * The fallback below is the old behaviour: providers arranged in a
           * ring at `index * 45` degrees around the customer, because /nearby
           * returned a distance and no position. It is kept only so a provider
           * missing coordinates still gets a pin rather than vanishing, and it
           * is no longer what anybody normally sees.
           */
          const angle = (index * 45) * (Math.PI / 180);
          const distanceInDegrees = provider.distanceKm / 111;
          const hasRealPosition =
            Number.isFinite(provider.latitude) && Number.isFinite(provider.longitude);
          
          return {
            id: `provider-${provider.id}`,
            providerId: provider.id, // Store real backend provider ID for API calls
            name: rawName,
            category: categoryDisplayName as ProviderCategory,
            /**
             * The provider's real rating, or nothing. Never the hardcoded 4.5
             * this used to carry, which the card rendered as "4.5 (0 reviews)":
             * a score nobody gave them, shown to somebody deciding who to let
             * into their home.
             */
            rating:
              typeof provider.rating === 'number' && Number.isFinite(provider.rating)
                ? provider.rating
                : null,
            reviews:
              typeof provider.reviewCount === 'number' && Number.isFinite(provider.reviewCount)
                ? provider.reviewCount
                : 0,
            distance:
              provider.distanceKm != null && Number.isFinite(provider.distanceKm) && provider.distanceKm >= 0
                ? `${formatDistance(provider.distanceKm)} away`
                : 'Distance unavailable',
            /**
             * Passed through as what it is. The backend confirmed `verified` is
             * identity approval, so reading it as availability told customers a
             * provider awaiting approval was "Busy".
             */
            verified: Boolean(provider.verified),
            /** Their own profile photo now that the field exists; initials otherwise. */
            imageUri: provider.profileImageUrl ?? null,
            isOnline: provider.isOnline,
            coords: hasRealPosition
              ? { latitude: provider.latitude as number, longitude: provider.longitude as number }
              : {
                  latitude: serviceLocationCoords.latitude + Math.cos(angle) * distanceInDegrees,
                  longitude: serviceLocationCoords.longitude + Math.sin(angle) * distanceInDegrees,
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
  }, [effectiveCategoryName, serviceLocationCoords, locationResolved, isHydratingDraft]);

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
      } finally {
        if (isMounted) setGpsSettled(true);
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
          showAppAlert('Selection limit reached', `You can select up to ${MAX_SELECTION} providers.`);
          return prev;
        }
        haptics.selection();
        return [...prev, provider];
      });
    },
    []
  );

  /**
   * Gives up on this booking and goes home.
   *
   * The empty states offered "Change location" and "Try a different category" -
   * both of which keep you inside a flow you may simply want to leave. The only
   * way out was the back arrow, which walks back through the booking a screen at
   * a time and never actually ends it.
   *
   * Nothing is sent to the server. The request stays a draft, and a draft is
   * excluded from every list either app reads, so it costs nobody anything by
   * existing. Clearing the local pointer is what makes it stay gone: without
   * that, home would offer the booking straight back.
   */
  const handleAbandonBooking = useCallback(async () => {
    haptics.light();
    await clearBookingResumePoint();
    navigateToClientHomeTab(router);
  }, [router]);

  /**
   * Off to set the address, and back here afterwards.
   *
   * These buttons used to push LocationSearchScreen bare. That screen decides
   * where to go next from its own params, so with none it sent people to the
   * home tab - and the booking they were in the middle of was left behind
   * with its address still unset, which is the thing they had just gone to fix.
   */
  const openLocationSearch = useCallback(() => {
    router.push({
      pathname: '/LocationSearchScreen' as any,
      params: {
        requestId: params.requestId,
        next: 'ServiceMapScreen',
        preserveData: 'true',
        categoryName: effectiveCategoryName,
        serviceType: effectiveCategoryName,
        selectedDateTime: params.selectedDateTime,
        selectedDate: params.selectedDate,
        selectedTime: params.selectedTime,
        photoCount: params.photoCount,
      },
    } as any);
  }, [router, params.requestId, params.selectedDateTime, params.selectedDate, params.selectedTime, params.photoCount, effectiveCategoryName]);

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
          categoryName: effectiveCategoryName,
          serviceType: effectiveCategoryName,
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
        {
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
                borderRadius: BorderRadius.full,
                backgroundColor: Colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: Colors.border,
              }}
              activeOpacity={0.85}
            >
              <ArrowLeft size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <ServiceMap
              focus={serviceLocationCoords}
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
            {/**
              * Loading on the map, not instead of it. This used to be two
              * full white pages - "Getting your location..." then "Finding
              * nearby providers..." - swapped in and out before the map
              * appeared, which read as the app bouncing between screens.
              */}
            {/**
              * "Change location", where a map puts it.
              *
              * It used to be a second full-width button stacked under Try
              * again on a white page. On a map the address is a property of
              * the view, so it belongs with the view - top right, as text.
              */}
            {locationResolved ? (
              <TouchableOpacity
                onPress={openLocationSearch}
                accessibilityRole="button"
                accessibilityLabel="Change location"
                activeOpacity={0.85}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  zIndex: 40,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 13,
                  height: 44,
                  borderRadius: BorderRadius.full,
                  backgroundColor: Colors.white,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <MapPin size={15} color={Colors.accent} />
                <Text style={{ fontSize: 13.5, fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>
                  Change
                </Text>
              </TouchableOpacity>
            ) : null}

            {/**
              * Nothing found, said over the map rather than instead of it.
              *
              * This was a white page with a grey circle, a heading, three
              * lines of explanation and three stacked buttons - a wall in
              * front of somebody whose only question is "where are they
              * then". Keeping the map answers that: you can see the area
              * that was searched, and the card sits on top with one thing
              * to press. The address lives in the control above; giving up
              * is a quiet link, not a third button.
              */}
            {showNoProviders ? (
              <View
                pointerEvents="box-none"
                style={{ position: 'absolute', left: 16, right: 16, bottom: 28 }}
              >
                <View
                  style={{
                    backgroundColor: Colors.white,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 18,
                    paddingTop: 18,
                    paddingBottom: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      letterSpacing: -0.2,
                    }}
                  >
                    No providers here yet
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                      marginTop: 4,
                    }}
                  >
                    {effectiveCategoryName
                      ? `Nobody is covering ${effectiveCategoryName.toLowerCase()} in this area right now.`
                      : 'Nobody is covering this area right now.'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      haptics.light();
                      if (!serviceLocationCoords) {
                        openLocationSearch();
                        return;
                      }
                      setProviderError(null);
                      setIsLoadingProviders(true);
                      setServiceLocationCoords({ ...serviceLocationCoords });
                    }}
                    activeOpacity={0.85}
                    style={{
                      marginTop: 14,
                      backgroundColor: Colors.accent,
                      borderRadius: BorderRadius.default,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontFamily: 'Poppins-SemiBold', color: Colors.white }}>
                      Try again
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void handleAbandonBooking()}
                    activeOpacity={0.7}
                    style={{ alignItems: 'center', paddingVertical: 11 }}
                  >
                    <Text
                      style={{ fontSize: 13.5, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark }}
                    >
                      Cancel this booking
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {isLoadingProviders || isHydratingDraft || (!serviceLocationCoords && !locationResolved) ? (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: 16, right: 16, bottom: 32, alignItems: 'center' }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: Colors.white,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <Text style={{ marginLeft: 10, fontSize: 14, fontFamily: 'Poppins-Medium', color: Colors.textPrimary }}>
                    {serviceLocationCoords ? 'Finding providers near you…' : 'Getting your location…'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        }
      </View>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
      />
      {selectedProviders.length > 0 && (
        <View className="bg-white border-t px-4 py-4" style={{ borderTopColor: Colors.borderLight }}>
          <Text className="text-sm mb-2" style={{ fontFamily: 'Poppins-Medium', color: Colors.textMuted }}>
            Selected providers ({selectedProviders.length}/{MAX_SELECTION})
          </Text>
          <View className="flex-row flex-wrap mb-3">
            {selectedProviders.map((provider) => (
              <View
                key={`selected-${provider.id}`}
                className="mr-2 mb-2 rounded-full px-3 py-1"
                style={{ backgroundColor: Colors.sageTint }}
              >
                <Text className="text-xs" style={{ fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>
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

          /**
           * Publishing the booking. This is the one request in the flow that
           * must not fail quietly.
           *
           * Which endpoint does the publishing is deliberately not decided here.
           * `select-provider` does it today and `/confirm` will once the backend
           * change lands; publishBooking works out which deployment it is
           * talking to, so neither side has to hold a release for the other.
           */
          const requestId = parseInt(params.requestId ?? '', 10);
          const providerId = selectedProviders[0]?.providerId;

          if (!Number.isFinite(requestId) || requestId <= 0 || !providerId) {
            /**
             * Previously an `if (requestId && providerId)` that simply skipped
             * the call and carried on to the confirmation screen, so a provider
             * row missing its backend id produced a booking that was never
             * published and a customer who was told it had been.
             */
            haptics.error();
            showError('Something went wrong with this booking. Please choose your provider again.');
            return;
          }

          try {
            /** The photos started uploading on Add photos; send the job with them. */
            await waitForBookingPhotoUpload(requestId);
            await serviceRequestService.publishBooking(requestId, providerId);
          } catch (error: any) {
            /**
             * Stop here. This used to show a toast and continue to the
             * confirmation screen anyway, which was the worst possible outcome:
             * the job stayed a draft, so it was invisible to providers and
             * absent from the customer's own jobs list, the resume pointer was
             * cleared so nothing offered it back, and the screen said it was
             * booked. An unrecoverable job, reported as a success.
             *
             * Returning leaves the draft, the resume pointer and their provider
             * selection all intact, so trying again is one tap.
             */
            haptics.error();

            /**
             * A missing address is the one thing this screen can fix itself.
             *
             * It is drawing a map centred on the place, with the address in
             * its own header - so bouncing the customer to a picker to retype
             * what the app is currently displaying is the worst available
             * answer, and it is what they got: confirm the booking, watch the
             * summary close, land on Find location. Write it on and publish
             * again; only ask if that fails too.
             */
            if (String(error?.code ?? '') === 'MISSING_LOCATION' && serviceLocationCoords) {
              try {
                await serviceRequestService.setRequestLocation(requestId, {
                  formattedAddress: serviceLocation || savedLocation || '',
                  address: (serviceLocation || savedLocation || '').split(',')[0],
                  latitude: serviceLocationCoords.latitude,
                  longitude: serviceLocationCoords.longitude,
                });
                await serviceRequestService.publishBooking(requestId, providerId);

                haptics.success();
                showSuccess('Provider selected. They have 5 minutes to accept.');
                await clearBookingResumePoint();
                navigateBookingFlowToConfirmation(router, {
                  requestId: params.requestId,
                  serviceType: effectiveCategoryName,
                  selectedDate: params.selectedDate,
                  selectedTime: params.selectedTime,
                  providerCount: String(selectedProviders.length),
                });
                return;
              } catch {
                /* falls through to the step redirect below */
              }
            }

            /**
             * The backend names what is missing, so send them to it rather than
             * showing a sentence they cannot act on from a screen that cannot
             * fix it.
             */
            const step = BOOKING_STEP_FOR_CODE[String(error?.code ?? '')];
            if (step) {
              showError(PUBLISH_ERROR_COPY[String(error?.code)] ?? error?.message);
              router.push({ pathname: step as any, params: { ...params } } as any);
              return;
            }

            showError(
              PUBLISH_ERROR_COPY[String(error?.code ?? '')] ||
                error?.message ||
                'Could not send your booking to the provider. Please try again.',
            );
            return;
          }

          haptics.success();
          showSuccess('Provider selected. They have 5 minutes to accept.');

          /** Published. Only now is there nothing left to come back to. */
          await clearBookingResumePoint();

          navigateBookingFlowToConfirmation(router, {
            requestId: params.requestId,
            serviceType: effectiveCategoryName,
            selectedDate: params.selectedDate,
            selectedTime: params.selectedTime,
            providerCount:
              selectedProviders.length > 0 ? String(selectedProviders.length) : undefined,
          });
        }}
        onEditService={(bookingData) => {
          const categoryHint = effectiveCategoryName || bookingData.serviceType || '';
          router.push({
            pathname: '/(tabs)/categories' as any,
            params: {
              selectedCategoryId: categoryHint,
              returnToServiceMap: 'true',
              requestId: params.requestId,
              preserveData: 'true',
              serviceType: bookingData.serviceType || effectiveCategoryName || '',
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
              categoryName: effectiveCategoryName || bookingData.serviceType,
              selectedDateTime: bookingData.dateTime || params.selectedDateTime,
              selectedDate: bookingData.date || params.selectedDate,
              selectedTime: bookingData.time || params.selectedTime,
              serviceType: bookingData.serviceType || effectiveCategoryName,
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
              serviceType: bookingData.serviceType || effectiveCategoryName,
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
              categoryName: effectiveCategoryName || bookingData.serviceType,
              selectedDateTime: bookingData.dateTime || params.selectedDateTime,
              selectedDate: bookingData.date || params.selectedDate,
              selectedTime: bookingData.time || params.selectedTime,
              serviceType: bookingData.serviceType || effectiveCategoryName,
              location: bookingData.location || serviceLocation,
              photoCount: bookingData.photoCount?.toString() || params.photoCount,
              preserveData: 'true',
              bookingOrigin: 'serviceMap',
            },
          } as any);
        }}
        onEditProviders={(bookingData) => {
          // Stay on current screen, just close modal to allow editing
          // Selected providers are already in state, so user can modify them
          setShowSummaryModal(false);
        }}
        data={{
          serviceType: bookingData.serviceType || effectiveCategoryName || 'Service',
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
            imageUri: p.imageUri,
          })),
        }}
      />
    </SafeAreaWrapper>
  );
};

export default ServiceMapScreen;
