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
      setIsLoading(false);
      return;
    }

    const requestId = parseInt(stored.requestId, 10);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      await clearBookingResumePoint();
      setPoint(null);
      setDraft(null);
      setIsLoading(false);
      return;
    }

    try {
      const request = await serviceRequestService.getRequestDetails(requestId);

      /**
       * Only offer it back while it is still unfinished. Anything that has left
       * draft is a real booking and belongs in the jobs list, not behind a
       * "continue where you left off".
       */
      if (isAbandonedDraft(request)) {
        setPoint(stored);
        setDraft(request);
        setShouldPrompt(await shouldPromptResume(stored));
      } else {
        await clearBookingResumePoint();
        setPoint(null);
        setDraft(null);
      }
    } catch (error: any) {
      /**
       * A 404 means the request is gone and the pointer should go with it.
       * Anything else - offline, a 500, a cold server - is not evidence about
       * the booking, so the pointer stays and the card simply does not appear
       * this time.
       */
      if (error?.status === 404) {
        await clearBookingResumePoint();
      }
      setPoint(null);
      setDraft(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const discard = useCallback(async () => {
    await clearBookingResumePoint();
    setPoint(null);
    setDraft(null);
    setShouldPrompt(false);
  }, []);

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
