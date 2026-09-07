import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where someone had got to when their booking was interrupted.
 *
 * The draft status on the server made abandoned bookings invisible, which was
 * the right fix for the phantom pending jobs - but invisible is not the same as
 * recoverable. Someone who gets a phone call while picking a time currently
 * loses the category, the description, the date and the photos, and starts over
 * from the home screen with no idea any of it was kept.
 *
 * The request itself survives on the server as a draft. All that is missing is a
 * pointer back to it, which is what this stores.
 *
 * It is deliberately only a pointer. The server holds the booking; this holds
 * the id and enough route params to reopen the screen they were on. If the two
 * disagree, the server wins.
 */

const STORAGE_KEY = '@ghands:booking_resume';

/**
 * The steps of the booking flow, in order. Named after what the customer was
 * doing, not the route, so the copy on the resume card can use them.
 */
export const BOOKING_STEPS = ['details', 'schedule', 'photos', 'providers'] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

const STEP_ROUTE: Record<BookingStep, string> = {
  details: '/JobDetailsScreen',
  schedule: '/DateTimeScreen',
  photos: '/AddPhotosScreen',
  providers: '/ServiceMapScreen',
};

const STEP_LABEL: Record<BookingStep, string> = {
  details: 'Describe the job',
  schedule: 'Pick a date and time',
  photos: 'Add photos',
  providers: 'Choose a provider',
};

/**
 * How long a half-finished booking is worth offering back.
 *
 * Twenty hours, matching the server-side retention we have asked for. The two
 * numbers have to agree: if the app offers a draft the server has already
 * deleted, the customer taps Continue and lands on an error, which is worse
 * than never being offered it.
 *
 * It is deliberately short. A half-made booking is a job somebody wanted doing
 * today or tomorrow, and an unfinished plumbing request from last week is not
 * something anyone wants handed back to them.
 */
const RESUME_TTL_MS = 20 * 60 * 60 * 1000;

export type BookingResumePoint = {
  requestId: string;
  step: BookingStep;
  /** What they were booking, for the card's copy. */
  categoryName?: string;
  /** Route params, so the screen reopens with what they had entered. */
  params: Record<string, string>;
  savedAt: number;
};

function isBookingStep(value: unknown): value is BookingStep {
  return typeof value === 'string' && (BOOKING_STEPS as readonly string[]).includes(value);
}

/** Route params come off expo-router as strings or undefined; keep only real strings. */
function cleanParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return out;
}

/**
 * Records where they are. Called on each booking step as it opens, so the
 * pointer is already written before anything can interrupt them - waiting until
 * they leave a screen would miss the case this exists for.
 */
export async function rememberBookingStep(
  step: BookingStep,
  requestId: string | undefined | null,
  params: Record<string, unknown>,
): Promise<void> {
  if (!requestId || !String(requestId).trim()) return;

  const point: BookingResumePoint = {
    requestId: String(requestId),
    step,
    categoryName:
      (typeof params.categoryName === 'string' && params.categoryName) ||
      (typeof params.serviceType === 'string' && params.serviceType) ||
      undefined,
    params: cleanParams(params),
    savedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(point));
  } catch {
    /* resuming is a convenience; never let it break the booking flow */
  }
}

/** Reads the pointer, treating anything stale or malformed as absent. */
export async function readBookingResumePoint(): Promise<BookingResumePoint | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<BookingResumePoint>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.requestId !== 'string' || !parsed.requestId.trim()) return null;
    if (!isBookingStep(parsed.step)) return null;
    if (typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt)) return null;
    if (Date.now() - parsed.savedAt > RESUME_TTL_MS) return null;

    return {
      requestId: parsed.requestId,
      step: parsed.step,
      categoryName: typeof parsed.categoryName === 'string' ? parsed.categoryName : undefined,
      params: parsed.params && typeof parsed.params === 'object' ? cleanParams(parsed.params) : {},
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Forgets the booking in progress.
 *
 * Called when it is finished, and when the customer gives up on it. Nothing is
 * sent to the server: an abandoned draft is already excluded from every list
 * either app reads, so it costs nobody anything by existing. Deleting it would
 * be a second way to fail at a moment when someone has just said they are done.
 */
export async function clearBookingResumePoint(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Where to send them, with what they had already entered. */
export function resumeRouteFor(point: BookingResumePoint): {
  pathname: string;
  params: Record<string, string>;
} {
  return {
    pathname: STEP_ROUTE[point.step],
    params: { ...point.params, requestId: point.requestId },
  };
}

/** What they were about to do, for the card. */
export function resumeStepLabel(point: BookingResumePoint): string {
  return STEP_LABEL[point.step];
}

/**
 * How far through the flow they are, as a countable position.
 *
 * Discrete rather than a percentage, because the steps are discrete: "3 of 4"
 * is a thing somebody can hold in their head and "68 per cent" is not. It is
 * also the honest shape, since the steps are not equal in effort.
 */
export function resumeProgress(point: BookingResumePoint): { done: number; total: number } {
  const index = BOOKING_STEPS.indexOf(point.step);
  return { done: Math.max(index, 0), total: BOOKING_STEPS.length };
}

/**
 * How long is left before the draft is deleted, in hours, or null when that is
 * far enough away to be worth not mentioning.
 *
 * Only surfaced near the end. A countdown from twenty hours is pressure applied
 * to somebody who has done nothing wrong; a few hours before it disappears is
 * information they would want.
 */
const EXPIRY_WARNING_MS = 6 * 60 * 60 * 1000;

export function resumeHoursLeft(point: BookingResumePoint): number | null {
  const remaining = RESUME_TTL_MS - (Date.now() - point.savedAt);
  if (remaining > EXPIRY_WARNING_MS || remaining <= 0) return null;
  return Math.max(1, Math.round(remaining / (60 * 60 * 1000)));
}
