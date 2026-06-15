export type VisitDeclineActor = 'client' | 'provider' | 'unknown';

const VISIT_DECLINED_STATUSES = new Set([
  'cancelled',
  'declined',
  'rejected',
  'provider_cancelled',
  'provider_declined',
  'provider_rejected',
  'client_cancelled',
  'client_declined',
  'client_rejected',
  'visit_cancelled',
  'visit_declined',
]);

export function getVisitLogisticsStatus(visitRequest?: Record<string, unknown> | null): string {
  if (!visitRequest) return '';
  const status =
    visitRequest.logisticsStatus ??
    visitRequest.logistics_status ??
    visitRequest.visitStatus ??
    visitRequest.visit_status;
  return typeof status === 'string' ? status.toLowerCase().trim() : '';
}

export function isVisitDeclined(visitRequest?: Record<string, unknown> | null): boolean {
  if (!visitRequest) return false;
  const status = getVisitLogisticsStatus(visitRequest);
  if (VISIT_DECLINED_STATUSES.has(status)) return true;
  if (status.includes('cancel') || status.includes('declin') || status.includes('reject')) return true;
  if (visitRequest.declined === true || visitRequest.cancelled === true) return true;
  return false;
}

export function getVisitDeclineActor(visitRequest?: Record<string, unknown> | null): VisitDeclineActor {
  if (!isVisitDeclined(visitRequest)) return 'unknown';

  const actorRaw = [
    visitRequest?.declinedBy,
    visitRequest?.declined_by,
    visitRequest?.cancelledBy,
    visitRequest?.cancelled_by,
    visitRequest?.declinedByRole,
    visitRequest?.declined_by_role,
  ]
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  const actor = typeof actorRaw === 'string' ? actorRaw.toLowerCase() : '';
  if (actor.includes('provider')) return 'provider';
  if (actor.includes('client') || actor.includes('user') || actor.includes('customer')) return 'client';

  const status = getVisitLogisticsStatus(visitRequest);
  if (status.includes('provider')) return 'provider';
  if (status.includes('client') || status.includes('user')) return 'client';

  return 'unknown';
}

export function getVisitDeclinedDescription(
  visitRequest?: Record<string, unknown> | null,
  audience: 'client' | 'provider' = 'provider'
): string {
  const actor = getVisitDeclineActor(visitRequest);
  if (audience === 'provider') {
    if (actor === 'provider') return 'You declined the visit.';
    if (actor === 'client') return 'Client declined the visit.';
    return 'Visit was declined.';
  }
  if (actor === 'client') return 'You declined the visit.';
  if (actor === 'provider') return 'Provider declined the visit.';
  return 'Visit was declined.';
}

export function patchVisitDeclined(
  visitRequest?: Record<string, unknown> | null,
  actor: VisitDeclineActor = 'client'
): Record<string, unknown> {
  const status =
    actor === 'client'
      ? 'client_declined'
      : actor === 'provider'
        ? 'provider_declined'
        : 'declined';
  return {
    ...(visitRequest || {}),
    logisticsStatus: status,
    declined: true,
    ...(actor !== 'unknown' ? { declinedBy: actor } : {}),
  };
}

/** Some backends mark the whole request cancelled when only the visit was declined. */
export function healJobStatusAfterVisitDecline<T extends { status?: string; visitRequest?: unknown }>(
  request: T
): T {
  if (!isVisitDeclined(request.visitRequest as Record<string, unknown> | null | undefined)) {
    return request;
  }
  const status = (request.status || '').toString().toLowerCase();
  if (status !== 'cancelled') return request;
  return { ...request, status: 'inspecting' as T['status'] };
}

export function isTerminalVisitStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  return normalized === 'paid' || isVisitDeclined({ logisticsStatus: normalized });
}

export function hasVisitRequestEvidence(visitRequest?: Record<string, unknown> | null): boolean {
  if (!visitRequest) return false;
  return !!(
    visitRequest.scheduledDate ||
    visitRequest.scheduled_date ||
    visitRequest.scheduledTime ||
    visitRequest.scheduled_time ||
    visitRequest.requestedAt ||
    visitRequest.requested_at ||
    visitRequest.logisticsStatus ||
    visitRequest.logistics_status ||
    visitRequest.logisticsCost != null ||
    visitRequest.logistics_cost != null
  );
}

export function isVisitPaid(visitRequest?: Record<string, unknown> | null): boolean {
  return getVisitLogisticsStatus(visitRequest) === 'paid';
}

export function isVisitCompletedOrPaid(visitRequest?: Record<string, unknown> | null): boolean {
  const status = getVisitLogisticsStatus(visitRequest);
  if (!status) return isVisitPaid(visitRequest);
  if (status === 'paid') return true;
  return ['completed', 'complete', 'done', 'visited', 'inspected', 'confirmed', 'finished'].some(
    (token) => status.includes(token)
  );
}

export function quotationImpliesPriorVisit(quotations: unknown[] | null | undefined): boolean {
  if (!Array.isArray(quotations)) return false;
  return quotations.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const quote = entry as Record<string, unknown>;
    const findings = quote.findingsAndWorkRequired ?? quote.findings_and_work_required;
    return typeof findings === 'string' && findings.trim().length > 0;
  });
}

/** True when a site visit was requested, paid, completed, or clearly happened before a quote. */
export function resolveVisitOccurred(input: {
  visitRequest?: Record<string, unknown> | null;
  requestStatus?: string | null;
  quotations?: unknown[] | null;
}): boolean {
  const { visitRequest, requestStatus, quotations } = input;
  if (hasVisitRequestEvidence(visitRequest)) return true;
  if (isVisitCompletedOrPaid(visitRequest)) return true;
  const status = (requestStatus || '').toLowerCase();
  if (status === 'inspecting' || status.includes('inspect')) return true;
  if (quotationImpliesPriorVisit(quotations)) return true;
  return false;
}
