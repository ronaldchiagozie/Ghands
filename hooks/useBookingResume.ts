import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { serviceRequestService } from '@/services/api';
import { isAbandonedDraft } from '@/contract/src/bookingDraft';
import type { ServiceRequest } from '@/services/api';
import {
  clearBookingResumePoint,
  forgetAnsweredSteps,
  readAnsweredStep,
  readAnsweredStepMap,
  readBookingResumePoint,
  markResumePrompted,
  pointFromDraft,
  resetResumePromptsForNewSession,
  resumeHoursLeft,
  resumeProgress,
  furthestBookingStep,
  resumeStepLabel,
  shouldPromptResume,
  RESUME_SESSION_GAP_MS,
  type BookingResumePoint,
  type BookingStep,
} from '@/utils/bookingResume';

/**
 * The half-finished booking to offer back, if there is one.
 *
 * The stored pointer is only a hint. Before showing anything it asks the server
 * whether that request is still an unfinished draft, because the pointer can be
 * wrong in ways that matter: the booking may have been completed on another
 * device, or cancelled, or already published. Offering someone a "continue" that
 * reopens a job they already booked would be worse than offering nothing.
 *
 * Drafts are fetchable by id even though they are excluded from the list
 * endpoints, which is what makes the check possible at all.
 */
export function useBookingResume() {
  const [point, setPoint] = useState<BookingResumePoint | null>(null);
  /**
   * The draft itself, not just the pointer. The card shows the actual booking -
   * the job they described, the day they picked - rather than a generic label,
   * because "your Plumbing booking, Saturday 10am" is recognisably theirs and
   * "you have an unfinished booking" is a notice about anything.
   */
  const [draft, setDraft] = useState<ServiceRequest | null>(null);
  /** Whether this booking has earned an interruption on the way in. */
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  /**
   * Every other abandoned draft on the account, beyond `point`. The backend
   * has always returned all of them from getDrafts() - this hook only ever
   * looked at the first one it found, so a second or third draft was silently
   * unreachable rather than merely unshown. `point`/`draft` stay a single
   * "the one worth interrupting for" for the home prompt; Jobs can list this
   * alongside it for the rest.
   */
  const [otherDrafts, setOtherDrafts] = useState<ServiceRequest[]>([]);
  /** This phone's progress per booking, for scoring `otherDrafts` consistently. */
  const [answeredSteps, setAnsweredSteps] = useState<Record<string, BookingStep>>({});

  const loadOtherDrafts = useCallback(async (primaryId: string | null, preFetched?: ServiceRequest[]) => {
    try {
      const remote = preFetched ?? (await serviceRequestService.getDrafts());
      const abandoned = remote.filter((row) => isAbandonedDraft(row));
      setOtherDrafts(abandoned.filter((row) => String(row.id) !== primaryId));
      /**
       * One read for the whole list. Whoever renders these scores them with
       * pointFromDraft, and without this map it would score them off the
       * server alone - so the same booking would read "add photos" in the
       * list and "choose a provider" in the prompt.
       */
      setAnsweredSteps(await readAnsweredStepMap());
    } catch {
      /* best effort - a failed fetch here just means the list doesn't grow this pass */
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const stored = await readBookingResumePoint();

    if (!stored) {
      /**
       * Nothing on this phone. Ask the account.
       *
       * The pointer is local, so a booking started on a phone used to be
       * invisible on a tablet even though the server had the draft the whole
       * time. The drafts listing makes a half-finished booking something the
       * account has rather than something one handset remembers.
       *
       * This prompts like any other draft, and the first version of it did
       * not - which is why the modal was never seen on the home screen at
       * all. The reasoning was that a booking left on another device has not
       * earned an interruption here. The reasoning was about the wrong case:
       * the local pointer expires after twenty hours and the server's draft
       * does not, so the common path is not another handset, it is this one
       * the next morning. Suppressing it there meant a draft appeared in the
       * Jobs tab and nowhere else, forever.
       *
       * Still once per booking. The rule that stops it nagging lives in
       * shouldPromptResume, which is keyed on the request id, so a draft
       * recovered from the account is asked about exactly as often as one
       * remembered on the phone: once.
       */
      /**
       * Tolerant of a server that will not answer.
       *
       * This await was bare, and it runs on every home mount and every
       * return from the background - so with the backend asleep or
       * unreachable it threw into nothing and became an uncaught promise
       * rejection, logged in red on every launch. Nothing broke, which is
       * the problem: the noise was indistinguishable from a real fault, and
       * it buried anything that was one.
       *
       * No drafts is the right answer when we cannot ask. The pointer on
       * this phone still works, and the next refresh tries again.
       */
      const remote = await serviceRequestService.getDrafts().catch(() => []);
      const candidate = remote.find((row) => isAbandonedDraft(row));

      if (candidate) {
        /**
         * This phone's own record of what it watched them answer, used as a
         * floor on the server's reading. Without it a customer who added
         * photos is handed the draft back still being asked for photos,
         * because the images are attached through a details field the backend
         * has never confirmed it stores.
         */
        const localFloor = await readAnsweredStep(String(candidate.id));
        const recovered = pointFromDraft(candidate as any, localFloor);
        setPoint(recovered);
        setDraft(candidate);
        setShouldPrompt(await shouldPromptResume(recovered));
        setIsLoading(false);
        void loadOtherDrafts(String(candidate.id), remote);
        return;
      }

      setPoint(null);
      setDraft(null);
      setShouldPrompt(false);
      setIsLoading(false);
      void loadOtherDrafts(null, remote);
      return;
    }

    const requestId = parseInt(stored.requestId, 10);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      await clearBookingResumePoint();
      setPoint(null);
      setDraft(null);
      setShouldPrompt(false);
      setIsLoading(false);
      void loadOtherDrafts(null);
      return;
    }

    /**
     * Show it from the stored pointer first, then check with the server.
     *
     * This used to wait for getRequestDetails before showing anything, so the
     * draft only existed once the server had answered. The backend sleeps when
     * idle and its first call can take twenty seconds or time out, which is
     * exactly when somebody opens the app, so the prompt and the tab quietly
     * failed to appear at all and the draft looked lost.
     *
     * The pointer is enough to render: it holds the category, the step and the
     * answers already given. The server's job is to correct us, not to grant
     * permission, and it does that a moment later.
     */
    const localFloor = await readAnsweredStep(stored.requestId);
    const hydrated = localFloor
      ? { ...stored, step: furthestBookingStep(stored.step, localFloor) }
      : stored;

    setPoint(hydrated);
    setShouldPrompt(await shouldPromptResume(hydrated));
    setIsLoading(false);
    /** Reassigned to null below if this one turns out to be finished/gone. */
    let resolvedPrimaryId: string | null = stored.requestId;

    try {
      const request = await serviceRequestService.getRequestDetails(requestId);

      if (isAbandonedDraft(request)) {
        /** Fills in the job title and the date, which the pointer does not hold. */
        setDraft(request);

        /**
         * And corrects the step, and completes the params.
         *
         * The step first: the pointer is written as somebody leaves a screen,
         * so it lags what they actually did, and the record cannot lag in that
         * direction. The local floor is applied too, for the one thing the
         * record is unreliable about - whether photos were added.
         *
         * The params second, from the draft, underneath whatever the pointer
         * already holds. A pointer written on the details screen has no
         * address and no coordinates on it, and the provider map needs both;
         * arriving without them is what made Continue land on a map with no
         * pins asking for a category that had already been chosen.
         */
        const fromServer = pointFromDraft(request as any, localFloor);
        setPoint((current) =>
          current
            ? {
                ...current,
                step: furthestBookingStep(current.step, fromServer.step),
                categoryName: current.categoryName ?? fromServer.categoryName,
                params: { ...fromServer.params, ...current.params },
              }
            : current,
        );
      } else {
        /**
         * Finished, cancelled, or published from another device. Offering to
         * reopen a job somebody already booked is worse than offering nothing.
         */
        await clearBookingResumePoint();
        setPoint(null);
        setDraft(null);
        setShouldPrompt(false);
        resolvedPrimaryId = null;
      }
    } catch (error: any) {
      /**
       * A 404 means the request is gone and the pointer should go with it.
       * Anything else - offline, a 500, a cold server - says nothing about the
       * booking, so what is already on screen stays there.
       */
      if (error?.status === 404) {
        await clearBookingResumePoint();
        setPoint(null);
        setDraft(null);
        setShouldPrompt(false);
        resolvedPrimaryId = null;
      }
    }

    void loadOtherDrafts(resolvedPrimaryId);
  }, [loadOtherDrafts]);

  /**
   * Discards `point` (the primary) when called with no argument - every
   * existing call site does this and keeps working unchanged. Pass a
   * requestId to discard a specific draft out of `otherDrafts` instead, which
   * is what a multi-draft list needs: discarding the second draft must not
   * touch the first.
   */
  const discard = useCallback(async (requestId?: string) => {
    const targetId = requestId ?? point?.requestId;
    if (!targetId) return;

    if (targetId === point?.requestId) {
      /**
       * Forget it here first, so the card goes the moment they tap. Waiting on
       * the server would leave a discarded booking sitting on screen while a
       * cold instance wakes up.
       */
      await clearBookingResumePoint();
      setPoint(null);
      setDraft(null);
      setShouldPrompt(false);
    } else {
      /** One of the others - drop it from that list immediately, same reasoning. */
      setOtherDrafts((current) => current.filter((row) => String(row.id) !== targetId));
    }

    /**
     * Then tell the server, which deletes a draft outright rather than marking
     * it cancelled. Without this the row survives until the twenty-hour sweep,
     * and a booking somebody threw away would still be waiting for them on
     * another device.
     *
     * Best effort on purpose: the local copy is already gone, and a failure
     * here means one row expires on its own rather than being removed early.
     */
    void forgetAnsweredSteps(targetId);

    const numericId = parseInt(targetId, 10);
    if (Number.isFinite(numericId) && numericId > 0) {
      try {
        await serviceRequestService.cancelRequest(numericId);
      } catch {
        /* it expires on its own */
      }
    }

    /**
     * Discarding the primary leaves a gap that only a real refresh fills
     * correctly - the next-best draft has to be re-fetched and re-scored
     * against the local pointer / step logic, not guessed at from otherDrafts.
     */
    if (targetId === point?.requestId) {
      void refresh();
    }
  }, [point, refresh]);

  /**
   * Offers the draft again when they come back to the app.
   *
   * The prompt only ever fired on a cold start, because the hook refreshed on
   * mount and the home screen stays mounted. So the common case - swipe the
   * app away or leave it in the background, come back, no interruption - was
   * the one case it never covered, and a customer who had been told nothing
   * reasonably concluded the half-finished booking was gone.
   *
   * Gated on how long they were away (RESUME_SESSION_GAP_MS), because leaving
   * to the camera roll or to answer a call is not coming back to the app, and
   * re-prompting on every brief return is the nagging the once-per-visit rule
   * exists to avoid.
   */
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        /** First departure wins: inactive then background must not reset the clock. */
        if (leftAt.current == null) leftAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;

      const away = leftAt.current == null ? 0 : Date.now() - leftAt.current;
      leftAt.current = null;
      if (away < RESUME_SESSION_GAP_MS) return;

      resetResumePromptsForNewSession();
      void refresh();
    };

    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [refresh]);

  /**
   * Closes the prompt without touching the draft. Saying "not now" is an
   * answer about this visit, not about the booking, so it is offered again
   * the next time they open the app and the draft stays in Jobs meanwhile.
   */
  const dismissPrompt = useCallback(async () => {
    setShouldPrompt(false);
    if (point) await markResumePrompted(point.requestId);
  }, [point]);

  return {
    point,
    /** The draft record, for showing what they were actually booking. */
    draft,
    /** Every other abandoned draft on the account, beyond `point` - for a list, not the interruption prompt. */
    otherDrafts,
    /** Local progress per booking id, to score `otherDrafts` the way `point` is scored. */
    answeredSteps,
    /** What they were about to do, for the card's copy. */
    stepLabel: point ? resumeStepLabel(point) : null,
    /** Position in the flow, so the card can show how far in they are. */
    progress: point ? resumeProgress(point) : null,
    /** Hours remaining, only once it is close enough to matter. */
    hoursLeft: point ? resumeHoursLeft(point) : null,
    /** True the first time an app entry finds a booking worth interrupting for. */
    shouldPrompt: shouldPrompt && !!point,
    dismissPrompt,
    isLoading,
    refresh,
    discard,
  };
}
