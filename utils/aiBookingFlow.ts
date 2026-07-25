import { aiService, authService, locationService } from '@/services/api';
import type { AiBookingPrefill } from '@/components/ai/chat/types';
import { extractUserIdFromToken } from '@/utils/tokenUtils';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import { handleApiAuthFailure } from '@/utils/authRedirect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import * as Location from 'expo-location';

export const BOOKING_PHOTO_URIS_KEY = '@ghands:booking_photo_uris';

const GPS_LOCATION_TIMEOUT_MS = 4500;

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

type BookingLocationPayload = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

async function resolveGpsLocation(): Promise<BookingLocationPayload | null> {
  const locate = async (): Promise<BookingLocationPayload | null> => {
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
  };

  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), GPS_LOCATION_TIMEOUT_MS);
  });

  return Promise.race([locate(), timeout]);
}

async function resolveSavedLocation(userId: number): Promise<BookingLocationPayload | null> {
  const saved = await locationService.getUserLocation(userId);
  if (!saved?.latitude || !saved?.longitude) return null;
  return {
    formattedAddress: saved.fullAddress || saved.address || 'Saved location',
    latitude: saved.latitude,
    longitude: saved.longitude,
  };
}

async function runQuickBooking(
  basePayload: {
    categoryName: string;
    jobTitle: string;
    description: string;
    conversationId?: number;
  },
  userId: number,
): Promise<Awaited<ReturnType<typeof aiService.quickBooking>>> {
  const savedLocation = await resolveSavedLocation(userId);
  let lastError: unknown;

  const tryBooking = async (
    payload: Parameters<typeof aiService.quickBooking>[0],
  ): Promise<Awaited<ReturnType<typeof aiService.quickBooking>> | null> => {
    try {
      return await aiService.quickBooking(payload);
    } catch (error) {
      lastError = error;
      return null;
    }
  };

  if (savedLocation) {
    const withSaved = await tryBooking({ ...basePayload, location: savedLocation });
    if (withSaved) return withSaved;
  }

  const withFlag = await tryBooking({ ...basePayload, useSavedLocation: true });
  if (withFlag) return withFlag;

  const gps = await resolveGpsLocation();
  if (gps) {
    return aiService.quickBooking({ ...basePayload, location: gps });
  }

  throw lastError ?? new Error('Could not resolve location for booking');
}

/**
 * Creates a service request via AI quick-booking, then opens DateTimeScreen.
 */
export async function startAiAssistedBooking(
  router: Router,
  prefill: AiBookingPrefill,
  photoUris: string[] = [],
  conversationId?: number | null,
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

    const booking = await runQuickBooking(basePayload, userId);

    if (!booking?.requestId) {
      return { ok: false, error: 'Could not start your booking. Please try again.' };
    }

    const photoWrite =
      photoUris.length > 0
        ? AsyncStorage.setItem(BOOKING_PHOTO_URIS_KEY, JSON.stringify(photoUris))
        : AsyncStorage.removeItem(BOOKING_PHOTO_URIS_KEY);

    router.push({
      pathname: '/DateTimeScreen' as any,
      params: {
        requestId: String(booking.requestId),
        categoryName: booking.categoryName || prefill.categoryName,
        serviceType: booking.categoryName || prefill.categoryName,
        location: booking.location,
        photoCount: String(photoUris.length),
        fromAiAssistant: 'true',
        bookingOrigin: 'ai',
        ...(conversationId != null ? { conversationId: String(conversationId) } : {}),
      },
    } as any);

    void photoWrite;

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
