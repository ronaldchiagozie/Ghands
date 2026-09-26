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
    /** An edit opened from the booking summary: the map it came from is right beneath. */
    if (router.canGoBack()) {
      router.back();
      return;
    }
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

/**
 * Back to the provider map already in the stack, carrying what an edit changed.
 *
 * Editing the date, photos or location from the booking summary used to open
 * a new map - by push or replace - on top of the one the edit started from,
 * and the location edit dropped the requestId on the way. Each edit added a
 * map to the stack, back went from one map to the same map again, and a
 * booking finished from the new one had no draft to publish. Returning to the
 * existing map, with its params updated, keeps one map and one draft.
 */
export function returnToServiceMap(router: Router, params: Record<string, string | undefined>): void {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value != null && value !== ''),
  ) as Record<string, string>;
  const href = { pathname: '/ServiceMapScreen', params: cleaned } as any;
  if (typeof router.dismissTo === 'function') {
    router.dismissTo(href);
    return;
  }
  router.replace(href);
}
