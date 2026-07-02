import { JOB_STATUS_BADGE } from '@/lib/statusBadges';

/** User-facing label on Home + Jobs cards — one per meaningful API job state. */
export type JobDisplayStatus =
  | 'Pending'
  | 'Accepted'
  | 'Inspecting'
  | 'Quoting'
  | 'Scheduled'
  | 'In progress'
  | 'Reviewing'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected'
  | 'No providers';

const API_STATUS_MAP: Record<string, JobDisplayStatus> = {
  pending: 'Pending',
  accepted: 'Accepted',
  inspecting: 'Inspecting',
  quoting: 'Quoting',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  reviewing: 'Reviewing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  no_providers: 'No providers',
};

const DISPLAY_STATUSES: JobDisplayStatus[] = [
  'Pending',
  'Accepted',
  'Inspecting',
  'Quoting',
  'Scheduled',
  'In progress',
  'Reviewing',
  'Completed',
  'Cancelled',
  'Rejected',
  'No providers',
];

/** Maps API + legacy card labels to a known display status. */
export function normalizeJobDisplayStatus(status: unknown): JobDisplayStatus {
  if (typeof status !== 'string' || !status.trim()) return 'Pending';

  const trimmed = status.trim();
  const fromApi = API_STATUS_MAP[trimmed.toLowerCase()];
  if (fromApi) return fromApi;

  if (DISPLAY_STATUSES.includes(trimmed as JobDisplayStatus)) {
    return trimmed as JobDisplayStatus;
  }

  if (trimmed === 'In Progress') return 'In progress';

  return 'Pending';
}

export function resolveJobDisplayStatus(
  rawStatus: string | undefined | null,
  options?: { acceptedProvidersCount?: number }
): JobDisplayStatus {
  const normalized = (rawStatus ?? '').toString().trim().toLowerCase();
  const mapped = API_STATUS_MAP[normalized];

  if (mapped) {
    if (mapped === 'Pending' && (options?.acceptedProvidersCount ?? 0) > 0) {
      return 'Accepted';
    }
    return mapped;
  }

  if ((options?.acceptedProvidersCount ?? 0) > 0) {
    return 'Accepted';
  }

  return 'Pending';
}

export function getJobDisplayStatusBadge(status: unknown): {
  bg: string;
  text: string;
} {
  const normalized = normalizeJobDisplayStatus(status);

  switch (normalized) {
    case 'Completed':
      return JOB_STATUS_BADGE.completed;
    case 'Scheduled':
      return JOB_STATUS_BADGE.scheduled;
    case 'In progress':
      return JOB_STATUS_BADGE.inProgress;
    case 'Reviewing':
      return JOB_STATUS_BADGE.reviewing;
    case 'Inspecting':
      return JOB_STATUS_BADGE.inspecting;
    case 'Quoting':
      return JOB_STATUS_BADGE.quoting;
    case 'Accepted':
      return JOB_STATUS_BADGE.accepted;
    case 'Cancelled':
      return JOB_STATUS_BADGE.cancelled;
    case 'Rejected':
    case 'No providers':
      return JOB_STATUS_BADGE.rejected;
    case 'Pending':
    default:
      return JOB_STATUS_BADGE.pending;
  }
}

/** Jobs tab → Ongoing */
export function isOngoingJobDisplayStatus(status: JobDisplayStatus): boolean {
  return !['Completed', 'Cancelled', 'Rejected', 'No providers'].includes(status);
}

/** Jobs tab → Completed */
export function isCompletedJobDisplayStatus(status: JobDisplayStatus): boolean {
  return status === 'Completed';
}

/** Jobs tab → Cancelled */
export function isCancelledTabJobDisplayStatus(status: JobDisplayStatus): boolean {
  return status === 'Cancelled' || status === 'Rejected' || status === 'No providers';
}

/** Show quote count row while still in negotiation. */
export function showQuoteCountOnJobCard(status: JobDisplayStatus): boolean {
  return ['Pending', 'Accepted', 'Inspecting', 'Quoting'].includes(status);
}

/** Client can cancel before a provider accepts. */
export function canCancelJobFromCard(
  status: JobDisplayStatus,
  acceptedProvidersCount: number
): boolean {
  return status === 'Pending' && acceptedProvidersCount === 0;
}
