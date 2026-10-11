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
 * Where the one-prompt-per-booking rule used to live.
 *
 * Kept only so the key is cleared off phones that still carry it; the rule
 * itself is now per visit and in memory - see promptedThisSession.
 */
const PROMPTED_KEY = '@ghands:booking_resume_prompted';

/**
 * The steps this phone has watched somebody answer, per booking.
 *
 * Separate from the pointer, which holds one booking and expires in twenty
 * hours. This is the record of what was actually done, and it exists because
 * the server's copy cannot be trusted to show it: photos are attached through
 * the details endpoint under a key the backend has never confirmed, so a
 * customer who adds three photos can be handed their draft back the next
 * morning still being asked for photos. Which is the one thing that makes the
 * resume prompt feel broken rather than helpful - it asks for work already
 * done, so the customer concludes it lost the lot.
 *
 * Local, and therefore a floor and never a ceiling: it can only move a draft's
 * progress forward, never back, and the server still wins on anything it does
 * report. A second handset simply has no local record and falls back to the
 * server's reading, which is the behaviour this had everywhere before.
 */
const ANSWERED_STEPS_KEY = '@ghands:booking_steps_answered';

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

/** The count of photos already on the record, for the summary's "N photos". */
function draftPhotoCount(draft: Record<string, unknown>): number {
  const photos = [draft.images, draft.imageUrls, draft.photos, draft.requestImages].find(
    (value) => Array.isArray(value) && value.length > 0,
  );
  return Array.isArray(photos) ? photos.length : 0;
}

/**
 * Every route param the booking screens need to reopen as themselves.
 *
 * This used to be `{ requestId }` and nothing else, which is what made
 * continuing a draft from the Jobs tab or a second handset land on a broken
 * provider map: the map reads the trade and the address off its params, so
 * with neither it drew no pins and reported "Please select a service category"
 * and "Please set your service location" - telling somebody who had already
 * answered both to go and answer them, on the screen that came after.
 *
 * The draft record holds all of it, so there is no reason to arrive without it.
 */
function paramsFromDraft(draft: Record<string, unknown>, requestId: string): Record<string, string> {
  const params: Record<string, string> = { requestId };
  const put = (key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) params[key] = value.trim();
    else if (typeof value === 'number' && Number.isFinite(value)) params[key] = String(value);
  };

  const category = typeof draft.categoryName === 'string' ? draft.categoryName.trim() : '';
  if (category) {
    put('categoryName', category);
    /** Both names are read, by different screens, for the same value. */
    put('serviceType', category);
  }

  const location = (draft.location ?? {}) as Record<string, unknown>;
  put('location', location.formattedAddress ?? location.address ?? '');
  put('latitude', location.latitude);
  put('longitude', location.longitude);

  put('selectedDate', draft.scheduledDate);
  put('selectedTime', draft.scheduledTime);

  const photos = draftPhotoCount(draft);
  if (photos > 0) put('photoCount', String(photos));

  return params;
}

/**
 * Turns a raw draft record into the shape every resume-card helper below
 * expects. Shared so useBookingResume's primary draft and a list of the
 * others (Jobs > Drafts) score their step the same way, from the same rule.
 *
 * `localFloor` is this phone's own record of what it watched them answer -
 * see ANSWERED_STEPS_KEY. Passed in rather than read here so this stays
 * synchronous for the list that renders several drafts at once.
 */
export function pointFromDraft(
  draft: {
    id: number | string;
    categoryName?: string;
    updatedAt?: string;
    createdAt?: string;
    draftStep?: unknown;
    jobTitle?: unknown;
    description?: unknown;
    scheduledDate?: unknown;
    images?: unknown;
  },
  localFloor?: BookingStep | null,
): BookingResumePoint {
  const requestId = String(draft.id);
  return {
    requestId,
    step: furthestBookingStep(
      bookingStepFromServer(draft.draftStep),
      bookingStepFromDraftContent(draft),
      localFloor,
    ),
    categoryName: draft.categoryName,
    params: paramsFromDraft(draft as Record<string, unknown>, requestId),
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

  void rememberAnsweredStep(String(requestId), step);

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
  /**
   * Including who has been asked. This is called when a booking ends - sent,
   * or given up on - so nothing is left to be quiet about, and starting a new
   * one in the same session should be offered back like any other.
   */
  resetResumePromptsForNewSession();
  try {
    await AsyncStorage.multiRemove([STORAGE_KEY, PROMPTED_KEY]);
  } catch {
    /* ignore */
  }
}

/**
 * Drops this phone's progress record for a booking that is over.
 *
 * Called when a draft is discarded or published. Without it the record sits
 * there until the twenty-hour sweep, which costs nothing but is one more
 * stale thing to reason about.
 */
export async function forgetAnsweredSteps(requestId: string): Promise<void> {
  try {
    const all = await readAnsweredSteps();
    if (!(requestId in all)) return;
    delete all[requestId];
    await AsyncStorage.setItem(ANSWERED_STEPS_KEY, JSON.stringify(all));
  } catch {
    /* it expires on its own */
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

type AnsweredSteps = Record<string, { step: BookingStep; savedAt: number }>;

async function readAnsweredSteps(): Promise<AnsweredSteps> {
  try {
    const raw = await AsyncStorage.getItem(ANSWERED_STEPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AnsweredSteps;
    if (!parsed || typeof parsed !== 'object') return {};

    const fresh: AnsweredSteps = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || !isBookingStep(entry.step)) continue;
      if (typeof entry.savedAt !== 'number' || !Number.isFinite(entry.savedAt)) continue;
      /** The server deletes the draft at the same age, so the record is no use past it. */
      if (Date.now() - entry.savedAt > RESUME_TTL_MS) continue;
      fresh[id] = entry;
    }
    return fresh;
  } catch {
    return {};
  }
}

/** Records a step as answered for this booking, keeping the furthest reached. */
async function rememberAnsweredStep(requestId: string, step: BookingStep): Promise<void> {
  try {
    const all = await readAnsweredSteps();
    const existing = all[requestId]?.step;
    all[requestId] = { step: furthestBookingStep(existing, step), savedAt: Date.now() };
    await AsyncStorage.setItem(ANSWERED_STEPS_KEY, JSON.stringify(all));
  } catch {
    /* progress tracking is a convenience; never let it break the booking flow */
  }
}

/**
 * How far this phone watched them get on this booking, or null.
 *
 * The answer to "the draft says add photos and I added photos". Read as a
 * floor on the server's reading, never a replacement for it.
 */
export async function readAnsweredStep(requestId: string): Promise<BookingStep | null> {
  const all = await readAnsweredSteps();
  return all[requestId]?.step ?? null;
}

/** Every booking this phone has local progress for, for scoring a list in one read. */
export async function readAnsweredStepMap(): Promise<Record<string, BookingStep>> {
  const all = await readAnsweredSteps();
  const out: Record<string, BookingStep> = {};
  for (const [id, entry] of Object.entries(all)) out[id] = entry.step;
  return out;
}

/**
 * Bookings already offered back during this run of the app.
 *
 * In memory on purpose. This used to be an AsyncStorage key holding one
 * request id, which meant "not now" was an answer about the booking forever:
 * dismiss it once and the only place the draft existed again was the Jobs tab.
 * A half-finished booking is worth one mention per time you open the app - the
 * situation has changed, you are back, and the draft is still waiting - and
 * worth no mentions at all while you stay in the app and keep saying no.
 *
 * Losing this when the process dies is the behaviour, not a limitation.
 */
const promptedThisSession = new Set<string>();

/**
 * Starts a fresh round of prompting.
 *
 * Called when the app comes back from the background after long enough that
 * returning to it is a new visit rather than a glance away - see
 * RESUME_SESSION_GAP_MS - and implicitly on a cold start, because the set
 * above is empty then.
 */
export function resetResumePromptsForNewSession(): void {
  promptedThisSession.clear();
}

/**
 * How long the app has to have been in the background for coming back to count
 * as opening it again.
 *
 * A minute. Picking a photo, taking a call or checking an address in Maps all
 * leave and return inside that, and re-interrupting somebody who never really
 * left is the nagging this is trying not to do.
 */
export const RESUME_SESSION_GAP_MS = 60 * 1000;

/**
 * Whether the interrupting prompt is worth showing for this draft.
 *
 * Two conditions, and both matter. An interstitial on launch is the most
 * resented pattern on a phone: it blocks the app to talk about something the
 * person may not have opened it for. It only earns that by being about
 * something they would mind losing, and by taking no for an answer while they
 * are here.
 *
 *  - Once per visit. Dismissing it settles this visit, not the booking.
 *  - Not for a booking that is barely started. Tapping a category and closing
 *    the app has cost them nothing, so interrupting to offer it back is
 *    interrupting to offer nothing.
 */
export async function shouldPromptResume(point: BookingResumePoint): Promise<boolean> {
  if (point.step === 'details') return false;
  return !promptedThisSession.has(point.requestId);
}

/** Called when the prompt is shown, so it is not shown again this visit. */
export async function markResumePrompted(requestId: string): Promise<void> {
  promptedThisSession.add(requestId);
}
