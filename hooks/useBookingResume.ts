import { useCallback, useEffect, useState } from 'react';

import { serviceRequestService } from '@/services/api';
import { isAbandonedDraft } from '@/contract/src/bookingDraft';
import type { ServiceRequest } from '@/services/api';
import {
  clearBookingResumePoint,
  readBookingResumePoint,
  markResumePrompted,
  resumeHoursLeft,
  resumeProgress,
  resumeStepLabel,
  shouldPromptResume,
  type BookingResumePoint,
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

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const stored = await readBookingResumePoint();

    if (!stored) {
      setPoint(null);
      setDraft(null);
      setShouldPrompt(false);
      setIsLoading(false);
      return;
    }

    const requestId = parseInt(stored.requestId, 10);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      await clearBookingResumePoint();
      setPoint(null);
      setDraft(null);
      setShouldPrompt(false);
      setIsLoading(false);
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
    setPoint(stored);
    setShouldPrompt(await shouldPromptResume(stored));
    setIsLoading(false);

    try {
      const request = await serviceRequestService.getRequestDetails(requestId);

      if (isAbandonedDraft(request)) {
        /** Fills in the job title and the date, which the pointer does not hold. */
        setDraft(request);
      } else {
        /**
         * Finished, cancelled, or published from another device. Offering to
         * reopen a job somebody already booked is worse than offering nothing.
         */
        await clearBookingResumePoint();
        setPoint(null);
        setDraft(null);
        setShouldPrompt(false);
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
      }
    }
  }, []);

  const discard = useCallback(async () => {
    const discarding = point;

    /**
     * Forget it here first, so the card goes the moment they tap. Waiting on
     * the server would leave a discarded booking sitting on screen while a
     * cold instance wakes up.
     */
    await clearBookingResumePoint();
    setPoint(null);
    setDraft(null);
    setShouldPrompt(false);

    /**
     * Then tell the server, which deletes a draft outright rather than marking
     * it cancelled. Without this the row survives until the twenty-hour sweep,
     * and a booking somebody threw away would still be waiting for them on
     * another device.
     *
     * Best effort on purpose: the local copy is already gone, and a failure
     * here means one row expires on its own rather than being removed early.
     */
    const requestId = discarding ? parseInt(discarding.requestId, 10) : NaN;
    if (Number.isFinite(requestId) && requestId > 0) {
      try {
        await serviceRequestService.cancelRequest(requestId);
      } catch {
        /* it expires on its own */
      }
    }
  }, [point]);

  /**
   * Closes the prompt without touching the draft. Saying "not now" is an
   * answer about this moment, not about the booking, so the home card stays.
   */
  const dismissPrompt = useCallback(async () => {
    setShouldPrompt(false);
    if (point) await markResumePrompted(point.requestId);
  }, [point]);

  return {
    point,
    /** The draft record, for showing what they were actually booking. */
    draft,
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
