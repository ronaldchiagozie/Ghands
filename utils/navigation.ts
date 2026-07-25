import type { Router } from 'expo-router';

type RouterLike = Pick<Router, 'back' | 'replace' | 'canGoBack'>;
type RouterWithNav = RouterLike & Pick<Router, 'push' | 'replace'>;
type RouterWithStackReset = RouterLike &
  Pick<Router, 'replace' | 'dismissTo' | 'dismissAll' | 'canDismiss'>;

/**
 * Collapse the root stack to the main tab shell so iOS back-swipe cannot reopen booking screens.
 */
export function resetToClientTab(
  router: RouterWithStackReset,
  target: typeof NAV_FALLBACK.clientHome | typeof NAV_FALLBACK.clientJobs,
  params?: Record<string, string>,
): void {
  const href = params ? { pathname: target, params } : target;
  try {
    if (router.canDismiss?.()) {
      router.dismissAll();
    }
  } catch {
    /* best effort */
  }
  try {
    router.dismissTo(href as never);
  } catch {
    router.replace(href as never);
  }
}

/**
 * Prefer stack back; only use fallback when there is no history (deep link / replace entry).
 */
export function navigateBack(router: RouterLike, fallback: string): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as never);
}

/** Default fallbacks when stack history is empty */
export const NAV_FALLBACK = {
  clientHome: '/(tabs)/home',
  clientJobs: '/(tabs)/jobs',
  clientRequest: '/(tabs)/categories',
  providerHome: '/provider/home',
  providerJobs: '/provider/jobs',
} as const;

export type JobDetailsTab = 'updates' | 'quotations';

export function buildJobDetailsParams(opts: {
  requestId: string | number;
  tab?: JobDetailsTab;
  fromBooking?: boolean;
  paymentStatus?: 'success';
}): Record<string, string> {
  const params: Record<string, string> = { requestId: String(opts.requestId) };
  if (opts.tab) params.tab = opts.tab;
  if (opts.fromBooking) params.fromBooking = '1';
  if (opts.paymentStatus) params.paymentStatus = opts.paymentStatus;
  return params;
}

/** Open active job hub — single entry point for job details navigation. */
export function navigateToJob(
  router: RouterWithNav,
  opts: {
    requestId: string | number;
    tab?: JobDetailsTab;
    fromBooking?: boolean;
    paymentStatus?: 'success';
    replace?: boolean;
  }
): void {
  const route = {
    pathname: '/OngoingJobDetails',
    params: buildJobDetailsParams(opts),
  } as const;

  if (opts.replace) {
    router.replace(route as never);
    return;
  }
  router.push(route as never);
}

/** Jobs tab with Pending selected — new bookings and awaiting-provider jobs. */
export function navigateToJobsPendingTab(
  router: RouterWithStackReset,
): void {
  resetToClientTab(router, NAV_FALLBACK.clientJobs, { initialTab: 'Pending' });
}

/** Main tab home — clears booking stack underneath tabs. */
export function navigateToClientHomeTab(router: RouterWithStackReset): void {
  resetToClientTab(router, NAV_FALLBACK.clientHome);
}

/** After booking confirm on map — tab root + confirmation (no Add Photos under tabs on back). */
export function navigateBookingFlowToConfirmation(
  router: RouterWithStackReset & Pick<Router, 'push'>,
  params: Record<string, string | undefined>,
): void {
  try {
    if (router.canDismiss?.()) {
      router.dismissAll();
    }
  } catch {
    /* best effort */
  }
  router.push({
    pathname: '/BookingConfirmationScreen',
    params,
  } as never);
}

/** Job details opened right after booking — land on Pending jobs, not back through the booking stack. */
export function navigateBackFromBookingJob(router: RouterWithStackReset): void {
  navigateToJobsPendingTab(router);
}

/** After in-flow payment — replace receipt stack with job details. */
export function exitPaymentToJob(router: RouterWithNav, requestId: string | number): void {
  navigateToJob(router, { requestId, tab: 'updates', replace: true });
}

/** Chat opened from job hub passes `fromJobHub=1` so "View job" pops instead of stacking another details screen. */
export function buildChatScreenParams(opts: {
  requestId: string | number;
  providerName?: string;
  providerId?: string;
  clientName?: string;
  fromJobHub?: boolean;
}): Record<string, string> {
  const params: Record<string, string> = {
    requestId: String(opts.requestId),
  };
  if (opts.providerName) params.providerName = opts.providerName;
  if (opts.providerId) params.providerId = opts.providerId;
  if (opts.clientName) params.clientName = opts.clientName;
  if (opts.fromJobHub) params.fromJobHub = '1';
  return params;
}

export function exitChatToJobHub(
  router: RouterWithNav,
  opts: {
    requestId: string | number;
    isProvider?: boolean;
    fromJobHub?: string;
  },
): void {
  if (opts.fromJobHub === '1' && router.canGoBack()) {
    router.back();
    return;
  }

  const requestId = String(opts.requestId);
  if (opts.isProvider) {
    router.replace({
      pathname: '/ProviderJobDetailsScreen',
      params: { requestId },
    } as never);
    return;
  }

  navigateToJob(router, { requestId, replace: true });
}
