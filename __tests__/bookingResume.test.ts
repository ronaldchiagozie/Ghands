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
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => delete store[k]);
  }),
}));

import {
  bookingStepFromDraftContent,
  bookingStepFromServer,
  furthestBookingStep,
  clearBookingResumePoint,
  readBookingResumePoint,
  rememberBookingStep,
  markResumePrompted,
  forgetAnsweredSteps,
  pointFromDraft,
  readAnsweredStep,
  resetResumePromptsForNewSession,
  resumeHoursLeft,
  resumeProgress,
  resumeRouteFor,
  resumeStepLabel,
  shouldPromptResume,
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
   * Twenty hours, matching the server-side retention we asked for. The two have
   * to agree: offering a draft the server has already deleted lands the
   * customer on an error, which is worse than never offering it.
   */
  it('forgets a booking older than twenty hours', async () => {
    await rememberBookingStep('schedule', '418', { requestId: '418' });
    const stored = JSON.parse(store[KEY]);
    stored.savedAt = Date.now() - 21 * 60 * 60 * 1000;
    store[KEY] = JSON.stringify(stored);

    expect(await readBookingResumePoint()).toBeNull();
  });

  it('keeps one that is still inside the window', async () => {
    await rememberBookingStep('schedule', '418', { requestId: '418' });
    const stored = JSON.parse(store[KEY]);
    stored.savedAt = Date.now() - 19 * 60 * 60 * 1000;
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

  /**
   * The card shows position, not a percentage, because the steps are discrete
   * and unequal: "three of four" is something somebody can hold in their head
   * while deciding whether finishing is worth starting now.
   */
  describe('progress through the flow', () => {
    it('counts the steps already behind them', async () => {
      await rememberBookingStep('details', '418', { requestId: '418' });
      expect(resumeProgress((await readBookingResumePoint())!)).toEqual({ done: 0, total: 4 });

      await rememberBookingStep('providers', '418', { requestId: '418' });
      expect(resumeProgress((await readBookingResumePoint())!)).toEqual({ done: 3, total: 4 });
    });
  });

  /**
   * A countdown running the whole twenty hours is pressure applied to somebody
   * who has done nothing wrong. It appears only once the draft is close to
   * being deleted, which is the point at which it is information.
   */
  describe('the expiry warning', () => {
    const at = async (agoMs: number) => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      const stored = JSON.parse(store[KEY]);
      stored.savedAt = Date.now() - agoMs;
      store[KEY] = JSON.stringify(stored);
      return (await readBookingResumePoint())!;
    };

    it('says nothing while there is plenty of time', async () => {
      expect(resumeHoursLeft(await at(60 * 60 * 1000))).toBeNull();
    });

    it('speaks up once it is close', async () => {
      const hours = resumeHoursLeft(await at(16 * 60 * 60 * 1000));
      expect(hours).not.toBeNull();
      expect(hours).toBeLessThanOrEqual(6);
      expect(hours).toBeGreaterThan(0);
    });

    /** Never "0h left", and never a countdown on something already gone. */
    it('never shows a zero or a negative', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      const stored = JSON.parse(store[KEY]);
      stored.savedAt = Date.now() - 19.99 * 60 * 60 * 1000;
      store[KEY] = JSON.stringify(stored);
      const point = (await readBookingResumePoint())!;
      expect(resumeHoursLeft(point)).toBe(1);
    });
  });

  /**
   * The prompt interrupts on the way into the app, which is the most resented
   * pattern on a phone. It only earns that by being rare and by being about
   * something somebody would mind losing.
   */
  describe('whether to interrupt on entry', () => {
    it('offers a booking with real work in it', async () => {
      await rememberBookingStep('photos', '418', { requestId: '418' });
      const point = (await readBookingResumePoint())!;
      await expect(shouldPromptResume(point)).resolves.toBe(true);
    });

    /** A category tap and nothing else has cost them nothing to lose. */
    it('does not interrupt for a booking barely started', async () => {
      await rememberBookingStep('details', '418', { requestId: '418' });
      const point = (await readBookingResumePoint())!;
      await expect(shouldPromptResume(point)).resolves.toBe(false);
    });

    it('asks once per visit, and again on the next one', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      const point = (await readBookingResumePoint())!;

      await expect(shouldPromptResume(point)).resolves.toBe(true);
      await markResumePrompted(point.requestId);
      await expect(shouldPromptResume(point)).resolves.toBe(false);

      /**
       * Reopening the app is a new visit. Dismissing used to settle the
       * booking for good, so the draft existed in the Jobs tab and nowhere
       * else - which read as the app having lost it.
       */
      resetResumePromptsForNewSession();
      await expect(shouldPromptResume(point)).resolves.toBe(true);
    });

    /** Answering about one booking must not silence the next one. */
    it('asks again for a different booking', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      await markResumePrompted('418');

      await rememberBookingStep('schedule', '999', { requestId: '999' });
      const next = (await readBookingResumePoint())!;
      await expect(shouldPromptResume(next)).resolves.toBe(true);
    });

    /** Moving forward and stopping again is not a reason to ask twice in one visit. */
    it('stays quiet after they advance a step', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      await markResumePrompted('418');

      await rememberBookingStep('photos', '418', { requestId: '418' });
      const later = (await readBookingResumePoint())!;
      await expect(shouldPromptResume(later)).resolves.toBe(false);
    });

    it('forgets it was asked once the booking is gone', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      await markResumePrompted('418');
      await clearBookingResumePoint();

      await rememberBookingStep('schedule', '418', { requestId: '418' });
      const fresh = (await readBookingResumePoint())!;
      await expect(shouldPromptResume(fresh)).resolves.toBe(true);
    });
  });

  /**
   * Closing the prompt and throwing the booking away are different answers,
   * and the whole design rests on them staying different. "Not now" is about
   * this moment; the booking has to survive it and stay in the Jobs tab, or
   * the modal quietly becomes a way to lose work by tapping the wrong thing
   * on the way into the app.
   */
  describe('what dismissing costs', () => {
    it('keeps the booking when the prompt is closed', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      const point = (await readBookingResumePoint())!;

      await markResumePrompted(point.requestId);

      /** Still there, which is what keeps the Drafts tab in Jobs. */
      const after = await readBookingResumePoint();
      expect(after).not.toBeNull();
      expect(after!.requestId).toBe('418');
      expect(after!.step).toBe('schedule');
    });

    /**
     * The answer is held for this visit only, so closing the app and opening
     * it again offers the booking back - with the pointer still intact, so it
     * is offered back at the step they actually reached.
     */
    it('asks again on a relaunch', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      await markResumePrompted('418');

      resetResumePromptsForNewSession();

      const onNextLaunch = (await readBookingResumePoint())!;
      await expect(shouldPromptResume(onNextLaunch)).resolves.toBe(true);
      expect(onNextLaunch.requestId).toBe('418');
      expect(onNextLaunch.step).toBe('schedule');
    });

    it('takes the booking with it only when it is actually discarded', async () => {
      await rememberBookingStep('schedule', '418', { requestId: '418' });
      await clearBookingResumePoint();

      expect(await readBookingResumePoint()).toBeNull();
    });
  });
});

/**
 * The server names the step it stopped at, in its own vocabulary. Two of its
 * values mean the same thing here, and an unknown one must not be guessed
 * forward - sending somebody past a screen they never reached would skip a
 * question the booking cannot be published without.
 */
describe('picking a booking up from the account', () => {
  it('understands the steps that map straight across', () => {
    expect(bookingStepFromServer('schedule')).toBe('schedule');
    expect(bookingStepFromServer('photos')).toBe('photos');
    expect(bookingStepFromServer('details')).toBe('details');
  });

  /** Choosing who does it is one screen here, whatever the server calls it. */
  it('treats choosing and confirming as the same place', () => {
    expect(bookingStepFromServer('provider')).toBe('providers');
    expect(bookingStepFromServer('providers')).toBe('providers');
    expect(bookingStepFromServer('confirm')).toBe('providers');
  });

  it('reads case and padding the server did not promise to normalise', () => {
    expect(bookingStepFromServer('  Schedule ')).toBe('schedule');
    expect(bookingStepFromServer('CONFIRM')).toBe('providers');
  });

  it('starts at the beginning rather than guessing forward', () => {
    expect(bookingStepFromServer('quote')).toBe('details');
    expect(bookingStepFromServer(undefined)).toBe('details');
    expect(bookingStepFromServer(null)).toBe('details');
    expect(bookingStepFromServer(7)).toBe('details');
  });
});

/**
 * What the booking itself proves.
 *
 * The step pointer is written as somebody leaves a screen, so it lags what
 * they actually did - it told one customer their photos were still to come on
 * a booking whose photos were already on the server. The record cannot lag in
 * that direction, so it is read as a floor and the further of the two wins.
 */
describe('progress read from the draft', () => {
  const draft = (over: Record<string, unknown> = {}) => ({
    jobTitle: 'Leaking sink',
    description: 'Water under the kitchen cupboard.',
    scheduledDate: '2026-09-12',
    images: [] as string[],
    ...over,
  });

  it('needs a title and a description before anything else', () => {
    expect(bookingStepFromDraftContent(draft({ jobTitle: '' }))).toBe('details');
    expect(bookingStepFromDraftContent(draft({ description: '  ' }))).toBe('details');
    expect(bookingStepFromDraftContent(null)).toBe('details');
  });

  it('knows the date screen was answered when there is a date', () => {
    expect(bookingStepFromDraftContent(draft({ scheduledDate: '' }))).toBe('schedule');
    expect(bookingStepFromDraftContent(draft())).toBe('photos');
  });

  /** The case that started this: photos uploaded, pointer still saying photos. */
  it('counts uploaded photos as that screen being done', () => {
    expect(bookingStepFromDraftContent(draft({ images: ['a.jpg'] }))).toBe('providers');
  });

  /**
   * And the reason it is only a floor. Photos are optional, so an empty list
   * proves nothing - somebody may have passed that screen and added none.
   */
  it('does not treat an empty photo list as proof of anything', () => {
    expect(bookingStepFromDraftContent(draft({ images: [] }))).toBe('photos');
    expect(furthestBookingStep('providers', bookingStepFromDraftContent(draft({ images: [] })))).toBe(
      'providers',
    );
  });

  it('takes whichever source got further', () => {
    expect(furthestBookingStep('photos', 'providers')).toBe('providers');
    expect(furthestBookingStep('providers', 'details')).toBe('providers');
    expect(furthestBookingStep(null, undefined)).toBe('details');
    expect(furthestBookingStep('schedule', null, 'photos')).toBe('photos');
  });
});

/**
 * What a draft is turned into before anything tries to reopen it.
 *
 * The params are the point of this: continuing a booking from the Jobs tab,
 * the resume prompt or a notification used to arrive carrying a requestId and
 * nothing else, and the provider map reads the trade and the address off its
 * params - so it drew no pins and told a customer who had answered both
 * questions to go and select a category and set a location.
 */
describe('reopening a draft', () => {
  const fullDraft = {
    id: 418,
    categoryName: 'Plumbing',
    jobTitle: 'Burst pipe under the sink',
    description: 'Water coming through the cupboard floor.',
    scheduledDate: '2026-02-14',
    scheduledTime: '10:00',
    location: {
      formattedAddress: '12 Admiralty Way, Lekki',
      latitude: 6.4361,
      longitude: 3.4518,
    },
    images: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    updatedAt: '2026-02-13T09:00:00.000Z',
  };

  it('carries the trade, the address and the coordinates', () => {
    const point = pointFromDraft(fullDraft as any);

    expect(point.params).toMatchObject({
      requestId: '418',
      categoryName: 'Plumbing',
      /** Two names for the same value; different screens read different ones. */
      serviceType: 'Plumbing',
      location: '12 Admiralty Way, Lekki',
      latitude: '6.4361',
      longitude: '3.4518',
      selectedDate: '2026-02-14',
      selectedTime: '10:00',
      photoCount: '2',
    });
  });

  it('leaves out what the draft does not have, rather than sending blanks', () => {
    const point = pointFromDraft({ id: 7, jobTitle: 'x', description: 'y' } as any);

    expect(point.params).toEqual({ requestId: '7' });
  });

  /**
   * The route has to be the step, with the params, or the whole exercise just
   * lands somebody on a screen that cannot draw itself.
   */
  it('routes to the map it can actually fill', () => {
    const route = resumeRouteFor(pointFromDraft(fullDraft as any));

    expect(route.pathname).toBe('/ServiceMapScreen');
    expect(route.params.categoryName).toBe('Plumbing');
    expect(route.params.latitude).toBe('6.4361');
  });

  /**
   * The blocker this is really for: photos are attached through a details
   * field the backend has never confirmed it stores, so the record can come
   * back with no images on a booking whose photos were added. The phone's own
   * record of the screens it watched them answer breaks the tie.
   */
  it('trusts this phone over the record about photos', () => {
    const withoutImages = { ...fullDraft, images: [] as string[] };

    expect(pointFromDraft(withoutImages as any).step).toBe('photos');
    expect(pointFromDraft(withoutImages as any, 'providers').step).toBe('providers');
  });

  /** And only ever forward. A stale local record must not undo real progress. */
  it('never moves a draft backwards', () => {
    expect(pointFromDraft(fullDraft as any, 'details').step).toBe('providers');
  });

  it('records the furthest step each booking reached, per booking', async () => {
    await rememberBookingStep('photos', '418', { requestId: '418' });
    await rememberBookingStep('providers', '418', { requestId: '418' });
    /** Going back a screen does not unanswer the one already answered. */
    await rememberBookingStep('schedule', '418', { requestId: '418' });
    await rememberBookingStep('schedule', '999', { requestId: '999' });

    expect(await readAnsweredStep('418')).toBe('providers');
    expect(await readAnsweredStep('999')).toBe('schedule');
    expect(await readAnsweredStep('123')).toBeNull();

    await forgetAnsweredSteps('418');
    expect(await readAnsweredStep('418')).toBeNull();
    expect(await readAnsweredStep('999')).toBe('schedule');
  });
});
