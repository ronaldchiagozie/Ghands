/** Persisted numeric rating (1-5) for jobs list + detail, per user + request */
export function reviewRatingStorageKey(userId: number, requestId: number): string {
  return `@ghands:review_rating_u${userId}_r${requestId}`;
}

/** Best-effort parse of “your” rating from GET request payload shapes */
export function extractMyRatingFromRequest(request: unknown): number | null {
  if (!request || typeof request !== 'object') return null;
  const r = request as Record<string, unknown>;
  const nested =
    r.review && typeof r.review === 'object'
      ? ((r.review as Record<string, unknown>).rating ??
          (r.review as Record<string, unknown>).score)
      : undefined;
  const candidates = [r.clientReviewRating, r.reviewRating, r.myRating, r.userReviewRating, nested];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (!Number.isNaN(n) && n >= 1 && n <= 5) return Math.round(n);
  }
  return null;
}

/**
 * Review was submitted on another device / server already has it - not a user fault.
 */
export function isAlreadyReviewedApiError(error: unknown): boolean {
  const e = error as {
    status?: number;
    response?: { status?: number };
    message?: string;
    details?: { data?: { error?: string }; error?: string; message?: string };
  };
  const status = e?.status ?? e?.response?.status;
  const nested =
    e?.details?.data?.error ?? e?.details?.error ?? e?.details?.message ?? '';
  const msg = String(e?.message ?? nested ?? '').toLowerCase();
  if (status !== 400) return false;
  return (
    msg.includes('already reviewed') ||
    msg.includes('duplicate review') ||
    msg.includes('already submitted') ||
    msg.includes('review exists')
  );
}

/** When GET /requests/:id includes review flags, skip showing the rating modal. */
export function requestDetailsIndicatesClientReviewed(details: unknown): boolean {
  if (!details || typeof details !== 'object') return false;
  const d = details as Record<string, unknown>;
  if (d.hasReview === true || d.has_review === true) return true;
  if (d.reviewSubmitted === true || d.review_submitted === true) return true;
  if (d.clientHasReviewed === true || d.userHasReviewed === true) return true;
  const rev = d.review ?? d.userReview ?? d.clientReview;
  if (rev != null && typeof rev === 'object') return true;
  if (typeof rev === 'number' && rev > 0) return true;
  const sp = d.selectedProvider as Record<string, unknown> | undefined;
  if (sp && (sp.reviewRating != null || sp.clientRating != null)) return true;
  return false;
}
