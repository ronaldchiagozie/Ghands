/**
 * Picking a booking back up after an interruption.
 *
 * The draft status stopped abandoned bookings appearing as pending jobs, which
 * was the right fix. But invisible is not the same as recoverable: someone who
 * got a phone call while choosing a time came back to a home screen behaving as
 * though none of it had happened, and started again from the category.
 *
 * The request survives on the server as a draft. This is the pointer back to it.
 */
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
  setItem: jest.fn(async (k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete store[k];
  }),
}));

import {
  clearBookingResumePoint,
  readBookingResumePoint,
  rememberBookingStep,
  resumeRouteFor,
  resumeStepLabel,
} from '@/utils/bookingResume';

const KEY = '@ghands:booking_resume';

describe('booking resume pointer', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    jest.clearAllMocks();
  });

  it('remembers the step and what they had entered', async () => {
    await rememberBookingStep('schedule', '418', {
      requestId: '418',
      categoryName: 'Plumbing',
      selectedDate: '2026-09-12',
    });

    const point = await readBookingResumePoint();
    expect(point).toMatchObject({
      requestId: '418',
      step: 'schedule',
      categoryName: 'Plumbing',
    });
    expect(point?.params.selectedDate).toBe('2026-09-12');
  });

  it('reopens the screen they were on, carrying their answers', async () => {
    await rememberBookingStep('photos', '418', {
      requestId: '418',
      categoryName: 'Tiling',
      selectedTime: '10:00',
    });

    const point = (await readBookingResumePoint())!;
    const route = resumeRouteFor(point);
    expect(route.pathname).toBe('/AddPhotosScreen');
    expect(route.params).toMatchObject({ requestId: '418', selectedTime: '10:00' });
  });

  it('names the next thing they have to do', async () => {
    await rememberBookingStep('providers', '9', { requestId: '9' });
    expect(resumeStepLabel((await readBookingResumePoint())!)).toBe('Choose a provider');
  });

  /** Without a request there is nothing on the server to come back to. */
  it('records nothing when there is no request id', async () => {
    await rememberBookingStep('schedule', undefined, { categoryName: 'Plumbing' });
    await rememberBookingStep('schedule', '   ', { categoryName: 'Plumbing' });
    expect(await readBookingResumePoint()).toBeNull();
  });

  /**
   * A month-old half-booking is not worth offering back — the date they picked
   * has passed and they have long since moved on.
   */
  it('forgets a booking older than a week', async () => {
    await rememberBookingStep('schedule', '418', { requestId: '418' });
    const stored = JSON.parse(store[KEY]);
    stored.savedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    store[KEY] = JSON.stringify(stored);

    expect(await readBookingResumePoint()).toBeNull();
  });

  it('keeps one that is still inside the week', async () => {
    await rememberBookingStep('schedule', '418', { requestId: '418' });
    const stored = JSON.parse(store[KEY]);
    stored.savedAt = Date.now() - 6 * 24 * 60 * 60 * 1000;
    store[KEY] = JSON.stringify(stored);

    expect(await readBookingResumePoint()).not.toBeNull();
  });

  describe('bad stored data', () => {
    /** Never offer a "continue" that would navigate somewhere undefined. */
    it('treats anything malformed as no booking in progress', async () => {
      const cases = [
        'not json at all',
        '{}',
        JSON.stringify({ requestId: '418' }),
        JSON.stringify({ requestId: '418', step: 'nonsense', savedAt: Date.now() }),
        JSON.stringify({ requestId: '', step: 'schedule', savedAt: Date.now() }),
        JSON.stringify({ requestId: '418', step: 'schedule', savedAt: 'yesterday' }),
        JSON.stringify(null),
      ];

      for (const raw of cases) {
        store[KEY] = raw;
        expect(await readBookingResumePoint()).toBeNull();
      }
    });

    it('survives params that are not strings', async () => {
      store[KEY] = JSON.stringify({
        requestId: '418',
        step: 'schedule',
        savedAt: Date.now(),
        params: { requestId: '418', photoCount: 3, extra: null, blank: '  ' },
      });

      const point = await readBookingResumePoint();
      expect(point?.params).toEqual({ requestId: '418' });
    });
  });

  it('forgets the booking when it is finished or discarded', async () => {
    await rememberBookingStep('providers', '418', { requestId: '418' });
    await clearBookingResumePoint();
    expect(await readBookingResumePoint()).toBeNull();
  });

  /** A later step replaces the earlier one rather than accumulating. */
  it('tracks forward as they move through the flow', async () => {
    await rememberBookingStep('details', '418', { requestId: '418' });
    await rememberBookingStep('schedule', '418', { requestId: '418' });
    await rememberBookingStep('photos', '418', { requestId: '418' });

    expect((await readBookingResumePoint())?.step).toBe('photos');
  });
});
