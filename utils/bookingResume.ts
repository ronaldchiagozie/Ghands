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
 * The draft we have already interrupted somebody about.
 *
 * Kept separate from the pointer because the pointer is rewritten at every
 * step, and resetting this with it would mean prompting again each time they
 * moved forward and stopped. Keyed by request id, so a genuinely new booking
 * gets its one prompt and the same one never gets a second.
 */
const PROMPTED_KEY = '@ghands:booking_resume_prompted';

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

/**
 * The server's name for a step, translated into ours.
 *
 * The drafts listing reports `draftStep` using its own vocabulary, and two of
 * its values have no separate screen here. `provider` and `confirm` both mean
 * the same thing to somebody coming back: everything is written down, and what
 * is left is choosing who does it - which is one screen.
 *
 * An unrecognised step is treated as the beginning rather than guessed at.
 * Sending somebody to a later screen than they reached would skip a question
 * the booking cannot be published without.
 */
export function bookingStepFromServer(draftStep: unknown): BookingStep {
  const step = typeof draftStep === 'string' ? draftStep.trim().toLowerCase() : '';
  switch (step) {
    case 'schedule':
      return 'schedule';
    case 'photos':
      return 'photos';
    case 'provider':
    case 'providers':
    case 'confirm':
      return 'providers';
    default:
      return 'details';
  }
}

/** The later of two steps. Progress never goes backwards on a redraw. */
export function furthestBookingStep(...steps: (BookingStep | null | undefined)[]): BookingStep {
  let best = 0;
  steps.forEach((step) => {
    const index = step ? BOOKING_STEPS.indexOf(step) : -1;
    if (index > best) best = index;
  });
  return BOOKING_STEPS[best];
}

/**
 * How far the booking itself proves they got.
 *
 * A floor, not an answer. The step pointer is written when somebody leaves a
 * screen and can lag behind what they actually did - the draft told one
 * customer their photos were still outstanding on a booking whose photos were
 * already on the server. The record cannot lie in that direction: a scheduled
 * date means the date screen was answered, whatever any pointer says.
 *
 * Photos are the reason this is only a floor. They are optional, so an empty
 * image list proves nothing either way - somebody may have passed that screen
 * and chosen not to add any. Images present prove they passed it; images
 * absent prove nothing at all.
 */
export function bookingStepFromDraftContent(request: {
  jobTitle?: unknown;
  description?: unknown;
  scheduledDate?: unknown;
  images?: unknown;
} | null | undefined): BookingStep {
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

  if (!request) return 'details';
  if (!text(request.jobTitle) || !text(request.description)) return 'details';
  if (!text(request.scheduledDate)) return 'schedule';

  /**
   * Photos arrive under whichever name the server happens to use. The app
   * sends `images` on the details update, but the record comes back through
   * more than one endpoint and this is not a field worth guessing wrong about
   * - a miss here tells somebody to add photos they have already added.
   */
  const photos = [
    request.images,
    (request as Record<string, unknown>).imageUrls,
    (request as Record<string, unknown>).photos,
    (request as Record<string, unknown>).requestImages,
  ].find((value) => Array.isArray(value) && value.length > 0);

  if (photos) return 'providers';
  return 'photos';
}

/**
 * Turns a raw draft record into the shape every resume-card helper below
 * expects. Shared so useBookingResume's primary draft and a list of the
 * others (Jobs > Drafts) score their step the same way, from the same rule.
 */
export function pointFromDraft(draft: {
  id: number | string;
  categoryName?: string;
  updatedAt?: string;
  createdAt?: string;
  draftStep?: unknown;
  jobTitle?: unknown;
  description?: unknown;
  scheduledDate?: unknown;
  images?: unknown;
}): BookingResumePoint {
  const requestId = String(draft.id);
  return {
    requestId,
    step: furthestBookingStep(
      bookingStepFromServer(draft.draftStep),
      bookingStepFromDraftContent(draft),
    ),
    categoryName: draft.categoryName,
    params: { requestId },
    savedAt: Date.parse(draft.updatedAt ?? draft.createdAt ?? '') || Date.now(),
  };
}

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
    await AsyncStorage.multiRemove([STORAGE_KEY, PROMPTED_KEY]);
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

/** Every step, in order, for the timeline to name its stops. */
export function bookingStepLabels(): string[] {
  return BOOKING_STEPS.map((step) => STEP_LABEL[step]);
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

/**
 * Whether the interrupting prompt is worth showing for this draft.
 *
 * Two conditions, and both matter. An interstitial on launch is the most
 * resented pattern on a phone: it blocks the app to talk about something the
 * person may not have opened it for. It only earns that by being rare and by
 * being about something they would mind losing.
 *
 *  - Once per booking. Dismissing it is an answer, not a snooze, and the home
 *    card is still there for whenever they do want it.
 *  - Not for a booking that is barely started. Tapping a category and closing
 *    the app has cost them nothing, so interrupting to offer it back is
 *    interrupting to offer nothing.
 */
export async function shouldPromptResume(point: BookingResumePoint): Promise<boolean> {
  if (point.step === 'details') return false;

  try {
    const prompted = await AsyncStorage.getItem(PROMPTED_KEY);
    return prompted !== point.requestId;
  } catch {
    /* if we cannot tell, do not interrupt */
    return false;
  }
}

/** Called when the prompt is shown, so it is not shown for this booking again. */
export async function markResumePrompted(requestId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMPTED_KEY, requestId);
  } catch {
    /* worst case is one repeated prompt, which is better than a crash */
  }
}
