/**
 * Telling a real booking apart from an abandoned draft.
 *
 * The client creates the service request the moment a category is tapped —
 * before job title, description, schedule, photos or provider exist — so a
 * user who backs out mid-flow leaves a real row behind. Those rows were
 * surfacing in the jobs list as "Pending", which reads as "we are finding you a
 * provider" when in fact nothing was ever submitted.
 *
 * A booking counts as submitted once it has the details the flow collects AND
 * some evidence it reached the end of that flow: a chosen provider, providers
 * who accepted, quotations, or a confirmed schedule.
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

  // The details the booking flow collects before it can be confirmed.
  if (!hasText(request.jobTitle) || !hasText(request.description)) return false;

  const status = String(request.status ?? '').toLowerCase();
  if (ENGAGED_STATUSES.has(status)) return true;

  if (request.selectedProvider?.id != null) return true;
  if ((progress.acceptedProviderCount ?? 0) > 0) return true;
  if ((progress.quotationCount ?? 0) > 0) return true;

  // Schedule is set on the last step before providers are chosen.
  if (hasText(request.scheduledDate) || hasText(request.scheduledTime)) return true;

  return false;
}

/** Convenience inverse — a request the user started and never submitted. */
export function isAbandonedDraft(
  request: DraftCandidate | null | undefined,
  progress: BookingProgress = {},
): boolean {
  return !isSubmittedBooking(request, progress);
}
