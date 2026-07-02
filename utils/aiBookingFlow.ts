import { aiService, authService, locationService } from '@/services/api';
import type { AiBookingPrefill } from '@/components/ai/chat/types';
import { extractUserIdFromToken } from '@/utils/tokenUtils';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { handleApiAuthFailure } from '@/utils/authRedirect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import * as Location from 'expo-location';

export const BOOKING_PHOTO_URIS_KEY = '@ghands:booking_photo_uris';

export type AiBookingStartResult =
  | { ok: true; requestId: number }
  | { ok: false; error: string };

async function resolveUserId(): Promise<number | null> {
  let userId = await authService.getUserId();

  if (!userId) {
    const token = await authService.getAuthToken();
    if (token) {
      const extracted = extractUserIdFromToken(token);
      if (extracted) {
        userId = extracted;
        await authService.setUserId(userId);
      }
    }
  }

  return userId;
}

async function resolveGpsLocation(): Promise<{
  formattedAddress: string;
  latitude: number;
  longitude: number;
} | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = position.coords;
  const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
  const place = reverse[0];
  const formattedAddress = place
    ? [place.streetNumber, place.street, place.city, place.region, place.country]
        .filter(Boolean)
        .join(', ')
    : `Location at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  return { formattedAddress, latitude, longitude };
}

/**
 * Creates a service request via AI quick-booking, then opens DateTimeScreen.
 */
export async function startAiAssistedBooking(
  router: Router,
  prefill: AiBookingPrefill,
  photoUris: string[] = [],
  conversationId?: number | null
): Promise<AiBookingStartResult> {
  try {
    const userId = await resolveUserId();
    if (!userId) {
      return {
        ok: false,
        error: 'Unable to identify your account. Please sign out and sign in again.',
      };
    }

    const basePayload = {
      categoryName: prefill.categoryName,
      jobTitle: prefill.jobTitle.trim(),
      description: prefill.description.trim(),
      ...(conversationId != null ? { conversationId } : {}),
    };

    let booking: Awaited<ReturnType<typeof aiService.quickBooking>> | null = null;

    try {
      booking = await aiService.quickBooking({
        ...basePayload,
        useSavedLocation: true,
      });
    } catch (savedLocationError: unknown) {
      const saved = await locationService.getUserLocation(userId);
      if (saved?.latitude && saved?.longitude) {
        booking = await aiService.quickBooking({
          ...basePayload,
          location: {
            formattedAddress: saved.fullAddress || saved.address,
            latitude: saved.latitude,
            longitude: saved.longitude,
          },
        });
      } else {
        const gps = await resolveGpsLocation();
        if (gps) {
          booking = await aiService.quickBooking({
            ...basePayload,
            location: gps,
          });
        } else {
          throw savedLocationError;
        }
      }
    }

    if (!booking?.requestId) {
      return { ok: false, error: 'Could not start your booking. Please try again.' };
    }

    if (photoUris.length > 0) {
      await AsyncStorage.setItem(BOOKING_PHOTO_URIS_KEY, JSON.stringify(photoUris));
    } else {
      await AsyncStorage.removeItem(BOOKING_PHOTO_URIS_KEY);
    }

    router.push({
      pathname: '/DateTimeScreen' as any,
      params: {
        requestId: String(booking.requestId),
        categoryName: booking.categoryName || prefill.categoryName,
        serviceType: booking.categoryName || prefill.categoryName,
        location: booking.location,
        photoCount: String(photoUris.length),
        fromAiAssistant: 'true',
      },
    } as any);

    return { ok: true, requestId: booking.requestId };
  } catch (error: unknown) {
    if (await handleApiAuthFailure(error, router)) {
      return { ok: false, error: 'Your session has expired. Please sign in again.' };
    }
    return {
      ok: false,
      error: getSpecificErrorMessage(error as Error, 'create_request'),
    };
  }
}
