import { serviceRequestService, authService } from '@/services/api';
import type { AiBookingPrefill } from '@/components/ai/chat/types';
import { extractUserIdFromToken } from '@/utils/tokenUtils';
import { getSpecificErrorMessage } from '@/utils/errorMessages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';

export const BOOKING_PHOTO_URIS_KEY = '@ghands:booking_photo_uris';

export type AiBookingStartResult =
  | { ok: true; requestId: number }
  | { ok: false; error: string };

/**
 * Creates a service request with AI-gathered details, then opens DateTimeScreen
 * so the user only picks when — category, title, and description are already set.
 */
export async function startAiAssistedBooking(
  router: Router,
  prefill: AiBookingPrefill,
  photoUris: string[] = []
): Promise<AiBookingStartResult> {
  try {
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

    if (!userId) {
      return {
        ok: false,
        error: 'Unable to identify your account. Please sign out and sign in again.',
      };
    }

    const response = await serviceRequestService.createRequest({
      userId,
      categoryName: prefill.categoryName,
    });

    if (!response?.requestId) {
      return { ok: false, error: 'Could not start your booking. Please try again.' };
    }

    await serviceRequestService.updateJobDetails(response.requestId, {
      jobTitle: prefill.jobTitle.trim(),
      description: prefill.description.trim(),
    });

    if (photoUris.length > 0) {
      await AsyncStorage.setItem(BOOKING_PHOTO_URIS_KEY, JSON.stringify(photoUris));
    } else {
      await AsyncStorage.removeItem(BOOKING_PHOTO_URIS_KEY);
    }

    router.push({
      pathname: '/DateTimeScreen' as any,
      params: {
        requestId: String(response.requestId),
        categoryName: prefill.categoryName,
        serviceType: prefill.categoryName,
        photoCount: String(photoUris.length),
        fromAiAssistant: 'true',
      },
    } as any);

    return { ok: true, requestId: response.requestId };
  } catch (error: unknown) {
    return {
      ok: false,
      error: getSpecificErrorMessage(error as Error, 'create_request'),
    };
  }
}
