/**
 * Picking the job worth offering to book again.
 *
 * The home card names a service - "Book again, Cleaning" - so the choice of
 * which job it names has to be one the person would recognise as theirs.
 */

/** Only the fields the choice depends on, so this stays testable in isolation. */
type RebookCandidate = {
  id?: number | string;
  status?: string | null;
  categoryName?: string | null;
  jobTitle?: string | null;
  description?: string | null;
  createdAt?: string | null;
};

export type RebookSeed = {
  /** What gets booked. The create endpoint takes the name, not an id. */
  categoryName: string;
  /** Carried forward so the details step opens already written. */
  jobTitle: string;
  description: string;
};

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const createdAtMs = (candidate: RebookCandidate): number => {
  const parsed = candidate.createdAt ? Date.parse(candidate.createdAt) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The most recently created finished job, or nothing.
 *
 * Finished on purpose, rather than most recent of any kind. A booking that is
 * still running is the worst thing to offer back: somebody with a plumber
 * arriving tomorrow does not want "book again, plumbing", and tapping it would
 * quietly raise a second job for work already in hand. Only a job that ended
 * is a job you might genuinely want repeated.
 *
 * Cancelled is excluded for the same reason read the other way. It ended, but
 * it ended because they did not want it.
 */
export function pickRebookSeed(requests: readonly RebookCandidate[] | null | undefined): RebookSeed | null {
  if (!Array.isArray(requests) || requests.length === 0) return null;

  const finished = requests.filter((request) => {
    if (clean(request?.status).toLowerCase() !== 'completed') return false;
    /** Nothing to book without a category, whatever else the record holds. */
    return clean(request?.categoryName).length > 0;
  });

  if (finished.length === 0) return null;

  const latest = finished.reduce((best, request) =>
    createdAtMs(request) > createdAtMs(best) ? request : best,
  );

  return {
    categoryName: clean(latest.categoryName),
    /**
     * Both may be empty, and that is allowed. The category alone still saves
     * the whole browse-and-pick step, and the details screen asks for the rest
     * exactly as it would for any other booking.
     */
    jobTitle: clean(latest.jobTitle),
    description: clean(latest.description),
  };
}
