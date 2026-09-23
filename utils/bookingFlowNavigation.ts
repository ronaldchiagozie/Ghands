import type { Router } from 'expo-router';

export type BookingBackParams = {
  fromAiAssistant?: string;
  bookingOrigin?: string;
  requestId?: string;
  categoryName?: string;
  conversationId?: string;
  serviceType?: string;
  location?: string;
  photoCount?: string;
  selectedDate?: string;
  selectedTime?: string;
  selectedDateTime?: string;
};

function isAiOrigin(params: BookingBackParams): boolean {
  return params.fromAiAssistant === 'true' || params.bookingOrigin === 'ai';
}

/** Consistent back/cancel from booking steps so users stay on the intended path. */
export function navigateBookingStepBack(router: Router, params: BookingBackParams): void {
  if (isAiOrigin(params)) {
    router.replace({
      pathname: '/AiAssistantScreen' as any,
      params: params.conversationId ? { conversationId: params.conversationId } : {},
    } as any);
    return;
  }

  if (params.bookingOrigin === 'serviceMap' && params.requestId) {
    router.replace({
      pathname: '/ServiceMapScreen' as any,
      params: {
        requestId: params.requestId,
        categoryName: params.categoryName,
        serviceType: params.serviceType,
        location: params.location,
        photoCount: params.photoCount,
        selectedDate: params.selectedDate,
        selectedTime: params.selectedTime,
        selectedDateTime: params.selectedDateTime,
      },
    } as any);
    return;
  }

  /**
   * JobDetailsScreen pushes (not replaces) on its way to DateTimeScreen, so the
   * original, already-filled instance is still sitting in the stack. Replacing
   * here instead minted a second, empty JobDetailsScreen on top of it - two
   * instances of the same route with different state, which is what produced
   * the filled/empty flicker on repeated back taps. Going back returns to the
   * real instance instead of minting a blank one.
   */
  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (params.requestId) {
    router.replace({
      pathname: '/JobDetailsScreen' as any,
      params: {
        requestId: params.requestId,
        categoryName: params.categoryName,
      },
    } as any);
    return;
  }

  router.replace('/(tabs)/categories' as any);
}
