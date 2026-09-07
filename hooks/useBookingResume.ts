import { useCallback, useEffect, useState } from 'react';

import { serviceRequestService } from '@/services/api';
import { isAbandonedDraft } from '@/contract/src/bookingDraft';
import {
  clearBookingResumePoint,
  readBookingResumePoint,
  resumeStepLabel,
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
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const stored = await readBookingResumePoint();

    if (!stored) {
      setPoint(null);
      setIsLoading(false);
      return;
    }

    const requestId = parseInt(stored.requestId, 10);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      await clearBookingResumePoint();
      setPoint(null);
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
      } else {
        await clearBookingResumePoint();
        setPoint(null);
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
  }, []);

  return {
    point,
    /** What they were about to do, for the card's copy. */
    stepLabel: point ? resumeStepLabel(point) : null,
    isLoading,
    refresh,
    discard,
  };
}
