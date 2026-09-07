/**
 * Telling a real booking apart from an abandoned draft.
 *
 * The client creates the service request the moment a category is tapped -
 * before job title, description, schedule, photos or provider exist - so a
 * user who backs out mid-flow leaves a real row behind. Those rows were
 * surfacing in the jobs list as "Pending", which reads as "we are finding you a
 * provider" when in fact nothing was ever submitted.
 *
 * The backend has since confirmed it already models this: requests are created
 * as `draft` and its list endpoint excludes them. So this now defers to the
 * server - `draft` is filtered, everything else is trusted - and keeps only the
 * noise filter for rows with no title or description. It stays because the
 * booking flow reads drafts back by id while filling them in, and because two
 * apps read this list.
 */

type DraftCandidate = {
  jobTitle?: string | null;
  description?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  selectedProvider?: { id?: number } | null;
  status?: string | null;
};

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Statuses only ever reached after a provider is engaged. Once a request is in
 * one of these it is unambiguously a live job, whatever else is missing.
 */
const ENGAGED_STATUSES = new Set([
  'accepted',
  'inspecting',
  'quoting',
  'scheduled',
  'in_progress',
  'reviewing',
  'completed',
]);

export type BookingProgress = {
  /** Providers that accepted the request. */
  acceptedProviderCount?: number;
  /** Quotations received. */
  quotationCount?: number;
};

/** True when the user actually finished booking this request. */
export function isSubmittedBooking(
  request: DraftCandidate | null | undefined,
  progress: BookingProgress = {},
): boolean {
  if (!request) return false;

  const status = String(request.status ?? '').toLowerCase();

  /**
   * The server is authoritative about this now. Its request list excludes
   * `draft` outright - it even overrides an explicit `?status=draft` - so
   * anything that reaches us has been submitted, and second-guessing that here
   * would hide real jobs. A draft can still arrive when fetched by id, which
   * the booking flow does while filling one in, so the check stays.
   */
  if (status === 'draft') return false;

  // Still a noise filter: a row with neither title nor description is not a job.
  if (!hasText(request.jobTitle) || !hasText(request.description)) return false;

  if (ENGAGED_STATUSES.has(status)) return true;
  if (request.selectedProvider?.id != null) return true;
  if ((progress.acceptedProviderCount ?? 0) > 0) return true;
  if ((progress.quotationCount ?? 0) > 0) return true;
  if (hasText(request.scheduledDate) || hasText(request.scheduledTime)) return true;

  /**
   * Reached only for a `pending` row with details but no other evidence. The
   * server would not have sent it unless it left draft, so trust it.
   */
  return true;
}

/** Convenience inverse - a request the user started and never submitted. */
export function isAbandonedDraft(
  request: DraftCandidate | null | undefined,
  progress: BookingProgress = {},
): boolean {
  return !isSubmittedBooking(request, progress);
}
